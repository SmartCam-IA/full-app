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
      
      let positionId = cameraPureData.fk_position;
      
      if (!positionId && latitude && longitude) {
        const lat = parseFloat(latitude);
        const lon = parseFloat(longitude);
        
        // Check if a position with these exact coordinates already exists
        const existingPosition = await Position.findByCoordinates(lat, lon);
        
        if (existingPosition) {
          // Use the existing position
          console.log(`Using existing position ${existingPosition.id} for coordinates (${lat}, ${lon})`);
          positionId = existingPosition.id;
        } else {
          // Create a new position if coordinates don't exist
          console.log(`Creating new position for coordinates (${lat}, ${lon})`);
          positionId = await Position.create({
            latitude: lat,
            longitude: lon,
            label: label || `Camera ${cameraPureData.ip}`
          });
        }
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
    
    // Get the current camera to access its old position
    const camera = await Camera.findById(cameraId);
    if (!camera) {
      throw new Error('Camera not found');
    }
    
    const oldPositionId = camera.fk_position;
    let newPositionId = oldPositionId;
    
    // If GPS coordinates are provided, handle position update
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lon = parseFloat(longitude);
      
      // Check if we need to change position
      let needsNewPosition = false;
      
      if (oldPositionId) {
        const oldPosition = await Position.findById(oldPositionId);
        if (oldPosition && (oldPosition.latitude !== lat || oldPosition.longitude !== lon)) {
          needsNewPosition = true;
        }
      } else {
        needsNewPosition = true;
      }
      
      if (needsNewPosition) {
        // Check if a position with these exact coordinates already exists
        const existingPosition = await Position.findByCoordinates(lat, lon);
        
        if (existingPosition) {
          // Use the existing position
          console.log(`Using existing position ${existingPosition.id} for coordinates (${lat}, ${lon})`);
          newPositionId = existingPosition.id;
          
          // Update label if provided and different
          if (label !== undefined && label !== existingPosition.label) {
            await Position.update(existingPosition.id, { label });
          }
        } else {
          // Create a new position
          console.log(`Creating new position for coordinates (${lat}, ${lon})`);
          newPositionId = await Position.create({
            latitude: lat,
            longitude: lon,
            label: label || `Camera ${camera.ip}`
          });
        }
        
        // Update camera with new position
        cameraUpdates.fk_position = newPositionId;
      } else if (oldPositionId && label !== undefined) {
        // Same coordinates, just update the label
        await Position.update(oldPositionId, { label });
      }
    }
    
    // Update camera FIRST (to remove the foreign key constraint)
    await Camera.update(cameraId, cameraUpdates);
    
    // THEN check if old position should be deleted (after camera is updated)
    if (latitude && longitude && oldPositionId && newPositionId && oldPositionId !== newPositionId) {
      const camerasUsingOldPosition = await Position.countCamerasUsingPosition(oldPositionId);
      if (camerasUsingOldPosition === 0) {
        console.log(`Deleting orphaned position ${oldPositionId}`);
        await Position.delete(oldPositionId);
      }
    }
    
    console.log(`Camera ${cameraId} updated successfully`);
  }

  /**
   * Delete a camera
   * @param {number} cameraId - Camera ID
   */
  async deleteCamera(cameraId) {
    // Get camera to access its position
    const camera = await Camera.findById(cameraId);
    const positionId = camera ? camera.fk_position : null;
    
    await videoProcessingService.stopProcessing(cameraId);
    await Camera.delete(cameraId);
    
    // Check if position should be deleted (if no other cameras use it)
    if (positionId) {
      const camerasUsingPosition = await Position.countCamerasUsingPosition(positionId);
      if (camerasUsingPosition === 0) {
        console.log(`Deleting orphaned position ${positionId} after camera deletion`);
        await Position.delete(positionId);
      }
    }
    
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
