const ffmpeg = require('fluent-ffmpeg');
const Camera = require('../models/Camera');
const Image = require('../models/Image');
const storageService = require('./storageService');
const motionDetectionService = require('./motionDetectionService');
const analysisService = require('./analysisService');
const config = require('../config');
const path = require('path');
const os = require('os');
const fs = require('fs');

// Configure FFmpeg binary path per OS:
// - In Docker/Linux, rely on system ffmpeg installed via apk (in PATH)
// - On Windows dev environment, use the bundled ffmpeg.exe in bin/
try {
  const isWindows = process.platform === 'win32';
  const customPath = process.env.FFMPEG_PATH;
  if (customPath && customPath.trim()) {
    ffmpeg.setFfmpegPath(customPath.trim());
  } else if (isWindows) {
    const winFfmpeg = path.join(__dirname, '..', '..', 'bin', 'ffmpeg.exe');
    ffmpeg.setFfmpegPath(winFfmpeg);
  }
} catch (e) {
  console.warn('[WARN] Failed to configure ffmpeg path, falling back to system PATH:', e?.message || e);
}

class VideoProcessingService {
  constructor() {
    this.activeStreams = new Map();
    this.processingQueues = new Map();
    this.failureCounts = new Map();
    this.MAX_FAILURES = 10;
    
    // Crée un dossier temp dans le projet si nécessaire
    this.tempDir = path.join(__dirname, '..', '..', 'temp');
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Start processing a camera stream
   * @param {number} cameraId - Camera ID
   */
  async startProcessing(cameraId) {
    if (this.activeStreams.has(cameraId)) {
      console.log(`Camera ${cameraId} already being processed`);
      return;
    }

    const camera = await Camera.findById(cameraId);
    if (!camera) {
      throw new Error(`Camera ${cameraId} not found`);
    }

    const rtspUrl = this.buildRtspUrl(camera);
    
    this.failureCounts.set(cameraId, 0); // Reset failure count

    const intervalId = setInterval(async () => {
      try {
        await this.captureFrame(camera, rtspUrl);
        // Reset failure count on success
        this.failureCounts.set(cameraId, 0);
      } catch (err) {
        // Increment failure count
        const failures = (this.failureCounts.get(cameraId) || 0) + 1;
        this.failureCounts.set(cameraId, failures);
        
        console.error(`[ERROR] Error capturing frame for camera ${cameraId} (failure ${failures}/${this.MAX_FAILURES}):`, err);
        
        // Si trop d'échecs consécutifs, arrêter le traitement
        if (failures >= this.MAX_FAILURES) {
          console.error(`[ERROR] Camera ${cameraId} failed ${this.MAX_FAILURES} times, stopping processing`);
          await this.stopProcessing(cameraId);
          await Camera.updateStatus(cameraId, 'error');
        }
      }
    }, 1000);

    this.activeStreams.set(cameraId, intervalId);
    await Camera.updateStatus(cameraId, 'active');
    await Camera.updateLastConnection(cameraId);
  }

  /**
   * Stop processing a camera stream
   * @param {number} cameraId - Camera ID
   */
  async stopProcessing(cameraId) {
    const intervalId = this.activeStreams.get(cameraId);
    if (intervalId) {
      clearInterval(intervalId);
      this.activeStreams.delete(cameraId);
      motionDetectionService.clearCache(cameraId);
      await Camera.updateStatus(cameraId, 'inactive');
      console.log(`Stopped video processing for camera ${cameraId}`);
    }
  }

  /**
   * Capture a single frame from the RTSP stream
   * @param {Object} camera - Camera object
   * @param {string} rtspUrl - RTSP URL
   */
  async captureFrame(camera, rtspUrl) {
    const CAPTURE_TIMEOUT = 15000; // Augmenté à 15 secondes
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const tempPath = path.join(this.tempDir, `frame_${camera.id}_${timestamp}.jpg`);

      let timeoutHandle = setTimeout(() => {
        console.error(`[ERROR] FFmpeg capture timeout for camera ${camera.id} (${camera.ip})`);
        reject(new Error('FFmpeg timeout'));
      }, CAPTURE_TIMEOUT);
      
      const ffmpegCommand = ffmpeg(rtspUrl)
        .inputOptions([
          '-rtsp_transport', 'tcp',        // Utiliser TCP au lieu d'UDP
          '-analyzeduration', '5000000',   // 5 secondes pour analyser
          '-probesize', '5000000'          // 5MB pour probe
        ])
        .outputOptions([
            '-vframes', '1',                 // Capturer 1 frame
            '-q:v', '2',                     // Qualité JPEG (2 = haute qualité)
            '-update', '1',                  // IMPORTANT: Permet d'écrire un seul fichier
          '-f', 'image2'                   // Format image explicite
        ])
        .output(tempPath)
        .on('stderr', (stderrLine) => {
          // Log seulement les erreurs importantes
          if (stderrLine.includes('error') || stderrLine.includes('Error') || 
              stderrLine.includes('Invalid') || stderrLine.includes('failed')) {
            console.log(`[FFMPEG] ${stderrLine}`);
          }
        })
        .on('end', async () => {
          clearTimeout(timeoutHandle);
          try {
            // Vérifier que le fichier existe et n'est pas vide
            if (!fs.existsSync(tempPath)) {
              throw new Error('Frame file not created');
            }
            
            const stats = fs.statSync(tempPath);
            if (stats.size === 0) {
              throw new Error('Frame file is empty');
            }
            
            const frameBuffer = fs.readFileSync(tempPath);
            
            // Check for motion
            const hasMotion = motionDetectionService.detectMotion(frameBuffer, camera.id);
            
            if (hasMotion) {
              let filename, imageId;
              try {
                filename = await storageService.saveImage(frameBuffer, camera.id, timestamp);
                imageId = await Image.create({
                  date: new Date(),
                  uri: filename,
                  fk_camera: camera.id
                });
                console.log(`Motion detected on camera ${camera.id}, image saved: ${filename}`);
              } catch (saveErr) {
                console.error(`[ERROR] Failed to save image for camera ${camera.id}:`, saveErr);
              }
              if (imageId) {
                try {
                  this.queueForAnalysis(imageId);
                } catch (analysisErr) {
                  console.error(`[ERROR] Failed to queue image for analysis (imageId: ${imageId}):`, analysisErr);
                }
              }
            } else {
              // Pas de mouvement détecté - pas de log sauf en mode debug
            }

            // Clean up temp file
            fs.unlinkSync(tempPath);
            await Camera.updateLastConnection(camera.id);
            resolve();
          } catch (err) {
            console.error(`[ERROR] Error during frame processing for camera ${camera.id}:`, err);
            // Nettoie le fichier temp si erreur
            try {
              if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
              }
            } catch (cleanupErr) {
              console.error(`[ERROR] Failed to cleanup temp file:`, cleanupErr);
            }
            reject(err);
          }
        })
        .on('error', (err, stdout, stderr) => {
          clearTimeout(timeoutHandle);
          console.error(`[ERROR] FFmpeg failed for camera ${camera.id} (${camera.ip}): ${err.message}`);
          
          if (stderr) {
            console.error(`[FFMPEG stderr]:`, stderr);
          }
          
          // Nettoie le fichier temp si erreur
          try {
            if (fs.existsSync(tempPath)) {
              fs.unlinkSync(tempPath);
            }
          } catch (cleanupErr) {
            console.error(`[ERROR] Failed to cleanup temp file:`, cleanupErr);
          }
          reject(err);
        });
      
      ffmpegCommand.run();
    });
  }

  /**
   * Build RTSP URL with credentials
   * @param {Object} camera - Camera object with decrypted credentials
   * @returns {string} - RTSP URL
   */
  buildRtspUrl(camera) {
    const port = camera.port || 554;
    const path = camera.path || '/live0';
    
    // Remove leading slash if present in path (we'll add it back)
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    
    // Build URL with port if not default RTSP port (554)
    const portPart = port === 554 ? '' : `:${port}`;
    const url = `rtsp://${camera.username}:${camera.password}@${camera.ip}${portPart}${cleanPath}`;
    
    return url;
  }

  /**
   * Queue an image for analysis
   * @param {number} imageId - Image ID
   */
  queueForAnalysis(imageId) {
    // Queue the image for analysis using the analysis service
    analysisService.queueAnalysis(imageId);
  }

  /**
   * Get active streams count
   * @returns {number}
   */
  getActiveStreamsCount() {
    return this.activeStreams.size;
  }

  /**
   * Get all active camera IDs
   * @returns {Array<number>}
   */
  getActiveCameraIds() {
    return Array.from(this.activeStreams.keys());
  }
}

module.exports = new VideoProcessingService();
