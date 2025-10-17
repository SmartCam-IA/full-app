const express = require('express');
const router = express.Router();
const Position = require('../models/Position');

/**
 * GET /api/positions
 * Get all positions
 */
router.get('/', async (req, res) => {
  try {
    const positions = await Position.findAll();
    res.json(positions);
  } catch (err) {
    console.error('Error fetching positions:', err);
    res.status(500).json({ error: 'Failed to fetch positions' });
  }
});

/**
 * GET /api/positions/:id
 * Get position by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const position = await Position.findById(parseInt(req.params.id));
    if (!position) {
      return res.status(404).json({ error: 'Position not found' });
    }
    res.json(position);
  } catch (err) {
    console.error('Error fetching position:', err);
    res.status(500).json({ error: 'Failed to fetch position' });
  }
});

/**
 * POST /api/positions
 * Create a new position
 */
router.post('/', async (req, res) => {
  try {
    const { latitude, longitude, label } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Missing required fields: latitude, longitude' });
    }

    const positionId = await Position.create({
      latitude,
      longitude,
      label
    });

    res.status(201).json({ id: positionId, message: 'Position created successfully' });
  } catch (err) {
    console.error('Error creating position:', err);
    res.status(500).json({ error: 'Failed to create position' });
  }
});

/**
 * PUT /api/positions/:id
 * Update a position
 */
router.put('/:id', async (req, res) => {
  try {
    const positionId = parseInt(req.params.id);
    const updates = req.body;

    await Position.update(positionId, updates);
    res.json({ message: 'Position updated successfully' });
  } catch (err) {
    console.error('Error updating position:', err);
    res.status(500).json({ error: 'Failed to update position' });
  }
});

/**
 * DELETE /api/positions/:id
 * Delete a position
 */
router.delete('/:id', async (req, res) => {
  try {
    const positionId = parseInt(req.params.id);
    await Position.delete(positionId);
    res.json({ message: 'Position deleted successfully' });
  } catch (err) {
    console.error('Error deleting position:', err);
    res.status(500).json({ error: 'Failed to delete position' });
  }
});

module.exports = router;
