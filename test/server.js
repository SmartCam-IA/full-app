const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn } = require('child_process');
const sharp = require('sharp');

const app = express();
app.use(express.json());

const WEB_PORT = parseInt(process.env.PORT || '3000', 10);
const RTSP_PORT = parseInt(process.env.RTSP_PORT || '8554', 10);
// Where to publish the RTSP stream (FFmpeg client mode). In Docker Compose, set to rtsp://rtspserver:8554/stream
const RTSP_PUBLISH_URL = process.env.RTSP_PUBLISH_URL || `rtsp://localhost:${RTSP_PORT}/stream`;
// Fixed output frame size to keep encoder running without reinit
const OUT_WIDTH = parseInt(process.env.OUT_WIDTH || '1280', 10);
const OUT_HEIGHT = parseInt(process.env.OUT_HEIGHT || '720', 10);
const FPS = parseInt(process.env.FPS || '30', 10);
const HOST = process.env.HOST || '0.0.0.0';

const ROOT_DIR = __dirname;
const IMAGES_DIR = path.join(ROOT_DIR, 'images');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

let ffmpegProc = null;
let currentImageName = null; // just the file name (not full path)
let currentFrameBuffer = null; // JPEG buffer already resized to OUT_WIDTHxOUT_HEIGHT
let frameTimer = null;
let isDraining = false;

const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.bmp', '.gif']);

async function ensureImagesDir() {
    try {
        await fsp.mkdir(IMAGES_DIR, { recursive: true });
    } catch (_) {
        // ignore
    }
}

async function listImages() {
    await ensureImagesDir();
    const items = await fsp.readdir(IMAGES_DIR, { withFileTypes: true });
    return items
        .filter(
            (d) =>
                d.isFile() && allowedExt.has(path.extname(d.name).toLowerCase())
        )
        .map((d) => d.name)
        .sort((a, b) => a.localeCompare(b, 'fr'));
}

function stopFFmpeg() {
    if (frameTimer) {
        clearInterval(frameTimer);
        frameTimer = null;
    }
    if (ffmpegProc) {
        console.log('[ffmpeg] stopping current process...');
        try {
            ffmpegProc.stdin?.end();
            ffmpegProc.kill('SIGTERM');
        } catch (e) {
            console.warn('Error stopping ffmpeg:', e.message);
        }
        ffmpegProc = null;
    }
}

function startFFmpeg() {
    if (ffmpegProc) return;

    const rtspUrl = RTSP_PUBLISH_URL;
    const args = [
        // Read frames from stdin as MJPEG at fixed framerate
        '-f', 'mjpeg',
        '-framerate', String(FPS),
        '-i', 'pipe:0',

        // Video encoding
        '-an',
        '-vcodec', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'veryfast',
        '-tune', 'zerolatency',
        '-g', String(FPS * 2),

        // Output: push to RTSP server
        '-f', 'rtsp',
        '-rtsp_transport', 'tcp',
        rtspUrl,
    ];

    console.log(`[ffmpeg] starting: ${args.join(' ')}`);
    ffmpegProc = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });

    ffmpegProc.stdout.on('data', (d) => process.stdout.write(`[ffmpeg] ${d}`));
    ffmpegProc.stderr.on('data', (d) => process.stderr.write(`[ffmpeg] ${d}`));

    ffmpegProc.on('exit', (code, signal) => {
        console.log(`[ffmpeg] exited with code=${code} signal=${signal}`);
        ffmpegProc = null;
        if (frameTimer) {
            clearInterval(frameTimer);
            frameTimer = null;
        }
        // Try to restart after a short delay
        setTimeout(() => startFFmpeg(), 1000);
    });

    // Start the frame pump at the desired FPS
    const intervalMs = Math.max(1, Math.floor(1000 / FPS));
    frameTimer = setInterval(() => {
        if (!ffmpegProc || !ffmpegProc.stdin || isDraining) return;
        const buf = currentFrameBuffer;
        if (!buf) return;
        const ok = ffmpegProc.stdin.write(buf);
        if (!ok) {
            isDraining = true;
            ffmpegProc.stdin.once('drain', () => {
                isDraining = false;
            });
        }
    }, intervalMs);
}

async function prepareFrameFromImage(imageName) {
    const imagePath = path.join(IMAGES_DIR, imageName);
    if (!fs.existsSync(imagePath)) {
        throw new Error(`Image introuvable: ${imageName}`);
    }
    const jpeg = await sharp(imagePath)
        .resize(OUT_WIDTH, OUT_HEIGHT, { fit: 'contain', background: { r: 0, g: 0, b: 0 } })
        .jpeg({ quality: 90 })
        .toBuffer();
    return jpeg;
}

async function setCurrentImage(imageName) {
    const jpeg = await prepareFrameFromImage(imageName);
    currentFrameBuffer = jpeg;
    currentImageName = imageName;
}

async function ensurePlaceholderFrame() {
    if (currentFrameBuffer) return;
    const jpeg = await sharp({ create: { width: OUT_WIDTH, height: OUT_HEIGHT, channels: 3, background: { r: 32, g: 32, b: 32 } } })
        .jpeg({ quality: 80 })
        .toBuffer();
    currentFrameBuffer = jpeg;
}

// API: list images
app.get('/api/images', async (req, res) => {
    try {
        const images = await listImages();
        res.json({ images });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Impossible de lister les images.' });
    }
});

// API: select image to stream
app.post('/api/select', async (req, res) => {
    const name = req.body && req.body.name;
    if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Paramètre invalide: name' });
    }
    try {
        const images = await listImages();
        if (!images.includes(name)) {
            return res.status(404).json({ error: "L'image n'existe pas." });
        }
        // Seamlessly switch the frame content without restarting ffmpeg
        await setCurrentImage(name);
        return res.json({
            ok: true,
            current: name,
            rtsp: `rtsp://root:root@${req.hostname}:${RTSP_PORT}/stream`,
        });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ error: 'Échec du démarrage du flux.' });
    }
});

// API: status
app.get('/api/status', (req, res) => {
    res.json({
        current: currentImageName,
        rtsp: `rtsp://root:root@${req.hostname}:${RTSP_PORT}/stream`,
        rtspPort: RTSP_PORT,
    });
});

// Static: serve images for thumbnails
app.use('/images', express.static(IMAGES_DIR));
// Static: serve web UI
app.use(express.static(PUBLIC_DIR));

app.listen(WEB_PORT, HOST, async () => {
    const hostForLog = HOST === '0.0.0.0' ? 'localhost' : HOST;
    console.log(`Web UI: http://${hostForLog}:${WEB_PORT}`);
    console.log(`RTSP:   rtsp://localhost:${RTSP_PORT}/stream`);

    // Auto-select first image on startup (if any)
    const images = await listImages();
    if (images.length > 0) {
        try {
            await setCurrentImage(images[0]);
            console.log(`Image initiale: ${images[0]}`);
        } catch (e) {
            console.warn(
                'Impossible de démarrer automatiquement le flux:',
                e.message
            );
        }
    } else {
        console.log(
            'Aucune image trouvée dans ./images. Ajoutez des images pour commencer.'
        );
    }
    await ensurePlaceholderFrame();
    startFFmpeg();
});
