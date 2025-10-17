const axios = require('axios');
const config = require('../config');
const Analysis = require('../models/Analysis');
const Image = require('../models/Image');
const Result = require('../models/Result');
const storageService = require('./storageService');
const fs = require('fs').promises;
const path = require('path');

class AnalysisService {
  constructor() {
    this.analysisQueue = [];
    this.processing = false;
    this.activeAnalyses = new Map();
    this.positiveCounters = new Map(); // Track consecutive positive results
    this.analysisModules = new Map(); // Map to store loaded analysis modules
    this.loadAnalysisModules();
  }

  /**
   * Load analysis modules from the analysis folder
   */
  loadAnalysisModules() {
    try {
      const fireDetection = require('../analysis/fireDetection');
      this.analysisModules.set('Fire Detection', fireDetection);
      this.analysisModules.set('Pompier', fireDetection);
      console.log('Loaded analysis modules:', Array.from(this.analysisModules.keys()));
    } catch (err) {
      console.error('Error loading analysis modules:', err);
    }
  }

  /**
   * Queue an image for analysis
   * @param {number} imageId - Image ID
   */
  async queueAnalysis(imageId) {
    this.analysisQueue.push(imageId);
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Process queued analyses
   */
  async processQueue() {
    this.processing = true;

    while (this.analysisQueue.length > 0) {
      const imageId = this.analysisQueue.shift();
      
      try {
        await this.analyzeImage(imageId);
      } catch (err) {
        console.error(`Error analyzing image ${imageId}:`, err);
      }
    }

    this.processing = false;
  }

  /**
   * Analyze an image with all active analyses
   * @param {number} imageId - Image ID
   */
  async analyzeImage(imageId) {
    const image = await Image.findById(imageId);
    if (!image) {
      console.error(`Image ${imageId} not found`);
      return;
    }

    const analyses = await Analysis.findAll({ is_active: true });
    
    for (const analysis of analyses) {
      try {
        await this.runAnalysis(image, analysis);
      } catch (err) {
        console.error(`Error running analysis ${analysis.name} on image ${imageId}:`, err);
      }
    }
  }

  /**
   * Run a specific analysis on an image
   * @param {Object} image - Image object
   * @param {Object} analysis - Analysis configuration
   */
  async runAnalysis(image, analysis) {
    const imagePath = storageService.getImagePath(image.uri);
    const imageBuffer = await fs.readFile(imagePath);

    // Check if we have a specific module for this analysis
    const analysisModule = this.analysisModules.get(analysis.name) || this.analysisModules.get(analysis.type);
    
    let result;
    if (analysisModule) {
      result = await analysisModule.analyze(imageBuffer);
    } else {
      result = await this.callHuggingFaceAPI(imageBuffer, analysis.api_endpoint);
    }
    
    // Si l'analyse a échoué (erreur), ne pas sauvegarder de résultat
    if (result.label === 'error' || result.error) {
      console.error(`[ERROR] Analysis ${analysis.name} failed for image ${image.id}: ${result.error || 'Unknown error'}`);
      return; // Ne pas créer de résultat en base de données
    }
    
    // Determine result based on confidence threshold
    const isPositive = result.score >= (analysis.detection_threshold || 0.5);
    const resultType = isPositive ? 'positive' : 'negative';
    
    // Determine severity based on confidence
    let severity = 'low';
    if (result.score >= 0.9) severity = 'critical';
    else if (result.score >= 0.75) severity = 'high';
    else if (result.score >= 0.6) severity = 'medium';

    // Track consecutive positive results
    const key = `${image.fk_camera}_${analysis.id}`;
    if (isPositive) {
      const count = (this.positiveCounters.get(key) || 0) + 1;
      this.positiveCounters.set(key, count);

      // Only create alert if threshold is met
      if (count >= analysis.nbr_positive_necessary) {
        console.log(`ALERT: ${analysis.name} detected on camera ${image.fk_camera} - ${count} consecutive positives`);
        severity = 'critical'; // Escalate severity for confirmed alerts
        this.positiveCounters.delete(key);
      }
    } else {
      this.positiveCounters.delete(key);
    }

    // Save result
    await Result.create({
      fk_image: image.id,
      fk_analyse: analysis.id,
      result: resultType,
      confidence: result.score,
      severity: severity,
      details: JSON.stringify(result),
      date: new Date()
    });

    console.log(`Analysis ${analysis.name} completed for image ${image.id}: ${resultType} (confidence: ${result.score})`);
  }

  /**
   * Call Hugging Face API for image analysis
   * @param {Buffer} imageBuffer - Image buffer
   * @param {string} endpoint - API endpoint
   * @returns {Object} - Analysis result
   */
  async callHuggingFaceAPI(imageBuffer, endpoint) {
    try {
      // Check if API key is configured
      if (!config.huggingface.apiKey || config.huggingface.apiKey === 'HUGGINGFACE_API_KEY') {
        const errorMsg = 'Hugging Face API key is not configured. Please set a valid HUGGINGFACE_API_KEY in docker-compose.yml';
        console.error(`[ERROR] ${errorMsg}`);
        return { label: 'error', score: 0, error: errorMsg };
      }

      const response = await axios.post(
        endpoint,
        imageBuffer,
        {
          headers: {
            'Authorization': `Bearer ${config.huggingface.apiKey}`,
            'Content-Type': 'application/octet-stream'
          },
          timeout: 30000
        }
      );

      // Parse response (format may vary by model)
      if (Array.isArray(response.data) && response.data.length > 0) {
        return {
          label: response.data[0].label,
          score: response.data[0].score
        };
      }

      return { label: 'unknown', score: 0 };
    } catch (err) {
      let errorMsg = err.message;
      if (err.response) {
        errorMsg = `HTTP ${err.response.status}: ${err.response.statusText || err.message}`;
        console.error(`[ERROR] Hugging Face API call failed: ${errorMsg}`);
        if (err.response.status === 401) {
          errorMsg = 'Invalid or expired Hugging Face API key (401 Unauthorized)';
        } else if (err.response.data) {
          console.error(`[ERROR] API response:`, err.response.data);
        }
      } else {
        console.error(`[ERROR] Hugging Face API call failed: ${errorMsg}`);
      }
      return { label: 'error', score: 0, error: errorMsg };
    }
  }

  /**
   * Get queue status
   * @returns {Object}
   */
  getStatus() {
    return {
      queueLength: this.analysisQueue.length,
      processing: this.processing,
      activeAnalyses: this.activeAnalyses.size
    };
  }
}

module.exports = new AnalysisService();
