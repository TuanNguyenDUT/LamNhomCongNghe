/**
 * Direct PostgreSQL Connection Pool & Transactional Query Helpers.
 * Fail-fast when PostgreSQL configuration is missing or unreachable.
 */

const dns = require('node:dns');
const { Pool } = require('pg');
const { DatabaseConfigurationError } = require('../utils/errors');

// Force IPv4 DNS resolution for cloud PostgreSQL hosts when running inside Docker without IPv6 routing
const originalLookup = dns.lookup;
dns.lookup = function (hostname, options, callback) {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  if (typeof options === 'number') {
    options = { family: options };
  } else if (!options) {
    options = {};
  }
  if (
    !options.family &&
    typeof hostname === 'string' &&
    (hostname.includes('neon.tech') || hostname.includes('supabase.co') || hostname.includes('aws.'))
  ) {
    options.family = 4;
  }
  return originalLookup.call(dns, hostname, options, callback);
};

let globalPool = null;
let globalPoolKey = null;

function shouldUseSsl(connectionString = '') {
  const mode = String(process.env.PGSSLMODE || '').toLowerCase();
  if (mode === 'require' || mode === 'verify-full' || mode === 'verify-ca') return true;
  if (mode === 'disable') return false;
  return Boolean(
    connectionString &&
    (connectionString.includes('neon.tech') || connectionString.includes('sslmode=require'))
  );
}

function buildPoolConfig() {
  const isTest = process.env.NODE_ENV === 'test' || Boolean(process.env.TEST_DATABASE_URL);
  const connectionString = isTest
    ? (process.env.TEST_DATABASE_URL || process.env.DATABASE_URL)
    : process.env.DATABASE_URL;

  if (connectionString && String(connectionString).trim()) {
    const cleanUrl = String(connectionString).trim();
    return {
      key: `url:${cleanUrl}`,
      config: {
        connectionString: cleanUrl,
        ssl: shouldUseSsl(cleanUrl) ? { rejectUnauthorized: false } : undefined,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      },
    };
  }

  if (process.env.PGHOST && String(process.env.PGHOST).trim()) {
    const host = String(process.env.PGHOST).trim();
    const port = process.env.PGPORT ? Number(process.env.PGPORT) : 5432;
    const database = process.env.PGDATABASE || 'dut_notifications';
    const user = process.env.PGUSER || 'postgres';
    const password = process.env.PGPASSWORD || 'postgres';
    return {
      key: `pg:${user}@${host}:${port}/${database}`,
      config: {
        host,
        port,
        database,
        user,
        password,
        ssl: shouldUseSsl('') ? { rejectUnauthorized: false } : undefined,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      },
    };
  }

  throw new DatabaseConfigurationError(
    'PostgreSQL configuration missing: set DATABASE_URL, TEST_DATABASE_URL, or PGHOST'
  );
}

function getPool() {
  if (globalPool && globalPoolKey === 'custom') {
    return globalPool;
  }
  const { key, config } = buildPoolConfig();
  if (globalPool && globalPoolKey === key) {
    return globalPool;
  }
  if (globalPool && globalPoolKey !== key) {
    const oldPool = globalPool;
    globalPool = null;
    oldPool.end().catch(() => {});
  }

  globalPool = new Pool(config);
  globalPoolKey = key;
  globalPool.on('error', (err) => {
    console.error('Lỗi kết nối PostgreSQL pool:', err);
  });
  return globalPool;
}

function setDefaultPool(pool) {
  globalPool = pool;
  globalPoolKey = pool ? 'custom' : null;
}

async function query(text, params = []) {
  return getPool().query(text, params);
}

async function getClient() {
  return getPool().connect();
}

async function withTransaction(fn, pool = null) {
  const targetPool = pool || getPool();
  const client = await targetPool.connect();
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

async function verifyDbConnection(pool = getPool()) {
  await pool.query('SELECT 1');
  const { rows } = await pool.query(`SELECT to_regclass('public.students') AS students_table`);
  if (!rows[0]?.students_table) {
    throw new DatabaseConfigurationError(
      'PostgreSQL schema missing: table "students" does not exist. Apply src/db/schema.sql first.'
    );
  }
  return true;
}

async function closePool() {
  if (globalPool) {
    const p = globalPool;
    globalPool = null;
    globalPoolKey = null;
    await p.end();
  }
}

function createDbAdapter(poolOrGetter = null) {
  const resolvePool = () => {
    if (!poolOrGetter) return getPool();
    return typeof poolOrGetter === 'function' ? poolOrGetter() : poolOrGetter;
  };
  return {
    getPool: resolvePool,
    query: (text, params = []) => resolvePool().query(text, params),
    getClient: () => resolvePool().connect(),
    withTransaction: (fn) => withTransaction(fn, resolvePool()),
  };
}

const db = createDbAdapter();

module.exports = {
  db,
  createDbAdapter,
  getPool,
  setDefaultPool,
  query,
  getClient,
  withTransaction,
  verifyDbConnection,
  closePool,
  DatabaseConfigurationError,
};
