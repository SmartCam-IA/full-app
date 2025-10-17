const express = require('express');
const router = express.Router();
const cameraService = require('../services/cameraService');

/**
 * GET /api/cameras
 * Get all cameras
 */
router.get('/', async (req, res) => {
  try {
    const filters = {};
    if (req.query.status) {
      filters.status = req.query.status;
    }

    const cameras = await cameraService.getCameras(filters);
    res.json(cameras);
  } catch (err) {
    console.error('Error fetching cameras:', err);
    res.status(500).json({ error: 'Failed to fetch cameras' });
  }
});

/**
 * GET /api/cameras/stats
 * Get camera statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await cameraService.getStatistics();
    res.json(stats);
  } catch (err) {
    console.error('Error fetching camera stats:', err);
    res.status(500).json({ error: 'Failed to fetch camera statistics' });
  }
});

/**
 * GET /api/cameras/:id
 * Get camera by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const camera = await cameraService.getCamera(parseInt(req.params.id));
    if (!camera) {
      return res.status(404).json({ error: 'Camera not found' });
    }
    res.json(camera);
  } catch (err) {
    console.error('Error fetching camera:', err);
    res.status(500).json({ error: 'Failed to fetch camera' });
  }
});

/**
 * POST /api/cameras
 * Create a new camera
 */
router.post('/', async (req, res) => {
  try {
    const { ip, port, path, username, password, model, latitude, longitude, label } = req.body;

    if (!ip || !username || !password) {
      return res.status(400).json({ error: 'Missing required fields: ip, username, password' });
    }

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Missing required fields: latitude, longitude' });
    }

    // Validate GPS coordinates
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    
    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'Invalid GPS coordinates' });
    }
    
    if (lat < -90 || lat > 90) {
      return res.status(400).json({ error: 'Latitude must be between -90 and 90' });
    }
    
    if (lon < -180 || lon > 180) {
      return res.status(400).json({ error: 'Longitude must be between -180 and 180' });
    }

    // Validate port if provided
    const cameraPort = port ? parseInt(port) : 554;
    if (isNaN(cameraPort) || cameraPort < 1 || cameraPort > 65535) {
      return res.status(400).json({ error: 'Port must be between 1 and 65535' });
    }

    const cameraId = await cameraService.addCamera({
      ip,
      port: cameraPort,
      path: path || '/live0',
      username,
      password,
      model,
      latitude: lat,
      longitude: lon,
      label
    });

    res.status(201).json({ id: cameraId, message: 'Camera created successfully' });
  } catch (err) {
    console.error('Error creating camera:', err);
    res.status(500).json({ error: err.message || 'Failed to create camera' });
  }
});

/**
 * PUT /api/cameras/:id
 * Update a camera
 */
router.put('/:id', async (req, res) => {
  try {
    const cameraId = parseInt(req.params.id);
    const updates = req.body;

    await cameraService.updateCamera(cameraId, updates);
    res.json({ message: 'Camera updated successfully' });
  } catch (err) {
    console.error('Error updating camera:', err);
    res.status(500).json({ error: 'Failed to update camera' });
  }
});

/**
 * DELETE /api/cameras/:id
 * Delete a camera
 */
router.delete('/:id', async (req, res) => {
  try {
    const cameraId = parseInt(req.params.id);
    await cameraService.deleteCamera(cameraId);
    res.json({ message: 'Camera deleted successfully' });
  } catch (err) {
    console.error('Error deleting camera:', err);
    res.status(500).json({ error: 'Failed to delete camera' });
  }
});

/**
 * POST /api/cameras/:id/start
 * Start camera monitoring
 */
router.post('/:id/start', async (req, res) => {
  try {
    const cameraId = parseInt(req.params.id);
    await cameraService.startCamera(cameraId);
    res.json({ message: 'Camera started successfully' });
  } catch (err) {
    console.error('Error starting camera:', err);
    res.status(500).json({ error: 'Failed to start camera' });
  }
});

/**
 * POST /api/cameras/:id/stop
 * Stop camera monitoring
 */
router.post('/:id/stop', async (req, res) => {
  try {
    const cameraId = parseInt(req.params.id);
    await cameraService.stopCamera(cameraId);
    res.json({ message: 'Camera stopped successfully' });
  } catch (err) {
    console.error('Error stopping camera:', err);
    res.status(500).json({ error: 'Failed to stop camera' });
  }
});

module.exports = router;
