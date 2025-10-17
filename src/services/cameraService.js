const Camera = require('../models/Camera');
const Position = require('../models/Position');
const videoProcessingService = require('./videoProcessingService');
const config = require('../config');

class CameraService {
  constructor() {
    this.healthCheckInterval = null;
    this.startHealthCheck();
  }

  /**
   * Start health check monitoring for all cameras
   */
  startHealthCheck() {
    // Check camera health every minute
    this.healthCheckInterval = setInterval(async () => {
      await this.checkCamerasHealth();
    }, 60000);
  }

  /**
   * Check health of all active cameras
   */
  async checkCamerasHealth() {
    try {
      const cameras = await Camera.findAll({ status: 'active' });
      const now = new Date();

      for (const camera of cameras) {
        if (camera.last_connexion) {
          const lastConnection = new Date(camera.last_connexion);
          const timeDiff = now - lastConnection;

          // If no connection for more than timeout period, mark as error
          if (timeDiff > config.camera.timeout) {
            console.log(`Camera ${camera.id} (${camera.ip}) timeout - marking as error`);
            await Camera.updateStatus(camera.id, 'error');
            await videoProcessingService.stopProcessing(camera.id);
          }
        }
      }
    } catch (err) {
      console.error('Error checking cameras health:', err);
    }
  }

  /**
   * Add a new camera
   * @param {Object} cameraData - Camera data (including latitude, longitude, label)
   * @returns {Promise<number>} - Camera ID
   */
  async addCamera(cameraData) {
    try {
      const { latitude, longitude, label, ...cameraPureData } = cameraData;
      
      // Create position first
      let positionId = cameraPureData.fk_position;
      
      if (!positionId && latitude && longitude) {
        // Create a new position if coordinates are provided
        positionId = await Position.create({
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          label: label || `Camera ${cameraPureData.ip}`
        });
      }
      
      if (!positionId) {
        throw new Error('Position is required. Please provide latitude and longitude.');
      }
      
      // Create camera with position reference
      const cameraId = await Camera.create({
        ...cameraPureData,
        fk_position: positionId
      });
      
      return cameraId;
    } catch (error) {
      if (error.message === 'Camera IP must be unique') {
        console.error(error.message);
        throw new Error('Unable to add camera: IP must be unique');
      }
      console.error('Error adding camera:', error);
      throw error;
    }
  }

  /**
   * Update camera configuration
   * @param {number} cameraId - Camera ID
   * @param {Object} updates - Updates to apply (including latitude, longitude, label)
   */
  async updateCamera(cameraId, updates) {
    const { latitude, longitude, label, ...cameraUpdates } = updates;
    
    // Update camera
    await Camera.update(cameraId, cameraUpdates);
    
    // Update position if GPS coordinates are provided
    if ((latitude || longitude) && cameraUpdates.fk_position) {
      const positionUpdates = {};
      if (latitude) positionUpdates.latitude = parseFloat(latitude);
      if (longitude) positionUpdates.longitude = parseFloat(longitude);
      if (label !== undefined) positionUpdates.label = label;
      
      if (Object.keys(positionUpdates).length > 0) {
        await Position.update(cameraUpdates.fk_position, positionUpdates);
      }
    } else if (latitude && longitude) {
      // Get camera to find its position
      const camera = await Camera.findById(cameraId);
      if (camera && camera.fk_position) {
        const positionUpdates = {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude)
        };
        if (label !== undefined) positionUpdates.label = label;
        
        await Position.update(camera.fk_position, positionUpdates);
      }
    }
    
    console.log(`Camera ${cameraId} updated successfully`);
  }

  /**
   * Delete a camera
   * @param {number} cameraId - Camera ID
   */
  async deleteCamera(cameraId) {
    await videoProcessingService.stopProcessing(cameraId);
    await Camera.delete(cameraId);
    console.log(`Camera ${cameraId} deleted successfully`);
  }

  /**
   * Start monitoring a camera
   * @param {number} cameraId - Camera ID
   */
  async startCamera(cameraId) {
    try {
      await videoProcessingService.startProcessing(cameraId);
      console.log(`Camera ${cameraId} started successfully`);
    } catch (err) {
      console.error(`Error starting camera ${cameraId}:`, err);
      await Camera.updateStatus(cameraId, 'error');
      throw err;
    }
  }

  /**
   * Stop monitoring a camera
   * @param {number} cameraId - Camera ID
   */
  async stopCamera(cameraId) {
    await videoProcessingService.stopProcessing(cameraId);
    console.log(`Camera ${cameraId} stopped successfully`);
  }

  /**
   * Get all cameras
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>}
   */
  async getCameras(filters = {}) {
    return await Camera.findAll(filters);
  }

  /**
   * Get camera by ID
   * @param {number} cameraId - Camera ID
   * @returns {Promise<Object>}
   */
  async getCamera(cameraId) {
    return await Camera.findById(cameraId);
  }

  /**
   * Get camera statistics
   * @returns {Promise<Object>}
   */
  async getStatistics() {
    const allCameras = await Camera.findAll();
    const activeCameras = await Camera.findAll({ status: 'active' });
    const errorCameras = await Camera.findAll({ status: 'error' });

    return {
      total: allCameras.length,
      active: activeCameras.length,
      error: errorCameras.length,
      inactive: allCameras.length - activeCameras.length - errorCameras.length
    };
  }

  /**
   * Stop health check monitoring
   */
  stopHealthCheck() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
  }
}

module.exports = new CameraService();
