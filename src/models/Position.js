const db = require('../config/database');

class Position {
  static async create(positionData) {
    const { latitude, longitude, label } = positionData;
    
    const sql = `
      INSERT INTO \`position\` (latitude, longitude, label)
      VALUES (?, ?, ?)
    `;
    
    const result = await db.query(sql, [latitude, longitude, label]);
    return result.insertId;
  }

  static async findById(id) {
    const sql = 'SELECT * FROM `position` WHERE id = ?';
    const positions = await db.query(sql, [id]);
    return positions.length > 0 ? positions[0] : null;
  }

  static async findAll() {
    const sql = 'SELECT * FROM `position`';
    return await db.query(sql);
  }

  static async findByCoordinates(latitude, longitude) {
    // Find position with exact coordinates
    const sql = 'SELECT * FROM `position` WHERE latitude = ? AND longitude = ?';
    const positions = await db.query(sql, [latitude, longitude]);
    return positions.length > 0 ? positions[0] : null;
  }

  static async countCamerasUsingPosition(positionId) {
    // Count how many cameras are using this position
    const sql = 'SELECT COUNT(*) as count FROM camera WHERE fk_position = ?';
    const result = await db.query(sql, [positionId]);
    return result[0].count;
  }

  static async update(id, updates) {
    const allowedFields = ['latitude', 'longitude', 'label'];
    const fields = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (fields.length === 0) {
      return false;
    }

    params.push(id);
    const sql = `UPDATE \`position\` SET ${fields.join(', ')} WHERE id = ?`;
    await db.query(sql, params);
    return true;
  }

  static async delete(id) {
    const sql = 'DELETE FROM `position` WHERE id = ?';
    await db.query(sql, [id]);
  }
}

module.exports = Position;
