const { Pool, types } = require('pg');
const cfg = require('./config');

types.setTypeParser(1082, (v) => v);

const pool = new Pool({ ...cfg.db, max: 10, idleTimeoutMillis: 30000 });

async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query: (text, params) => pool.query(text, params), tx };
