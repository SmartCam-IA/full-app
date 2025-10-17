const mariadb = require('mariadb');
const config = require('./index');
const fs = require('fs').promises;
const path = require('path');

/**
 * Initialize database - create tables from schema.sql if they don't exist
 */
async function initializeDatabase() {
  let conn;
  let rootPool;
  
  try {
    console.log('Initializing database...');
    
    // Connect without specifying a database to create it if needed
    rootPool = mariadb.createPool({
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      multipleStatements: true,
      connectionLimit: 5
    });
    
    conn = await rootPool.getConnection();
    
    // Create database if it doesn't exist
    console.log(`Ensuring database '${config.database.database}' exists...`);
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${config.database.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${config.database.database}\``);
    console.log('✓ Database ready');
    
    // Read schema file
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    
    console.log('Creating/updating tables from schema.sql...');
    
    // Clean and split SQL statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => {
        // Remove empty statements and pure comment lines
        if (!s || s.length === 0) return false;
        const lines = s.split('\n').filter(line => {
          const trimmed = line.trim();
          return trimmed.length > 0 && !trimmed.startsWith('--');
        });
        return lines.length > 0;
      })
      .map(s => {
        // Remove inline comments
        return s.split('\n')
          .map(line => {
            const commentIndex = line.indexOf('--');
            if (commentIndex >= 0) {
              return line.substring(0, commentIndex).trim();
            }
            return line;
          })
          .filter(line => line.length > 0)
          .join('\n');
      });
    
    // Categorize statements by type for proper execution order
    const createTableStatements = [];
    const alterTableStatements = [];
    const insertStatements = [];
    const otherStatements = [];
    
    for (const statement of statements) {
      const lower = statement.toLowerCase().trim();
      
      // Skip DROP statements for safety
      if (lower.startsWith('drop')) {
        console.log('⚠ Skipping DROP statement for safety');
        continue;
      }
      
      if (lower.startsWith('create table')) {
        createTableStatements.push(statement);
      } else if (lower.startsWith('alter table')) {
        alterTableStatements.push(statement);
      } else if (lower.startsWith('insert into')) {
        insertStatements.push(statement);
      } else if (lower.startsWith('create')) {
        otherStatements.push(statement);
      }
    }
    
    let successCount = 0;
    let skipCount = 0;
    
    // Execute in proper order:
    // 1. CREATE TABLE statements first
    console.log('Creating tables...');
    for (const statement of createTableStatements) {
      try {
        await conn.query(statement);
        successCount++;
        console.log('✓ Table created successfully');
      } catch (err) {
        if (err.message.includes('already exists')) {
          skipCount++;
          console.log('⊙ Table already exists');
        } else {
          console.warn('⚠ Warning:', err.message.substring(0, 150));
        }
      }
    }
    
    // 2. ALTER TABLE statements (foreign keys, etc.)
    console.log('Adding constraints...');
    for (const statement of alterTableStatements) {
      try {
        await conn.query(statement);
        successCount++;
        console.log('✓ Constraint added');
      } catch (err) {
        if (
          err.message.includes('already exists') ||
          err.message.includes('Duplicate') ||
          err.message.includes('exists')
        ) {
          skipCount++;
          console.log('⊙ Constraint already exists');
        } else {
          console.warn('⚠ Warning:', err.message.substring(0, 150));
        }
      }
    }
    
    // 3. Other CREATE statements (indexes, views, etc.)
    for (const statement of otherStatements) {
      try {
        await conn.query(statement);
        successCount++;
      } catch (err) {
        if (err.message.includes('already exists')) {
          skipCount++;
        } else {
          console.warn('⚠ Warning:', err.message.substring(0, 150));
        }
      }
    }
    
    // 4. INSERT statements (default data)
    console.log('Inserting default data...');
    for (const statement of insertStatements) {
      try {
        await conn.query(statement);
        successCount++;
        console.log('✓ Default data inserted');
      } catch (err) {
        if (
          err.message.includes('Duplicate entry') ||
          err.message.includes('Duplicate key')
        ) {
          skipCount++;
          console.log('⊙ Data already exists');
        } else {
          console.warn('⚠ Warning:', err.message.substring(0, 150));
        }
      }
    }
    
    // 5. Run migrations for existing databases
    console.log('Running migrations...');
    try {
      // Add port and path columns if they don't exist
      await conn.query(`
        ALTER TABLE camera 
        ADD COLUMN IF NOT EXISTS port INT DEFAULT 554 
        AFTER ip
      `);
      console.log('✓ Migration: port column added/verified');
      successCount++;
    } catch (err) {
      if (err.message.includes('Duplicate column') || err.message.includes('exists')) {
        console.log('⊙ Migration: port column already exists');
        skipCount++;
      } else {
        console.warn('⚠ Migration warning:', err.message.substring(0, 150));
      }
    }
    
    try {
      await conn.query(`
        ALTER TABLE camera 
        ADD COLUMN IF NOT EXISTS path VARCHAR(255) DEFAULT '/live0' 
        AFTER port
      `);
      console.log('✓ Migration: path column added/verified');
      successCount++;
    } catch (err) {
      if (err.message.includes('Duplicate column') || err.message.includes('exists')) {
        console.log('⊙ Migration: path column already exists');
        skipCount++;
      } else {
        console.warn('⚠ Migration warning:', err.message.substring(0, 150));
      }
    }
    
    // Update existing records with default values
    try {
      await conn.query(`UPDATE camera SET port = 554 WHERE port IS NULL`);
      await conn.query(`UPDATE camera SET path = '/live0' WHERE path IS NULL`);
      console.log('✓ Migration: default values updated');
    } catch (err) {
      console.warn('⚠ Migration warning:', err.message.substring(0, 150));
    }
    
    console.log(`✓ Database initialization complete (${successCount} operations applied, ${skipCount} skipped)`);
    
    return true;
  } catch (err) {
    console.error('❌ Error initializing database:', err.message);
    throw err;
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch (e) {
        console.error('Error releasing connection:', e.message);
      }
    }
    if (rootPool) {
      try {
        await rootPool.end();
      } catch (e) {
        console.error('Error closing pool:', e.message);
      }
    }
  }
}

module.exports = { initializeDatabase };
