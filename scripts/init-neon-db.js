const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const neonUrl = 'postgresql://neondb_owner:npg_qgHmRG6DWkA2@ep-divine-heart-bcjw6y4h-pooler.c-16.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function main() {
  console.log('Connecting to Neon PostgreSQL...');
  const pool = new Pool({
    connectionString: neonUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });

  try {
    const timeRes = await pool.query('SELECT NOW() as current_time');
    console.log('Connected successfully! Server time:', timeRes.rows[0].current_time);

    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    const tables = tablesRes.rows.map(r => r.table_name);
    console.log('Existing tables in Neon DB:', tables);

    const schemaPath = path.join(__dirname, '../src/db/schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log('Running schema.sql to ensure all tables, ENUMs and indexes exist...');
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await pool.query(schemaSql);
      console.log('schema.sql executed successfully!');

      const verifyRes = await pool.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name;
      `);
      console.log('Updated tables in Neon DB:', verifyRes.rows.map(r => r.table_name));
    }
  } catch (err) {
    console.error('Error with Neon DB:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
