const express = require('express');
const router = express.Router();
const Analysis = require('../models/Analysis');

/**
 * GET /api/analyses
 * Get all analyses
 */
router.get('/', async (req, res) => {
  try {
    const filters = {};
    if (req.query.is_active !== undefined) {
      filters.is_active = req.query.is_active === 'true';
    }
    if (req.query.type_analyse) {
      filters.type_analyse = req.query.type_analyse;
    }

    const analyses = await Analysis.findAll(filters);
    res.json(analyses);
  } catch (err) {
    console.error('Error fetching analyses:', err);
    res.status(500).json({ error: 'Failed to fetch analyses' });
  }
});

/**
 * GET /api/analyses/:id
 * Get analysis by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const analysis = await Analysis.findById(parseInt(req.params.id));
    if (!analysis) {
      return res.status(404).json({ error: 'Analysis not found' });
    }
    res.json(analysis);
  } catch (err) {
    console.error('Error fetching analysis:', err);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
});

/**
 * POST /api/analyses
 * Create a new analysis
 */
router.post('/', async (req, res) => {
  try {
    const { name, type_analyse, nbr_positive_necessary, api_endpoint, detection_threshold, image_extraction_interval } = req.body;

    if (!name || !type_analyse) {
      return res.status(400).json({ error: 'Missing required fields: name, type_analyse' });
    }

    const analysisId = await Analysis.create({
      name,
      type_analyse,
      nbr_positive_necessary,
      api_endpoint,
      detection_threshold,
      image_extraction_interval
    });

    res.status(201).json({ id: analysisId, message: 'Analysis created successfully' });
  } catch (err) {
    console.error('Error creating analysis:', err);
    res.status(500).json({ error: 'Failed to create analysis' });
  }
});

/**
 * PUT /api/analyses/:id
 * Update an analysis
 */
router.put('/:id', async (req, res) => {
  try {
    const analysisId = parseInt(req.params.id);
    const updates = req.body;

    await Analysis.update(analysisId, updates);
    res.json({ message: 'Analysis updated successfully' });
  } catch (err) {
    console.error('Error updating analysis:', err);
    res.status(500).json({ error: 'Failed to update analysis' });
  }
});

/**
 * DELETE /api/analyses/:id
 * Delete an analysis
 */
router.delete('/:id', async (req, res) => {
  try {
    const analysisId = parseInt(req.params.id);
    await Analysis.delete(analysisId);
    res.json({ message: 'Analysis deleted successfully' });
  } catch (err) {
    console.error('Error deleting analysis:', err);
    res.status(500).json({ error: 'Failed to delete analysis' });
  }
});

module.exports = router;
