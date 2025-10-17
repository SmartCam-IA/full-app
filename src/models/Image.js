const db = require('../config/database');

class Image {
  static async create(imageData) {
    const { date, uri, fk_camera } = imageData;
    
    const sql = `
      INSERT INTO image (date, uri, fk_camera)
      VALUES (?, ?, ?)
    `;
    
    const result = await db.query(sql, [date, uri, fk_camera]);
    return result.insertId;
  }

  static async findById(id) {
    const sql = 'SELECT * FROM image WHERE id = ?';
    const images = await db.query(sql, [id]);
    return images.length > 0 ? images[0] : null;
  }

  static async findByCamera(cameraId, limit = 10) {
    const sql = `
      SELECT * FROM image 
      WHERE fk_camera = ? 
      ORDER BY date DESC 
      LIMIT ?
    `;
    return await db.query(sql, [cameraId, limit]);
  }

  static async findRecent(limit = 50) {
    const sql = `
      SELECT i.*, c.ip as camera_ip 
      FROM image i
      LEFT JOIN camera c ON i.fk_camera = c.id
      ORDER BY i.date DESC 
      LIMIT ?
    `;
    return await db.query(sql, [limit]);
  }
}

module.exports = Image;
