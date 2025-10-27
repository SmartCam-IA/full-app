const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const nunjucks = require('nunjucks');
const path = require('path');
const config = require('./config');
const db = require('./config/database');
const { initializeDatabase } = require('./config/initDatabase');
const cameraService = require('./services/cameraService');

// Import routes
const camerasRouter = require('./routes/cameras');
const analysesRouter = require('./routes/analyses');
const resultsRouter = require('./routes/results');
const positionsRouter = require('./routes/positions');
const imagesRouter = require('./routes/images');
const webRouter = require('./routes/web');

// Initialize Express app
const app = express();

// Configure Nunjucks
const nunjucksEnv = nunjucks.configure(path.join(__dirname, '../views'), {
  autoescape: true,
  express: app,
  watch: true
});

// Add custom filters
nunjucksEnv.addFilter('date', function(date, format) {
  if (!date) return '';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  
  // Simple date formatting
  const pad = (n) => String(n).padStart(2, '0');
  
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  
  if (format === 'DD/MM/YYYY HH:mm:ss') {
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  }
  if (format === 'DD/MM/YYYY') {
    return `${day}/${month}/${year}`;
  }
  
  // Default format
  return d.toLocaleString('fr-FR');
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Web interface routes (must come before API routes to handle root)
app.use('/', webRouter);

// API routes
app.use('/api/cameras', camerasRouter);
app.use('/api/analyses', analysesRouter);
app.use('/api/results', resultsRouter);
app.use('/api/positions', positionsRouter);
app.use('/api/images', imagesRouter);

// API root endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'SmartCam Images Analysis API',
    version: '1.0.0',
    status: 'running'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
async function startServer() {
  try {
    // Test database connection
    const dbConnected = await db.testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database. Please check your configuration.');
      process.exit(1);
    }

    // Initialize database tables
    await initializeDatabase();

    // Restart active cameras
    console.log('Restarting active cameras...');
    await restartActiveCameras();

    // Start listening
    app.listen(config.server.port, () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║     SmartCam Images Analysis                          ║
║                                                       ║
║     Server running on port ${config.server.port}                    ║
║     Environment: ${config.server.env}                        ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
      `);
      console.log('Web interface: http://localhost:' + config.server.port);
      console.log('\nAPI endpoints available:');
      console.log('  - GET  /health');
      console.log('  - GET  /api');
      console.log('  - GET  /api/cameras');
      console.log('  - GET  /api/analyses');
      console.log('  - GET  /api/results');
      console.log('  - GET  /api/positions');
      console.log('\nWeb pages:');
      console.log('  - GET  /             (Dashboard)');
      console.log('  - GET  /cameras      (Camera management)');
      console.log('  - GET  /alerts       (Alerts)');
      console.log('  - GET  /analyses     (Analysis configuration)');
      console.log('  - GET  /map          (Map view)');
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

/**
 * Restart all cameras with 'active' status
 */
async function restartActiveCameras() {
  try {
    const activeCameras = await cameraService.getCameras({ status: 'active' });
    
    if (activeCameras.length === 0) {
      console.log('No active cameras to restart.');
      return;
    }

    console.log(`Found ${activeCameras.length} active camera(s) to restart...`);
    
    for (const camera of activeCameras) {
      try {
        console.log(`Starting camera #${camera.id} (${camera.ip})...`);
        await cameraService.startCamera(camera.id);
        console.log(`✓ Camera #${camera.id} started successfully`);
      } catch (err) {
        console.error(`✗ Failed to start camera #${camera.id}:`, err.message);
      }
    }
    
    console.log('Active cameras restart completed.\n');
  } catch (err) {
    console.error('Error restarting active cameras:', err);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\nSIGTERM received, shutting down gracefully...');
  await shutdownGracefully();
});

process.on('SIGINT', async () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  await shutdownGracefully();
});

/**
 * Stop all active cameras before shutdown
 */
async function shutdownGracefully() {
  try {
    console.log('Stopping all active cameras...');
    const activeCameras = await cameraService.getCameras({ status: 'active' });
    
    for (const camera of activeCameras) {
      try {
        console.log(`Stopping camera #${camera.id}...`);
        await cameraService.stopCamera(camera.id);
      } catch (err) {
        console.error(`Error stopping camera #${camera.id}:`, err.message);
      }
    }
    
    console.log('All cameras stopped. Goodbye!');
  } catch (err) {
    console.error('Error during shutdown:', err);
  } finally {
    process.exit(0);
  }
}

// Start the server
startServer();

module.exports = app;
