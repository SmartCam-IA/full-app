const db = require('../config/database');

class Result {
  static async create(resultData) {
    const { fk_image, fk_analyse, result, confidence, severity, details, date } = resultData;
    
    const sql = `
      INSERT INTO resultat_analyse (fk_image, fk_analyse, result, confidence, severity, details, date)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    const res = await db.query(sql, [fk_image, fk_analyse, result, confidence, severity, details, date]);
    return res.insertId;
  }

  static async findById(id) {
    const sql = `
      SELECT r.*, i.uri as image_uri, a.name as analysis_name, a.type_analyse
      FROM resultat_analyse r
      LEFT JOIN image i ON r.fk_image = i.id
      LEFT JOIN analyse a ON r.fk_analyse = a.id
      WHERE r.id = ?
    `;
    const results = await db.query(sql, [id]);
    return results.length > 0 ? results[0] : null;
  }

  static async findAll(filters = {}) {
    let sql = `
      SELECT r.*, i.uri as image_uri, i.date as image_date, 
             a.name as analysis_name, a.type_analyse,
             c.ip as camera_ip
      FROM resultat_analyse r
      LEFT JOIN image i ON r.fk_image = i.id
      LEFT JOIN analyse a ON r.fk_analyse = a.id
      LEFT JOIN camera c ON i.fk_camera = c.id
    `;
    
    const params = [];
    const conditions = [];

    if (filters.result) {
      conditions.push('r.result = ?');
      params.push(filters.result);
    }

    if (filters.is_resolved !== undefined) {
      conditions.push('r.is_resolved = ?');
      params.push(filters.is_resolved);
    }

    if (filters.type_analyse) {
      conditions.push('a.type_analyse = ?');
      params.push(filters.type_analyse);
    }

    if (filters.human_verification !== undefined) {
      conditions.push('r.human_verification = ?');
      params.push(filters.human_verification);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY r.date DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    return await db.query(sql, params);
  }

  static async update(id, updates) {
    const allowedFields = ['human_verification', 'human_rejected', 'is_resolved'];
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
    const sql = `UPDATE resultat_analyse SET ${fields.join(', ')} WHERE id = ?`;
    await db.query(sql, params);
    return true;
  }

  static async getAlertStats() {
    const sql = `
      SELECT 
        a.type_analyse,
        COUNT(*) as total,
        SUM(CASE WHEN r.is_resolved = 0 THEN 1 ELSE 0 END) as unresolved,
        SUM(CASE WHEN r.result = 'positive' THEN 1 ELSE 0 END) as positive
      FROM resultat_analyse r
      LEFT JOIN analyse a ON r.fk_analyse = a.id
      WHERE r.date >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY a.type_analyse
    `;
    return await db.query(sql);
  }
}

module.exports = Result;
