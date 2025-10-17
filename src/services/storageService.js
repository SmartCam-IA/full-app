const fs = require('fs').promises;
const path = require('path');
const config = require('../config');

class StorageService {
  constructor() {
    this.storagePath = config.storage.path;
    this.ensureStorageDir();
  }

  async ensureStorageDir() {
    try {
      await fs.mkdir(this.storagePath, { recursive: true });
    } catch (err) {
      console.error('Error creating storage directory:', err);
    }
  }

  async saveImage(buffer, cameraId, timestamp) {
    const filename = `cam_${cameraId}_${timestamp}.jpg`;
    const filepath = path.join(this.storagePath, filename);
    
    try {
      await fs.writeFile(filepath, buffer);
      return filename;
    } catch (err) {
      console.error('Error saving image:', err);
      throw err;
    }
  }

  async getImage(filename) {
    const filepath = path.join(this.storagePath, filename);
    
    try {
      return await fs.readFile(filepath);
    } catch (err) {
      console.error('Error reading image:', err);
      throw err;
    }
  }

  async deleteImage(filename) {
    const filepath = path.join(this.storagePath, filename);
    
    try {
      await fs.unlink(filepath);
      return true;
    } catch (err) {
      console.error('Error deleting image:', err);
      return false;
    }
  }

  /**
   * Get the full path to an image file
   * @param {string} filename - The image filename
   * @returns {string} - Full path to the image
   */
  getImagePath(filename) {
    return path.join(this.storagePath, filename);
  }
}

module.exports = new StorageService();
