/**
 * Direct PostgreSQL Test Harness (Zero InMemoryDbStore).
 * Reads TEST_DATABASE_URL (or explicit local DATABASE_URL) and enforces strict
 * protection against accidentally resetting remote Neon/production databases.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const { Pool } = require('pg');
const { closePool, setDefaultPool } = require('../../src/config/db');
const { StudentRepository } = require('../../src/db/student.repository');
const { CourseRepository } = require('../../src/db/course.repository');
const { NotificationRepository, buildContentHash } = require('../../src/db/postgres');

let schemaBootstrapped = false;

function getTestConnectionString() {
  const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
  if (!url || !String(url).trim()) {
    throw new Error(
      'TEST_DATABASE_URL (or local test DATABASE_URL) is required to run Direct PostgreSQL tests.'
    );
  }
  return String(url).trim();
}

function assertSafeTestDatabase(connectionString) {
  if (process.env.ALLOW_TEST_DB_RESET === '1') return;

  let parsed;
  try {
    parsed = new URL(connectionString);
  } catch (err) {
    throw new Error(`Invalid TEST_DATABASE_URL: ${err.message}`);
  }

  const host = (parsed.hostname || '').toLowerCase();
  const dbName = (parsed.pathname || '').replace(/^\//, '').toLowerCase();

  if (host.includes('neon.tech') || host.includes('supabase.co')) {
    throw new Error(
      `REFUSING destructive test reset on remote cloud host "${host}". Point TEST_DATABASE_URL to a local test PostgreSQL database.`
    );
  }

  if (!dbName.endsWith('_test') && dbName !== 'test' && !dbName.includes('test')) {
    throw new Error(
      `REFUSING destructive test reset on non-test database "${dbName}". Database name must include "test" (e.g. dut_notifications_test).`
    );
  }
}

async function createTestPool() {
  const connectionString = getTestConnectionString();
  assertSafeTestDatabase(connectionString);

  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 5000,
  });

  await pool.query('SELECT 1');
  setDefaultPool(pool);
  return pool;
}

async function ensureTestSchema(pool) {
  if (schemaBootstrapped) return;
  const schemaPath = path.join(__dirname, '../../src/db/schema.sql');
  const migrationPath = path.join(__dirname, '../../src/db/migrations/001_align_direct_pg_schema.sql');

  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schemaSql);

  if (fs.existsSync(migrationPath)) {
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    await pool.query(migrationSql);
  }
  schemaBootstrapped = true;
}

async function resetDatabase(pool) {
  const connectionString = getTestConnectionString();
  assertSafeTestDatabase(connectionString);
  await ensureTestSchema(pool);

  await pool.query(`
    TRUNCATE TABLE
      student_notifications,
      student_courses,
      deadlines,
      followed_fb_pages,
      device_tokens,
      notifications,
      courses,
      students
    RESTART IDENTITY CASCADE;
  `);
}

async function seedStudent(pool, overrides = {}) {
  const repo = new StudentRepository(pool);
  const code = String(overrides.student_code || '102200001');
  const defaultId = code === '102200001'
    ? 'a0000000-0000-0000-0000-000000000001'
    : (code === '102230026' ? '5619b2b4-904e-45af-9269-b4c8454a9881' : crypto.randomUUID());

  return repo.upsertStudent({
    id: overrides.id || defaultId,
    firebase_uid: overrides.firebase_uid || `dut_uid_${code}`,
    student_code: code,
    full_name: overrides.full_name || `Sinh viên ${code}`,
    faculty: overrides.faculty || 'Khoa Công nghệ Thông tin',
    cohort: overrides.cohort || 'K23',
    class_name: overrides.class_name || '23T_DT',
    dut_session_encrypted: overrides.dut_session_encrypted || null,
    dut_last_synced_at: overrides.dut_last_synced_at || null,
    is_personalized_enabled: overrides.is_personalized_enabled !== undefined ? overrides.is_personalized_enabled : true,
    interested_topics: overrides.interested_topics || ['hoc_vu', 'hoc_bong', 'tuyen_dung'],
    quick_reminder_options: overrides.quick_reminder_options,
    google_refresh_token: overrides.google_refresh_token || null,
    google_calendar_id: overrides.google_calendar_id || 'primary',
    is_calendar_sync_enabled: Boolean(overrides.is_calendar_sync_enabled),
  });
}

async function seedCourse(pool, overrides = {}) {
  const repo = new CourseRepository(pool);
  return repo.upsertCourse({
    course_code: overrides.course_code || 'IT401',
    course_name: overrides.course_name || 'Công nghệ phần mềm',
    semester: overrides.semester || 'Học kỳ 1 (2026-2027)',
    lecturer_name: overrides.lecturer_name || 'TS. Nguyễn Văn A',
    schedule_info: overrides.schedule_info || 'Thứ 4, Tiết 1-3, F102',
  });
}

async function enrollStudent(pool, studentUuid, courseCode) {
  const repo = new CourseRepository(pool);
  await repo.enrollStudentCourse(studentUuid, courseCode);
}

async function seedNotification(pool, overrides = {}) {
  const repo = new NotificationRepository(pool);
  const title = overrides.title || 'Thông báo kiểm thử hệ thống';
  const sourceChannel = overrides.source_channel || 'DUT_GENERAL';
  const publishedAt = overrides.published_at || new Date().toISOString();
  const contentHash = overrides.content_hash || buildContentHash({
    source_channel: sourceChannel,
    title: `${title}_${crypto.randomUUID()}`,
    published_at: publishedAt,
  });

  return repo.upsertNotification({
    id: overrides.id || crypto.randomUUID(),
    title,
    summary: overrides.summary || title,
    action_required: overrides.action_required || null,
    content: overrides.content || 'Nội dung thông báo kiểm thử',
    source_channel: sourceChannel,
    source_name: overrides.source_name || 'Cổng thông tin DUT',
    classified_by: overrides.classified_by || 'RULE_ENGINE',
    scope: overrides.scope || 'GLOBAL',
    priority: overrides.priority || 'NORMAL',
    priority_score: overrides.priority_score || 30,
    category: overrides.category || 'ACADEMIC',
    category_code: overrides.category_code || 'hoc_tap',
    category_name: overrides.category_name || 'Thông báo học tập',
    course_code: overrides.course_code || null,
    is_emergency: Boolean(overrides.is_emergency),
    tags: overrides.tags || [],
    attachments: overrides.attachments || [],
    source_url: overrides.source_url || null,
    deadline_at: overrides.deadline_at || null,
    content_hash: contentHash,
    published_at: publishedAt,
  });
}

async function teardownTestPool(pool) {
  setDefaultPool(null);
  if (pool) {
    await pool.end().catch(() => {});
  }
  await closePool().catch(() => {});
}

module.exports = {
  getTestConnectionString,
  assertSafeTestDatabase,
  createTestPool,
  ensureTestSchema,
  resetDatabase,
  seedStudent,
  seedCourse,
  enrollStudent,
  seedNotification,
  teardownTestPool,
};
