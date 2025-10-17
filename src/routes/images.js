const express = require('express');
const router = express.Router();
const Image = require('../models/Image');
const storageService = require('../services/storageService');
const path = require('path');
const fs = require('fs');

/**
 * GET /api/images/:id
 * Get image by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    // Validate ID
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid image ID' });
    }

    console.log(`Fetching image with ID: ${id}`);
    const image = await Image.findById(id);
    
    if (!image) {
      console.log(`Image not found in database: ${id}`);
      return res.status(404).json({ error: 'Image not found' });
    }

    console.log(`Image found: ${JSON.stringify(image)}`);
    const imagePath = storageService.getImagePath(image.uri);
    console.log(`Image path: ${imagePath}`);

    // Ensure absolute path
    const absolutePath = path.isAbsolute(imagePath) ? imagePath : path.resolve(imagePath);
    
    // Check if file exists
    if (!fs.existsSync(absolutePath)) {
      console.error(`File does not exist: ${absolutePath}`);
      return res.status(404).json({ error: 'Image file not found on disk' });
    }

    res.sendFile(absolutePath);
  } catch (err) {
    console.error('Error fetching image:', err);
    res.status(500).json({ error: 'Failed to fetch image', details: err.message });
  }
});

module.exports = router;
