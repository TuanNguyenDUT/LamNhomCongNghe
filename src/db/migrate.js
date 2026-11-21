const fs = require('node:fs');
const path = require('node:path');

async function migrate(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT pg_advisory_xact_lock(hashtext('dut-schema-migrations'))");
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    for (const name of fs.readdirSync(path.join(__dirname, 'migrations')).filter(n => n.endsWith('.sql')).sort()) {
      const result = await client.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
      if (result.rowCount) continue;
      await client.query(fs.readFileSync(path.join(__dirname, 'migrations', name), 'utf8'));
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
module.exports = { migrate };
