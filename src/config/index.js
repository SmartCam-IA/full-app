require('dotenv').config();

module.exports = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development',
  },
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'smartcam',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'smartcam_db',
    connectionLimit: 10,
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY,
  },
  storage: {
    path: process.env.STORAGE_PATH || './storage/images',
    type: process.env.STORAGE_TYPE || 'local',
  },
  huggingface: {
    apiKey: process.env.HUGGINGFACE_API_KEY,
  },
  camera: {
    motionDetectionThreshold: parseInt(process.env.MOTION_DETECTION_THRESHOLD) || 30,
    reconnectInterval: parseInt(process.env.CAMERA_RECONNECT_INTERVAL) || 30000,
    timeout: parseInt(process.env.CAMERA_TIMEOUT) || 60000,
  },
  analysis: {
    maxConcurrent: parseInt(process.env.MAX_CONCURRENT_ANALYSIS) || 5,
  },
};
