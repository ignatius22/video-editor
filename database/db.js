const { Pool } = require('pg');

// Database configuration
const config = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'video_editor',
  user: process.env.DB_USER || 'mac',
  password: process.env.DB_PASSWORD || 'mac',

  // Connection pool settings
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 2000, // Return an error after 2 seconds if connection could not be established
};

// Create connection pool
const pool = new Pool(config);

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// Test connection on startup
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    console.error('Make sure PostgreSQL is running and credentials are correct');
  } else {
    console.log('✅ Database connected successfully at', res.rows[0].now);
  }
});

/**
 * Execute a SQL query
 * @param {string} text - SQL query
 * @param {array} params - Query parameters
 * @returns {Promise<object>} Query result
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries (> 1000ms)
    if (duration > 1000) {
      console.warn(`⚠️  Slow query (${duration}ms):`, text);
    }

    return res;
  } catch (error) {
    console.error('Database query error:', error.message);
    console.error('Query:', text);
    console.error('Params:', params);
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<PoolClient>} Database client
 */
async function getClient() {
  const client = await pool.connect();
  const originalQuery = client.query;
  const originalRelease = client.release;

  // Track queries for this client
  const queries = [];

  // Monkey patch the query method
  client.query = (...args) => {
    queries.push(args);
    return originalQuery.apply(client, args);
  };

  // Monkey patch the release method
  client.release = () => {
    // Clear the query queue
    queries.length = 0;
    // Set the methods back to their old un-monkey-patched version
    client.query = originalQuery;
    client.release = originalRelease;
    return originalRelease.apply(client);
  };

  // Add transaction helpers
  client.beginTransaction = async () => {
    await client.query('BEGIN');
  };

  client.commit = async () => {
    await client.query('COMMIT');
  };

  client.rollback = async () => {
    await client.query('ROLLBACK');
  };

  return client;
}

/**
 * Execute a transaction
 * @param {function} callback - Transaction callback function
 * @returns {Promise<any>} Result from callback
 */
async function transaction(callback) {
  const client = await getClient();

  try {
    await client.beginTransaction();
    const result = await callback(client);
    await client.commit();
    return result;
  } catch (error) {
    await client.rollback();
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Close all database connections
 */
async function close() {
  await pool.end();
  console.log('Database connection pool closed');
}

// Export pool and helper functions
module.exports = {
  pool,
  query,
  getClient,
  transaction,
  close
};
