const db = require('../config/database');
const { encrypt, decrypt, serializeData } = require('../utils/encryption');

class Camera {
  static async create(cameraData) {
    const { ip, port = 554, path = '/live0', username, password, model, fk_position } = cameraData;
    const encryptedPassword = encrypt(password);
    const serializedData = serializeData(cameraData);
    
    const sql = `
      INSERT INTO camera (ip, port, path, username, password, model, fk_position, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'inactive')
    `;
    
    const result = await db.query(sql, [ip, port, path, username, encryptedPassword, model, fk_position]);
    return result.insertId;
  }

  static async findById(id) {
    const sql = 'SELECT * FROM camera WHERE id = ?';
    const cameras = await db.query(sql, [id]);
    
    if (cameras.length === 0) {
      return null;
    }
    
    const camera = cameras[0];
    camera.password = decrypt(camera.password);
    return camera;
  }

  static async findAll(filters = {}) {
    let sql = 'SELECT * FROM camera';
    const params = [];
    const conditions = [];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    const cameras = await db.query(sql, params);
    return cameras;
  }

  static async update(id, updates) {
    const allowedFields = ['ip', 'port', 'path', 'username', 'password', 'model', 'fk_position', 'status'];
    const fields = [];
    const params = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        if (key === 'password') {
          fields.push(`${key} = ?`);
          params.push(encrypt(value));
        } else {
          fields.push(`${key} = ?`);
          params.push(value);
        }
      }
    }

    if (fields.length === 0) {
      return false;
    }

    params.push(id);
    const sql = `UPDATE camera SET ${fields.join(', ')} WHERE id = ?`;
    await db.query(sql, params);
    return true;
  }

  static async updateStatus(id, status) {
    const sql = 'UPDATE camera SET status = ? WHERE id = ?';
    await db.query(sql, [status, id]);
  }

  static async updateLastConnection(id) {
    const sql = 'UPDATE camera SET last_connexion = NOW() WHERE id = ?';
    await db.query(sql, [id]);
  }

  static async delete(id) {
    const sql = 'DELETE FROM camera WHERE id = ?';
    await db.query(sql, [id]);
  }

  static async isIpUnique(ip) {
    const sql = 'SELECT * FROM camera WHERE ip = ?';
    const cameras = await db.query(sql, [ip]);
    return cameras.length === 0;
  }
}

module.exports = Camera;
