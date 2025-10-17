const db = require('../config/database');

class Analysis {
  static async findAll(filters = {}) {
    let sql = 'SELECT * FROM analyse';
    const params = [];
    const conditions = [];

    if (filters.is_active !== undefined) {
      conditions.push('is_active = ?');
      params.push(filters.is_active);
    }

    if (filters.type_analyse) {
      conditions.push('type_analyse = ?');
      params.push(filters.type_analyse);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    return await db.query(sql, params);
  }

  static async findById(id) {
    const sql = 'SELECT * FROM analyse WHERE id = ?';
    const analyses = await db.query(sql, [id]);
    return analyses.length > 0 ? analyses[0] : null;
  }

  static async create(data) {
    const { name, type_analyse, nbr_positive_necessary, api_endpoint, detection_threshold, image_extraction_interval } = data;
    
    const sql = `
      INSERT INTO analyse (name, type_analyse, nbr_positive_necessary, api_endpoint, detection_threshold, image_extraction_interval)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    const result = await db.query(sql, [
      name, 
      type_analyse, 
      nbr_positive_necessary, 
      api_endpoint, 
      detection_threshold, 
      image_extraction_interval
    ]);
    
    return result.insertId;
  }

  static async update(id, updates) {
    const allowedFields = ['name', 'type_analyse', 'nbr_positive_necessary', 'is_active', 'api_endpoint', 'detection_threshold', 'image_extraction_interval'];
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
    const sql = `UPDATE analyse SET ${fields.join(', ')} WHERE id = ?`;
    await db.query(sql, params);
    return true;
  }

  static async delete(id) {
    const sql = 'DELETE FROM analyse WHERE id = ?';
    await db.query(sql, [id]);
  }
}

module.exports = Analysis;
