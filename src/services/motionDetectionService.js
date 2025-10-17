const config = require('../config');
const { PNG } = require('pngjs');
const jpeg = require('jpeg-js');

class MotionDetectionService {
  constructor() {
    this.threshold = config.camera.motionDetectionThreshold;
    this.previousFrames = new Map();
  }

  /**
   * Detect motion by comparing pixel differences between frames
   * @param {Buffer} currentFrame - Current frame buffer
   * @param {number} cameraId - Camera identifier
   * @returns {boolean} - True if motion detected
   */
  detectMotion(currentFrame, cameraId) {
    const previousFrame = this.previousFrames.get(cameraId);

    // Decode JPEG (par défaut, ffmpeg sort du JPEG)
    let curr, prev;
    try {
      curr = jpeg.decode(currentFrame, { useTArray: true });
      if (!curr || !curr.data || !curr.width || !curr.height) {
        console.warn(`[MotionDetection] Invalid or empty image for camera ${cameraId}, skipping motion detection.`);
        this.previousFrames.set(cameraId, currentFrame);
        return false;
      }
      if (previousFrame) {
        prev = jpeg.decode(previousFrame, { useTArray: true });
        if (!prev || !prev.data || !prev.width || !prev.height) {
          console.warn(`[MotionDetection] Previous frame invalid for camera ${cameraId}, skipping motion detection.`);
          this.previousFrames.set(cameraId, currentFrame);
          return false;
        }
      }
    } catch (e) {
      console.error('[MotionDetection] JPEG decode error:', e);
      // fallback: compare buffers as before
      return this._fallbackDetectMotion(currentFrame, cameraId, previousFrame);
    }

    if (!prev) {
      this.previousFrames.set(cameraId, currentFrame);
      return true; // First frame, assume motion
    }

    const diff = this.calculateImageDifference(curr, prev);
    this.previousFrames.set(cameraId, currentFrame);

    console.log(`[DEBUG] MotionDetection diff for camera ${cameraId}: ${diff.toFixed(2)}%`);
    return diff > this.threshold;
  }

  /**
   * Calculate difference between two decoded images
   * @param {object} img1 - Decoded image {data, width, height}
   * @param {object} img2 - Decoded image {data, width, height}
   * @returns {number} - Percentage difference
   */
  calculateImageDifference(img1, img2) {
    if (
      !img1 || !img2 ||
      img1.width !== img2.width ||
      img1.height !== img2.height
    ) {
      return 100; // Different sizes, consider as motion
    }

    let differences = 0;
    const totalPixels = img1.width * img1.height;
    const sampleRate = 10; // Sample every 10th pixel for performance

    for (let i = 0; i < totalPixels; i += sampleRate) {
      const idx = i * 4;
      // Compare RGB only
      const dr = Math.abs(img1.data[idx] - img2.data[idx]);
      const dg = Math.abs(img1.data[idx + 1] - img2.data[idx + 1]);
      const db = Math.abs(img1.data[idx + 2] - img2.data[idx + 2]);
      if (dr + dg + db > 60) { // threshold for pixel change
        differences++;
      }
    }

    return (differences / (totalPixels / sampleRate)) * 100;
  }

  /**
   * Fallback: old buffer-based detection
   */
  _fallbackDetectMotion(currentFrame, cameraId, previousFrame) {
    if (!previousFrame) {
      this.previousFrames.set(cameraId, currentFrame);
      return true;
    }
    const diff = this.calculateDifference(currentFrame, previousFrame);
    this.previousFrames.set(cameraId, currentFrame);
    console.log(`[DEBUG] MotionDetection fallback diff for camera ${cameraId}: ${diff.toFixed(2)}%`);
    return diff > this.threshold;
  }

  /**
   * Calculate difference between two frames (buffer-based)
   * @param {Buffer} frame1 
   * @param {Buffer} frame2 
   * @returns {number} - Percentage difference
   */
  calculateDifference(frame1, frame2) {
    if (frame1.length !== frame2.length) {
      return 100; // Different sizes, consider as motion
    }

    let differences = 0;
    const sampleRate = 10; // Sample every 10th byte for performance

    for (let i = 0; i < frame1.length; i += sampleRate) {
      if (Math.abs(frame1[i] - frame2[i]) > 30) {
        differences++;
      }
    }

    return (differences / (frame1.length / sampleRate)) * 100;
  }

  clearCache(cameraId) {
    this.previousFrames.delete(cameraId);
  }
}

module.exports = new MotionDetectionService();
