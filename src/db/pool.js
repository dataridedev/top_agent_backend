'use strict';
const { Pool } = require('pg');
const config   = require('../config');

const pool = new Pool({
  host:     config.db.host,
  port:     config.db.port,
  database: config.db.name,
  user:     config.db.user,
  password: config.db.password,
  max:      config.db.pool.max,
  idleTimeoutMillis:       config.db.pool.idleTimeoutMillis,
  connectionTimeoutMillis: config.db.pool.connectionTimeoutMillis,
});

pool.on('connect', () => {
  if (config.env === 'development') console.log('[DB] New client connected');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected error on idle client', err);
  process.exit(-1);
});

/**
 * Execute a single query.
 * @param {string} text   SQL string
 * @param {Array}  params Parameterised values
 */
const query = (text, params) => pool.query(text, params);

/**
 * Grab a client for multi-statement transactions.
 * Always call client.release() in a finally block.
 */
const getClient = () => pool.connect();

/**
 * Run multiple queries inside a single transaction.
 * @param {Function} fn  async (client) => result
 */
const withTransaction = async (fn) => {
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
};

module.exports = { query, getClient, withTransaction, pool };
