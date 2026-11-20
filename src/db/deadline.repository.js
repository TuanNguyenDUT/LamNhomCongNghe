/**
 * Deadline Repository: Direct PostgreSQL persistence for deadlines & reminders.
 */

const crypto = require('node:crypto');
const { db: defaultDb, createDbAdapter } = require('../config/db');
const { isUuid } = require('./student.repository');

function normalizeDeadlineTitle(title = '') {
  return String(title || '')
    .trim()
    .replace(/^\[(?:hạn chót|nhắc nhở)\]\s*/i, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeDeadlineRow(row) {
  if (!row) return null;
  const copy = { ...row };
  if (copy.due_date instanceof Date) copy.due_date = copy.due_date.toISOString();
  if (copy.last_synced_at instanceof Date) copy.last_synced_at = copy.last_synced_at.toISOString();
  if (copy.created_at instanceof Date) copy.created_at = copy.created_at.toISOString();
  if (copy.updated_at instanceof Date) copy.updated_at = copy.updated_at.toISOString();
  if (copy.reminder_stage_sent !== undefined && copy.reminder_stage_sent !== null) {
    copy.reminder_stage_sent = Number(copy.reminder_stage_sent);
  }
  return copy;
}

class DeadlineRepository {
  constructor(poolOrDb = null) {
    this.db = poolOrDb && typeof poolOrDb.query === 'function'
      ? poolOrDb
      : (poolOrDb ? createDbAdapter(poolOrDb) : defaultDb);
  }

  async findDuplicateDeadline(studentUuid, { notificationId = null, cleanTitle = '' } = {}, client = null) {
    if (!isUuid(studentUuid)) return null;
    const runner = client || this.db;
    const { rows } = await runner.query(
      'SELECT * FROM deadlines WHERE student_id = $1::uuid ORDER BY created_at ASC',
      [studentUuid]
    );
    for (const raw of rows) {
      const d = normalizeDeadlineRow(raw);
      const dCleanTitle = normalizeDeadlineTitle(d.title);
      const sameNotif = notificationId && d.notification_id && d.notification_id === notificationId;
      const sameTitle = cleanTitle && dCleanTitle === cleanTitle;
      if (sameNotif || sameTitle) {
        return d;
      }
    }
    return null;
  }

  async saveDeadline(deadline, client = null) {
    const runner = client || this.db;
    const id = isUuid(deadline.deadline_id) ? deadline.deadline_id : crypto.randomUUID();
    const studentUuid = deadline.student_id;
    const notifUuid = isUuid(deadline.notification_id) ? deadline.notification_id : null;

    const { rows } = await runner.query(
      `INSERT INTO deadlines (
         deadline_id, student_id, notification_id, course_code,
         category, category_code, category_name, item_type,
         title, description, due_date, status,
         google_event_id, last_synced_at, reminder_stage_sent,
         created_at, updated_at
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4,
         $5, $6, $7, $8,
         $9, $10, $11, $12,
         $13, $14, $15,
         COALESCE($16::timestamptz, NOW()), NOW()
       )
       ON CONFLICT (deadline_id) DO UPDATE SET
         notification_id = COALESCE(EXCLUDED.notification_id, deadlines.notification_id),
         course_code = COALESCE(EXCLUDED.course_code, deadlines.course_code),
         category = COALESCE(EXCLUDED.category, deadlines.category),
         category_code = COALESCE(EXCLUDED.category_code, deadlines.category_code),
         category_name = COALESCE(EXCLUDED.category_name, deadlines.category_name),
         item_type = COALESCE(EXCLUDED.item_type, deadlines.item_type),
         title = EXCLUDED.title,
         description = EXCLUDED.description,
         due_date = EXCLUDED.due_date,
         status = EXCLUDED.status,
         google_event_id = EXCLUDED.google_event_id,
         last_synced_at = EXCLUDED.last_synced_at,
         reminder_stage_sent = EXCLUDED.reminder_stage_sent,
         updated_at = NOW()
       RETURNING *`,
      [
        id,
        studentUuid,
        notifUuid,
        deadline.course_code || null,
        deadline.category || 'ACADEMIC',
        deadline.category_code || 'hoc_tap',
        deadline.category_name || 'Thông báo học tập',
        deadline.item_type || 'DEADLINE',
        deadline.title,
        deadline.description || '',
        deadline.due_date,
        deadline.status || 'PENDING',
        deadline.google_event_id !== undefined ? deadline.google_event_id : null,
        deadline.last_synced_at !== undefined ? deadline.last_synced_at : null,
        Number(deadline.reminder_stage_sent || 0),
        deadline.created_at || null,
      ]
    );
    return normalizeDeadlineRow(rows[0]);
  }

  async getDeadlineById(deadlineId, client = null) {
    if (!isUuid(deadlineId)) return null;
    const runner = client || this.db;
    const { rows } = await runner.query(
      'SELECT * FROM deadlines WHERE deadline_id = $1::uuid LIMIT 1',
      [deadlineId]
    );
    return normalizeDeadlineRow(rows[0]);
  }

  async getDeadlinesByStudent(studentUuid, filters = {}, client = null) {
    if (!isUuid(studentUuid)) return [];
    const runner = client || this.db;
    const conditions = ['d.student_id = $1::uuid'];
    const params = [studentUuid];

    if (filters.status) {
      params.push(filters.status);
      conditions.push(`d.status = $${params.length}`);
    }
    if (filters.course_code) {
      params.push(filters.course_code);
      conditions.push(`d.course_code = $${params.length}`);
    }

    const { rows } = await runner.query(
      `SELECT d.*,
              n.category AS notif_category,
              n.category_code AS notif_category_code,
              n.category_name AS notif_category_name
       FROM deadlines d
       LEFT JOIN notifications n ON n.id = d.notification_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY d.due_date ASC`,
      params
    );
    return rows.map((row) => {
      const item = normalizeDeadlineRow(row);
      if (!item.category && item.notif_category) {
        item.category = item.notif_category;
        item.category_code = item.notif_category_code;
        item.category_name = item.notif_category_name;
      }
      delete item.notif_category;
      delete item.notif_category_code;
      delete item.notif_category_name;
      return item;
    });
  }

  async deleteDeadline(deadlineId, client = null) {
    if (!isUuid(deadlineId)) return null;
    const runner = client || this.db;
    const { rows } = await runner.query(
      'DELETE FROM deadlines WHERE deadline_id = $1::uuid RETURNING *',
      [deadlineId]
    );
    return normalizeDeadlineRow(rows[0]);
  }

  async listNonCompletedDeadlines(client = null) {
    const runner = client || this.db;
    const { rows } = await runner.query(
      `SELECT * FROM deadlines WHERE status <> 'COMPLETED' ORDER BY due_date ASC`
    );
    return rows.map(normalizeDeadlineRow);
  }
}

const deadlineRepository = new DeadlineRepository();

module.exports = {
  DeadlineRepository,
  deadlineRepository,
  normalizeDeadlineTitle,
  normalizeDeadlineRow,
};
