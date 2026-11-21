/**
 * Student Repository & Canonical Student Identifier -> UUID Resolver.
 * Resolves UUID (students.id), student_code, or firebase_uid safely using
 * JS-branched SQL so PostgreSQL never hits 22P02 mixed parameter-type errors.
 */

const crypto = require('node:crypto');
const { db: defaultDb, createDbAdapter } = require('../config/db');
const { ValidationError, NotFoundError } = require('../utils/errors');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value.trim());
}

function normalizeStudentRow(row) {
  if (!row) return null;
  const copy = { ...row };
  if (typeof copy.interested_topics === 'string') {
    try {
      copy.interested_topics = JSON.parse(copy.interested_topics);
    } catch (_) {}
  }
  if (!Array.isArray(copy.interested_topics)) {
    copy.interested_topics = ['hoc_vu', 'hoc_bong', 'tuyen_dung'];
  }
  if (typeof copy.quick_reminder_options === 'string') {
    try {
      copy.quick_reminder_options = JSON.parse(copy.quick_reminder_options);
    } catch (_) {}
  }
  if (!Array.isArray(copy.quick_reminder_options)) {
    copy.quick_reminder_options = ['1_hour', 'tonight', 'tomorrow_morning', '1_day', '3_days', '1_week'];
  }
  if (typeof copy.fcm_tokens === 'string') {
    try {
      copy.fcm_tokens = JSON.parse(copy.fcm_tokens);
    } catch (_) {}
  }
  if (copy.dut_last_synced_at instanceof Date) {
    copy.dut_last_synced_at = copy.dut_last_synced_at.toISOString();
  }
  if (copy.created_at instanceof Date) {
    copy.created_at = copy.created_at.toISOString();
  }
  if (copy.updated_at instanceof Date) {
    copy.updated_at = copy.updated_at.toISOString();
  }
  return copy;
}

class StudentRepository {
  constructor(poolOrDb = null) {
    this.db = poolOrDb && typeof poolOrDb.query === 'function'
      ? poolOrDb
      : (poolOrDb ? createDbAdapter(poolOrDb) : defaultDb);
  }

  async resolveStudent(identifier, client = null) {
    const runner = client || this.db;
    const clean = String(identifier || '').trim();
    if (!clean) return null;

    if (isUuid(clean)) {
      const { rows } = await runner.query(
        'SELECT * FROM students WHERE id = $1::uuid LIMIT 1',
        [clean]
      );
      return normalizeStudentRow(rows[0]);
    }

    const { rows } = await runner.query(
      'SELECT * FROM students WHERE student_code = $1 OR firebase_uid = $1 LIMIT 1',
      [clean]
    );
    return normalizeStudentRow(rows[0]);
  }

  async requireStudent(identifier, client = null) {
    const clean = String(identifier || '').trim();
    if (!clean) {
      throw new ValidationError('Thiếu mã định danh sinh viên (student_id / student_code / firebase_uid)');
    }
    const student = await this.resolveStudent(clean, client);
    if (!student) {
      throw new NotFoundError(`Không tìm thấy sinh viên với định danh: ${clean}`);
    }
    return student;
  }

  async upsertStudent(student, client = null) {
    const runner = client || this.db;
    const code = String(student.student_code || '').trim();
    if (!code) {
      throw new ValidationError('student_code là bắt buộc để lưu hồ sơ sinh viên');
    }

    const id = isUuid(student.id) ? student.id.trim() : crypto.randomUUID();
    const firebaseUid = String(student.firebase_uid || `dut_uid_${code}`).trim();
    const interestedTopics = Array.isArray(student.interested_topics)
      ? student.interested_topics
      : ['hoc_vu', 'hoc_bong', 'tuyen_dung'];
    const quickOptions = Array.isArray(student.quick_reminder_options)
      ? student.quick_reminder_options
      : ['1_hour', 'tonight', 'tomorrow_morning', '1_day', '3_days', '1_week'];
    const fcmTokens = Array.isArray(student.fcm_tokens) ? student.fcm_tokens : [];

    const { rows } = await runner.query(
      `INSERT INTO students (
         id, firebase_uid, student_code, full_name, faculty, cohort, class_name,
         dut_session_encrypted, dut_last_synced_at, fcm_tokens,
         google_refresh_token, google_calendar_id, is_calendar_sync_enabled,
         is_personalized_enabled, interested_topics, quick_reminder_options,
         major, program, avatar_url, dob, gender, school_email, personal_email, phone,
         updated_at
       ) VALUES (
         $1::uuid, $2, $3, $4, $5, $6, $7,
         $8, $9, $10::jsonb,
         $11, $12, $13,
         $14, $15::jsonb, $16::jsonb,
         $17, $18, $19, $20, $21, $22, $23, $24,
         NOW()
       )
       ON CONFLICT (student_code) DO UPDATE SET
         full_name = EXCLUDED.full_name,
         faculty = EXCLUDED.faculty,
         cohort = EXCLUDED.cohort,
         class_name = COALESCE(EXCLUDED.class_name, students.class_name),
         dut_session_encrypted = COALESCE(EXCLUDED.dut_session_encrypted, students.dut_session_encrypted),
         dut_last_synced_at = COALESCE(EXCLUDED.dut_last_synced_at, students.dut_last_synced_at),
         fcm_tokens = COALESCE(EXCLUDED.fcm_tokens, students.fcm_tokens),
         google_refresh_token = COALESCE(EXCLUDED.google_refresh_token, students.google_refresh_token),
         google_calendar_id = COALESCE(EXCLUDED.google_calendar_id, students.google_calendar_id),
         is_calendar_sync_enabled = COALESCE(EXCLUDED.is_calendar_sync_enabled, students.is_calendar_sync_enabled),
         is_personalized_enabled = EXCLUDED.is_personalized_enabled,
         interested_topics = EXCLUDED.interested_topics,
         quick_reminder_options = EXCLUDED.quick_reminder_options,
         major = COALESCE(EXCLUDED.major, students.major),
         program = COALESCE(EXCLUDED.program, students.program),
         avatar_url = COALESCE(EXCLUDED.avatar_url, students.avatar_url),
         dob = COALESCE(EXCLUDED.dob, students.dob),
         gender = COALESCE(EXCLUDED.gender, students.gender),
         school_email = COALESCE(EXCLUDED.school_email, students.school_email),
         personal_email = COALESCE(EXCLUDED.personal_email, students.personal_email),
         phone = COALESCE(EXCLUDED.phone, students.phone),
         updated_at = NOW()
       RETURNING *`,
      [
        id,
        firebaseUid,
        code,
        student.full_name || `Sinh viên ${code}`,
        student.faculty || 'Khoa Công nghệ Thông tin',
        student.cohort || 'K23',
        student.class_name || null,
        student.dut_session_encrypted || null,
        student.dut_last_synced_at || null,
        JSON.stringify(fcmTokens),
        student.google_refresh_token || null,
        student.google_calendar_id || 'primary',
        Boolean(student.is_calendar_sync_enabled),
        student.is_personalized_enabled !== false,
        JSON.stringify(interestedTopics),
        JSON.stringify(quickOptions),
        student.major || null,
        student.program || null,
        student.avatar_url || null,
        student.dob || null,
        student.gender || null,
        student.school_email || null,
        student.personal_email || null,
        student.phone || null,
      ]
    );
    return normalizeStudentRow(rows[0]);
  }

  async updatePreferences(identifier, prefs = {}) {
    const student = await this.requireStudent(identifier);
    const isPersonalized = prefs.is_personalized_enabled !== undefined
      ? Boolean(prefs.is_personalized_enabled)
      : student.is_personalized_enabled !== false;
    const interestedTopics = Array.isArray(prefs.interested_topics)
      ? prefs.interested_topics
      : student.interested_topics;
    const isCalendarSync = prefs.is_calendar_sync_enabled !== undefined
      ? Boolean(prefs.is_calendar_sync_enabled)
      : Boolean(student.is_calendar_sync_enabled);
    const quickOptions = Array.isArray(prefs.quick_reminder_options)
      ? prefs.quick_reminder_options
      : student.quick_reminder_options;

    const { rows } = await this.db.query(
      `UPDATE students
       SET is_personalized_enabled = $2,
           interested_topics = $3::jsonb,
           is_calendar_sync_enabled = $4,
           quick_reminder_options = $5::jsonb,
           updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING *`,
      [
        student.id,
        isPersonalized,
        JSON.stringify(interestedTopics),
        isCalendarSync,
        JSON.stringify(quickOptions),
      ]
    );
    return normalizeStudentRow(rows[0]);
  }

  async updateGoogleTokens(studentUuid, { refreshToken, calendarId = 'primary', enabled = true }) {
    const { rows } = await this.db.query(
      `UPDATE students
       SET google_refresh_token = $2,
           google_calendar_id = $3,
           is_calendar_sync_enabled = $4,
           updated_at = NOW()
       WHERE id = $1::uuid
       RETURNING *`,
      [studentUuid, refreshToken, calendarId || 'primary', Boolean(enabled)]
    );
    if (!rows[0]) {
      throw new NotFoundError(`Không tìm thấy sinh viên với UUID: ${studentUuid}`);
    }
    return normalizeStudentRow(rows[0]);
  }

  async listAllStudents(client = null) {
    const runner = client || this.db;
    const { rows } = await runner.query('SELECT * FROM students ORDER BY created_at ASC');
    return rows.map(normalizeStudentRow);
  }
}

const studentRepository = new StudentRepository();

module.exports = {
  UUID_REGEX,
  isUuid,
  normalizeStudentRow,
  StudentRepository,
  studentRepository,
};
