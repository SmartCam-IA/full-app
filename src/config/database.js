const mariadb = require('mariadb');
const config = require('../config');

const pool = mariadb.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  connectionLimit: config.database.connectionLimit,
});

async function query(sql, params) {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(sql, params);
    return rows;
  } catch (err) {
    console.error('Database query error:', err);
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('Database connected successfully');
    conn.release();
    return true;
  } catch (err) {
    console.error('Database connection failed:', err);
    return false;
  }
}

module.exports = {
  query,
  testConnection,
  pool,
};
