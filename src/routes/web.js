const express = require('express');
const router = express.Router();
const Camera = require('../models/Camera');
const Result = require('../models/Result');
const Analysis = require('../models/Analysis');
const Image = require('../models/Image');

/**
 * GET / - Dashboard
 */
router.get('/', async (req, res) => {
  try {
    // Get camera statistics
    const allCameras = await Camera.findAll();
    const activeCameras = await Camera.findAll({ status: 'active' });
    const errorCameras = await Camera.findAll({ status: 'error' });
    
    const cameraStats = {
      total: allCameras.length,
      active: activeCameras.length,
      error: errorCameras.length,
      inactive: allCameras.length - activeCameras.length - errorCameras.length
    };

    // Get alert statistics
    const alertStats = await Result.getAlertStats();

    // Get recent unresolved alerts
    const recentAlerts = await Result.findAll({
      is_resolved: false,
      limit: 10
    });

    res.render('dashboard.html', {
      page: 'dashboard',
      cameraStats,
      alertStats,
      recentAlerts
    });
  } catch (err) {
    console.error('Error loading dashboard:', err);
    res.status(500).send('Erreur lors du chargement du tableau de bord');
  }
});

/**
 * GET /cameras - Cameras management page
 */
router.get('/cameras', async (req, res) => {
  try {
    const cameras = await Camera.findAll();
    res.render('cameras.html', {
      page: 'cameras',
      cameras
    });
  } catch (err) {
    console.error('Error loading cameras:', err);
    res.status(500).send('Erreur lors du chargement des caméras');
  }
});

/**
 * GET /cameras/:id - Camera detail page
 */
router.get('/cameras/:id', async (req, res) => {
  try {
    const cameraId = parseInt(req.params.id);
    const camera = await Camera.findById(cameraId);
    
    if (!camera) {
      return res.status(404).send('Caméra non trouvée');
    }

    // Get recent alerts for this camera
    const db = require('../config/database');
    const recentAlerts = await db.query(`
      SELECT r.*, i.uri as image_uri, i.date as image_date, 
             a.name as analysis_name, a.type_analyse
      FROM resultat_analyse r
      LEFT JOIN image i ON r.fk_image = i.id
      LEFT JOIN analyse a ON r.fk_analyse = a.id
      WHERE i.fk_camera = ?
      ORDER BY r.date DESC
      LIMIT 10
    `, [cameraId]);

    // Get recent images for this camera
    const recentImages = await Image.findByCamera(cameraId, 10);

    res.render('camera-detail.html', {
      page: 'cameras',
      camera,
      recentAlerts,
      recentImages
    });
  } catch (err) {
    console.error('Error loading camera detail:', err);
    res.status(500).send('Erreur lors du chargement des détails de la caméra');
  }
});

/**
 * GET /alerts - Alerts page
 */
router.get('/alerts', async (req, res) => {
  try {
    // Order by severity (critical > high > medium > low) and then by date
    // Exclude rejected alerts (human_rejected = TRUE)
    const db = require('../config/database');
    const alerts = await db.query(`
      SELECT r.*, i.uri as image_uri, i.date as image_date, 
             a.name as analysis_name, a.type_analyse,
             c.ip as camera_ip
      FROM resultat_analyse r
      LEFT JOIN image i ON r.fk_image = i.id
      LEFT JOIN analyse a ON r.fk_analyse = a.id
      LEFT JOIN camera c ON i.fk_camera = c.id
      WHERE r.human_rejected = FALSE
      ORDER BY 
        CASE r.severity
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        r.date DESC
      LIMIT 50
    `);
    
    res.render('alerts.html', {
      page: 'alerts',
      alerts
    });
  } catch (err) {
    console.error('Error loading alerts:', err);
    res.status(500).send('Erreur lors du chargement des alertes');
  }
});

/**
 * GET /alerts/:id - Alert detail page
 */
router.get('/alerts/:id', async (req, res) => {
  try {
    const alertId = parseInt(req.params.id);
    const alert = await Result.findById(alertId);
    
    if (!alert) {
      return res.status(404).send('Alerte non trouvée');
    }

    res.render('alert-detail.html', {
      page: 'alerts',
      alert
    });
  } catch (err) {
    console.error('Error loading alert detail:', err);
    res.status(500).send('Erreur lors du chargement des détails de l\'alerte');
  }
});

/**
 * GET /analyses - Analyses configuration page
 */
router.get('/analyses', async (req, res) => {
  try {
    const analyses = await Analysis.findAll();
    res.render('analyses.html', {
      page: 'analyses',
      analyses
    });
  } catch (err) {
    console.error('Error loading analyses:', err);
    res.status(500).send('Erreur lors du chargement des analyses');
  }
});

/**
 * GET /map - Map view
 */
router.get('/map', async (req, res) => {
  try {
    res.render('map.html', {
      page: 'map'
    });
  } catch (err) {
    console.error('Error loading map:', err);
    res.status(500).send('Erreur lors du chargement de la carte');
  }
});

/**
 * GET /validation - Validation page for human verification
 */
router.get('/validation', async (req, res) => {
  try {
    // Get unverified and non-rejected results
    const unverifiedResults = await Result.findAll({
      human_verification: false,
      result: 'positive',
      limit: 20
    });

    // Filter out rejected results (since findAll doesn't support human_rejected filter yet)
    const filteredResults = unverifiedResults.filter(r => !r.human_rejected);

    res.render('validation.html', {
      page: 'validation',
      results: filteredResults
    });
  } catch (err) {
    console.error('Error loading validation page:', err);
    res.status(500).send('Erreur lors du chargement de la page de validation');
  }
});

/**
 * GET /images/:id - Image detail page
 */
router.get('/images/:id', async (req, res) => {
  try {
    const imageId = parseInt(req.params.id);
    const image = await Image.findById(imageId);
    
    if (!image) {
      return res.status(404).send('Image non trouvée');
    }

    // Get all analyses performed on this image
    const db = require('../config/database');
    const analyses = await db.query(`
      SELECT r.*, a.name as analysis_name, a.type_analyse
      FROM resultat_analyse r
      LEFT JOIN analyse a ON r.fk_analyse = a.id
      WHERE r.fk_image = ?
      ORDER BY r.date DESC
    `, [imageId]);

    res.render('image-detail.html', {
      page: 'images',
      image,
      analyses
    });
  } catch (err) {
    console.error('Error loading image detail:', err);
    res.status(500).send('Erreur lors du chargement des détails de l\'image');
  }
});

module.exports = router;
