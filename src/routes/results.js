const express = require('express');
const router = express.Router();
const Result = require('../models/Result');

/**
 * GET /api/results
 * Get all analysis results/alerts
 */
router.get('/', async (req, res) => {
  try {
    const filters = {};
    
    if (req.query.result) {
      filters.result = req.query.result;
    }
    if (req.query.is_resolved !== undefined) {
      filters.is_resolved = req.query.is_resolved === 'true';
    }
    if (req.query.type_analyse) {
      filters.type_analyse = req.query.type_analyse;
    }
    if (req.query.human_verification !== undefined) {
      filters.human_verification = req.query.human_verification === 'true';
    }
    if (req.query.limit) {
      filters.limit = parseInt(req.query.limit);
    }

    const results = await Result.findAll(filters);
    res.json(results);
  } catch (err) {
    console.error('Error fetching results:', err);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

/**
 * GET /api/results/stats
 * Get alert statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await Result.getAlertStats();
    res.json(stats);
  } catch (err) {
    console.error('Error fetching alert stats:', err);
    res.status(500).json({ error: 'Failed to fetch alert statistics' });
  }
});

/**
 * GET /api/results/:id
 * Get result by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const result = await Result.findById(parseInt(req.params.id));
    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }
    res.json(result);
  } catch (err) {
    console.error('Error fetching result:', err);
    res.status(500).json({ error: 'Failed to fetch result' });
  }
});

/**
 * PUT /api/results/:id/verify
 * Human verification of a result
 */
router.put('/:id/verify', async (req, res) => {
  try {
    const resultId = parseInt(req.params.id);
    const { verified } = req.body;

    if (verified === true) {
      // Accept the alert
      await Result.update(resultId, {
        human_verification: true,
        human_rejected: false
      });
    } else {
      // Reject the alert
      await Result.update(resultId, {
        human_verification: false,
        human_rejected: true
      });
    }

    res.json({ message: 'Result verification updated successfully' });
  } catch (err) {
    console.error('Error updating result verification:', err);
    res.status(500).json({ error: 'Failed to update result verification' });
  }
});

/**
 * PUT /api/results/:id/resolve
 * Mark result as resolved
 */
router.put('/:id/resolve', async (req, res) => {
  try {
    const resultId = parseInt(req.params.id);

    await Result.update(resultId, {
      is_resolved: true
    });

    res.json({ message: 'Result marked as resolved' });
  } catch (err) {
    console.error('Error resolving result:', err);
    res.status(500).json({ error: 'Failed to resolve result' });
  }
});

module.exports = router;
