/**
 * Direct PostgreSQL Repository for notifications & student_notifications.
 * Aligned strictly with src/db/schema.sql (UUID keys, source_channel, scope).
 */

const crypto = require('node:crypto');
const { db: defaultDb, createDbAdapter, withTransaction } = require('../config/db');
const { classifyNotification } = require('../services/classifier.service');
const { studentRepository, isUuid } = require('./student.repository');
const { ValidationError, NotFoundError } = require('../utils/errors');

const DEFAULT_SOURCES = [
  {
    source_id: 1,
    source_code: 'DUT_GENERAL',
    source_channel: 'DUT_GENERAL',
    source_name: 'Thông báo chung (Cổng DUT)',
    source_type: 'DUT_GENERAL',
    default_weight: 25,
    is_active: true,
  },
  {
    source_id: 2,
    source_code: 'DUT_TRAINING',
    source_channel: 'DUT_TRAINING',
    source_name: 'Phòng Đào tạo Đại học',
    source_type: 'DUT_TRAINING',
    default_weight: 25,
    is_active: true,
  },
  {
    source_id: 3,
    source_code: 'DUT_COURSE_CLASS',
    source_channel: 'DUT_COURSE_CLASS',
    source_name: 'Lớp học phần (Giảng viên)',
    source_type: 'DUT_COURSE_CLASS',
    default_weight: 30,
    is_active: true,
  },
  {
    source_id: 4,
    source_code: 'DUT_STUDENT_AFFAIRS',
    source_channel: 'DUT_STUDENT_AFFAIRS',
    source_name: 'Phòng Công tác Sinh viên',
    source_type: 'DUT_STUDENT_AFFAIRS',
    default_weight: 22,
    is_active: true,
  },
  {
    source_id: 5,
    source_code: 'DUT_TESTING_QA',
    source_channel: 'DUT_TESTING_QA',
    source_name: 'Phòng Khảo thí & ĐBCL',
    source_type: 'DUT_TESTING_QA',
    default_weight: 22,
    is_active: true,
  },
  {
    source_id: 6,
    source_code: 'DUT_TUITION_FEE',
    source_channel: 'DUT_TUITION_FEE',
    source_name: 'Học phí & Kế hoạch Tài chính',
    source_type: 'DUT_TUITION_FEE',
    default_weight: 25,
    is_active: true,
  },
  {
    source_id: 7,
    source_code: 'DUT_REGULATIONS',
    source_channel: 'DUT_REGULATIONS',
    source_name: 'Quy chế & Quy định',
    source_type: 'DUT_REGULATIONS',
    default_weight: 18,
    is_active: true,
  },
  {
    source_id: 8,
    source_code: 'FB_CTSV',
    source_channel: 'FB_CTSV',
    source_name: 'Fanpage Phòng Công tác Sinh viên',
    source_type: 'FB_CTSV',
    default_weight: 18,
    is_active: true,
  },
  {
    source_id: 9,
    source_code: 'FB_TUVAN_SV',
    source_channel: 'FB_TUVAN_SV',
    source_name: 'Fanpage Tư vấn Sinh viên DUT',
    source_type: 'FB_TUVAN_SV',
    default_weight: 16,
    is_active: true,
  },
];

const SOURCE_CHANNEL_ALIASES = {
  TRAINING_DEPT: 'DUT_TRAINING',
  PORTAL_PDT: 'DUT_TRAINING',
  FACULTY: 'DUT_GENERAL',
  FACULTY_IT: 'DUT_GENERAL',
  CLASS_SECTION: 'DUT_COURSE_CLASS',
  LMS_CLASS: 'DUT_COURSE_CLASS',
  STUDENT_EMAIL: 'DUT_GENERAL',
  EMAIL_SV: 'DUT_GENERAL',
  EXTRACURRICULAR: 'DUT_STUDENT_AFFAIRS',
  CLUB_EXTRA: 'DUT_STUDENT_AFFAIRS',
  DUT_CHUNG: 'DUT_GENERAL',
};

function normalizeSourceChannel(channel) {
  const raw = String(channel || 'DUT_GENERAL').trim();
  return SOURCE_CHANNEL_ALIASES[raw] || raw || 'DUT_GENERAL';
}

function mapScopeToDb(scope) {
  const raw = String(scope || 'GLOBAL').trim().toUpperCase();
  if (raw === 'CLASS') return 'COURSE';
  if (raw === 'GENERAL') return 'GLOBAL';
  if (['GLOBAL', 'FACULTY', 'COHORT', 'COURSE', 'PERSONAL'].includes(raw)) {
    return raw;
  }
  return 'GLOBAL';
}

function mapPriorityToDb(priority) {
  const raw = String(priority || 'NORMAL').trim().toUpperCase();
  if (['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(raw)) return raw;
  return 'NORMAL';
}

function parseJsonColumn(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }
  return value;
}

function sanitizeUtf16(value) {
  if (typeof value !== 'string') return value;
  if (typeof value.toWellFormed === 'function') {
    return value.toWellFormed();
  }
  return value.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/g, (m) =>
    m.length === 2 ? `${m[0]}\uFFFD` : '\uFFFD'
  );
}

function safeJsonStringify(value) {
  return JSON.stringify(value, (_key, val) => (typeof val === 'string' ? sanitizeUtf16(val) : val));
}

function normalizeNotificationRow(row) {
  if (!row) return null;
  const copy = { ...row };
  copy.tags = parseJsonColumn(copy.tags, []);
  copy.attachments = parseJsonColumn(copy.attachments, []);
  copy.reschedule_details = parseJsonColumn(copy.reschedule_details, null);
  if (copy.published_at instanceof Date) copy.published_at = copy.published_at.toISOString();
  if (copy.created_at instanceof Date) copy.created_at = copy.created_at.toISOString();
  if (copy.deadline_at instanceof Date) copy.deadline_at = copy.deadline_at.toISOString();
  if (copy.read_at instanceof Date) copy.read_at = copy.read_at.toISOString();
  if (copy.acknowledged_at instanceof Date) copy.acknowledged_at = copy.acknowledged_at.toISOString();

  // Compatibility fields
  copy.notification_id = copy.id;
  copy.source_type = copy.source_type || copy.source_channel;
  copy.scope_type = copy.scope_type || copy.scope;
  return copy;
}

function buildContentHash({ source_type, source_channel, title, published_at }) {
  const channel = normalizeSourceChannel(source_channel || source_type);
  const datePart = String(published_at || new Date().toISOString()).slice(0, 10);
  const raw = `${channel}|${String(title || '').trim().toLowerCase()}|${datePart}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

class NotificationRepository {
  constructor(poolOrDb = null) {
    this.db = poolOrDb && typeof poolOrDb.query === 'function'
      ? poolOrDb
      : (poolOrDb ? createDbAdapter(poolOrDb) : defaultDb);
    this.studentRepo = new (require('./student.repository').StudentRepository)(this.db);
  }

  async getSources() {
    // Verify DB connectivity even on catalog read so fail-fast is consistent
    await this.db.query('SELECT 1');
    return DEFAULT_SOURCES;
  }

  async findByHash(contentHash, client = null) {
    const runner = client || this.db;
    const { rows } = await runner.query(
      'SELECT * FROM notifications WHERE content_hash = $1 LIMIT 1',
      [contentHash]
    );
    return normalizeNotificationRow(rows[0]);
  }

  async listByChannels(channels = [], client = null) {
    const runner = client || this.db;
    const { rows } = await runner.query(
      'SELECT * FROM notifications WHERE source_channel = ANY($1::text[]) ORDER BY published_at DESC',
      [channels]
    );
    return rows.map(normalizeNotificationRow);
  }

  async listAllNotifications(client = null) {
    const runner = client || this.db;
    const { rows } = await runner.query(
      'SELECT * FROM notifications ORDER BY is_emergency DESC, published_at DESC'
    );
    return rows.map(normalizeNotificationRow);
  }

  async listByCourse(courseCode, studentUuid = null, client = null) {
    const runner = client || this.db;
    const params = [courseCode, `#${courseCode}`];
    if (studentUuid && isUuid(studentUuid)) {
      params.push(studentUuid);
      const { rows } = await runner.query(
        `SELECT n.*,
                COALESCE(sn.is_read, FALSE) AS is_read,
                COALESCE(sn.is_acknowledged, FALSE) AS is_acknowledged
         FROM notifications n
         LEFT JOIN student_notifications sn
           ON sn.notification_id = n.id AND sn.student_id = $3::uuid
         WHERE n.course_code = $1 OR n.tags ? $2
         ORDER BY n.published_at DESC`,
        params
      );
      return rows.map(normalizeNotificationRow);
    }

    const { rows } = await runner.query(
      `SELECT n.*, FALSE AS is_read, FALSE AS is_acknowledged
       FROM notifications n
       WHERE n.course_code = $1 OR n.tags ? $2
       ORDER BY n.published_at DESC`,
      params
    );
    return rows.map(normalizeNotificationRow);
  }

  async upsertNotification(notification, client = null) {
    const runner = client || this.db;
    const id = isUuid(notification.id) ? notification.id : crypto.randomUUID();
    const channel = normalizeSourceChannel(notification.source_channel || notification.source_type);
    const scope = mapScopeToDb(notification.scope || notification.scope_type);
    const priority = mapPriorityToDb(notification.priority);
    const targetStudentUuid = isUuid(notification.target_student_id) ? notification.target_student_id : null;

    // Only keep course_code FK if course exists in courses table (avoid FK violation for un-enrolled regex tags like IT302)
    let validCourseCode = notification.course_code || null;
    if (validCourseCode) {
      const courseCheck = await runner.query(
        'SELECT course_code FROM courses WHERE course_code = $1 LIMIT 1',
        [validCourseCode]
      );
      if (courseCheck.rows.length === 0) {
        validCourseCode = null;
      }
    }

    const { rows } = await runner.query(
      `INSERT INTO notifications (
         id, title, summary, action_required, content, source_channel, source_name,
         classified_by, scope, priority, priority_score,
         category, category_code, category_name,
         course_code, target_faculty, target_cohort, target_student_id,
         is_emergency, tags, attachments, reschedule_details,
         source_url, deadline_at, content_hash, published_at, created_at
       ) VALUES (
         $1::uuid, $2, $3, $4, $5, $6, $7,
         $8, $9::notification_scope_type, $10::notification_priority_level, $11,
         $12, $13, $14,
         $15, $16, $17, $18::uuid,
         $19, $20::jsonb, $21::jsonb, $22::jsonb,
         $23, $24, $25, COALESCE($26::timestamptz, NOW()), COALESCE($27::timestamptz, NOW())
       )
       ON CONFLICT (content_hash) DO UPDATE SET
         title = EXCLUDED.title,
         summary = EXCLUDED.summary,
         action_required = EXCLUDED.action_required,
         content = EXCLUDED.content,
         source_name = COALESCE(EXCLUDED.source_name, notifications.source_name),
         source_url = COALESCE(EXCLUDED.source_url, notifications.source_url),
         attachments = EXCLUDED.attachments,
         published_at = EXCLUDED.published_at,
         tags = EXCLUDED.tags,
         deadline_at = COALESCE(EXCLUDED.deadline_at, notifications.deadline_at)
       RETURNING *`,
      [
        id,
        sanitizeUtf16(notification.title),
        sanitizeUtf16(notification.summary || ''),
        sanitizeUtf16(notification.action_required || null),
        sanitizeUtf16(notification.content || ''),
        channel,
        sanitizeUtf16(notification.source_name || null),
        notification.classified_by || 'RULE_ENGINE',
        scope,
        priority,
        Number(notification.priority_score || 0),
        notification.category || 'ACADEMIC',
        notification.category_code || 'hoc_tap',
        notification.category_name || 'Thông báo học tập',
        validCourseCode,
        notification.target_faculty || null,
        notification.target_cohort || null,
        targetStudentUuid,
        Boolean(notification.is_emergency),
        safeJsonStringify(notification.tags || []),
        safeJsonStringify(notification.attachments || []),
        notification.reschedule_details ? safeJsonStringify(notification.reschedule_details) : null,
        sanitizeUtf16(notification.source_url || null),
        notification.deadline_at || null,
        notification.content_hash,
        notification.published_at || null,
        notification.created_at || null,
      ]
    );
    const saved = normalizeNotificationRow(rows[0]);
    if (!saved.course_code && notification.course_code) {
      // Preserve detected course_code metadata in response object when course row isn't enrolled yet
      saved.course_code = notification.course_code;
    }
    return saved;
  }

  async updateNotificationById(id, fields = {}, client = null) {
    if (!isUuid(id)) return null;
    const runner = client || this.db;
    const { rows } = await runner.query(
      `UPDATE notifications
       SET source_channel = COALESCE($2, source_channel),
           source_name = COALESCE($3, source_name),
           source_url = COALESCE($4, source_url),
           attachments = COALESCE($5::jsonb, attachments),
           content = COALESCE($6, content),
           published_at = COALESCE($7::timestamptz, published_at),
           content_hash = COALESCE($8, content_hash),
           course_code = COALESCE($9, course_code)
       WHERE id = $1::uuid
       RETURNING *`,
      [
        id,
        fields.source_channel !== undefined ? normalizeSourceChannel(fields.source_channel) : null,
        fields.source_name !== undefined ? sanitizeUtf16(fields.source_name) : null,
        fields.source_url !== undefined ? sanitizeUtf16(fields.source_url) : null,
        fields.attachments !== undefined ? safeJsonStringify(fields.attachments || []) : null,
        fields.content !== undefined ? sanitizeUtf16(fields.content) : null,
        fields.published_at !== undefined ? fields.published_at : null,
        fields.content_hash !== undefined ? fields.content_hash : null,
        fields.course_code !== undefined ? fields.course_code : null,
      ]
    );
    return normalizeNotificationRow(rows[0]);
  }

  async deleteNotificationWithRelink(deleteId, keepId = null, client = null) {
    if (!isUuid(deleteId)) return false;
    const execute = async (tx) => {
      if (keepId && isUuid(keepId) && keepId !== deleteId) {
        await tx.query(
          'UPDATE deadlines SET notification_id = $1::uuid WHERE notification_id = $2::uuid',
          [keepId, deleteId]
        );
        await tx.query(
          `INSERT INTO student_notifications (student_id, notification_id, is_read, read_at, is_acknowledged, acknowledged_at)
           SELECT student_id, $1::uuid, is_read, read_at, is_acknowledged, acknowledged_at
           FROM student_notifications
           WHERE notification_id = $2::uuid
           ON CONFLICT (student_id, notification_id) DO UPDATE SET
             is_read = student_notifications.is_read OR EXCLUDED.is_read,
             read_at = COALESCE(student_notifications.read_at, EXCLUDED.read_at),
             is_acknowledged = student_notifications.is_acknowledged OR EXCLUDED.is_acknowledged,
             acknowledged_at = COALESCE(student_notifications.acknowledged_at, EXCLUDED.acknowledged_at)`,
          [keepId, deleteId]
        );
      }
      const { rowCount } = await tx.query('DELETE FROM notifications WHERE id = $1::uuid', [deleteId]);
      return rowCount > 0;
    };

    if (client) return execute(client);
    return withTransaction(execute, this.db.getPool());
  }

  async distributeToStudent(notificationId, studentUuid, client = null) {
    if (!isUuid(notificationId) || !isUuid(studentUuid)) return;
    const runner = client || this.db;
    await runner.query(
      `INSERT INTO student_notifications (student_id, notification_id, is_read, is_acknowledged)
       VALUES ($1::uuid, $2::uuid, FALSE, FALSE)
       ON CONFLICT (student_id, notification_id) DO NOTHING`,
      [studentUuid, notificationId]
    );
  }

  async getStudentStatusesMap(studentUuid, notificationIds = [], client = null) {
    if (!isUuid(studentUuid) || !notificationIds || notificationIds.length === 0) {
      return new Map();
    }
    const runner = client || this.db;
    const { rows } = await runner.query(
      `SELECT notification_id, is_read, read_at, is_acknowledged, acknowledged_at
       FROM student_notifications
       WHERE student_id = $1::uuid AND notification_id = ANY($2::uuid[])`,
      [studentUuid, notificationIds.filter(isUuid)]
    );
    return new Map(rows.map((r) => [String(r.notification_id), r]));
  }

  async getNotificationById(notificationId, studentIdentifier = null, client = null) {
    if (!isUuid(notificationId)) return null;
    const runner = client || this.db;
    const { rows } = await runner.query(
      'SELECT * FROM notifications WHERE id = $1::uuid LIMIT 1',
      [notificationId]
    );
    if (!rows[0]) return null;

    const notif = normalizeNotificationRow(rows[0]);
    if (!studentIdentifier) {
      return { ...notif, is_read: false, is_acknowledged: false };
    }

    const student = await this.studentRepo.resolveStudent(studentIdentifier, runner);
    if (!student) {
      return { ...notif, is_read: false, is_acknowledged: false };
    }

    const statusRes = await runner.query(
      `SELECT is_read, is_acknowledged
       FROM student_notifications
       WHERE notification_id = $1::uuid AND student_id = $2::uuid
       LIMIT 1`,
      [notificationId, student.id]
    );
    return {
      ...notif,
      is_read: Boolean(statusRes.rows[0]?.is_read),
      is_acknowledged: Boolean(statusRes.rows[0]?.is_acknowledged),
    };
  }

  async setReadStatus(notificationId, studentIdentifier, isRead = true, client = null) {
    if (!isUuid(notificationId)) {
      throw new ValidationError(`notification_id không phải UUID hợp lệ: ${notificationId}`);
    }
    const runner = client || this.db;
    const existing = await runner.query('SELECT id FROM notifications WHERE id = $1::uuid LIMIT 1', [notificationId]);
    if (!existing.rows[0]) {
      throw new NotFoundError(`Không tìm thấy thông báo: ${notificationId}`);
    }

    const student = await this.studentRepo.requireStudent(studentIdentifier, runner);
    const { rows } = await runner.query(
      `INSERT INTO student_notifications (student_id, notification_id, is_read, read_at)
       VALUES ($1::uuid, $2::uuid, $3, CASE WHEN $3 THEN NOW() ELSE NULL END)
       ON CONFLICT (student_id, notification_id) DO UPDATE SET
         is_read = EXCLUDED.is_read,
         read_at = EXCLUDED.read_at
       RETURNING student_id, notification_id, is_read, read_at`,
      [student.id, notificationId, Boolean(isRead)]
    );
    return {
      notification_id: rows[0].notification_id,
      student_id: rows[0].student_id,
      is_read: Boolean(rows[0].is_read),
      read_at: rows[0].read_at instanceof Date ? rows[0].read_at.toISOString() : rows[0].read_at,
    };
  }

  async acknowledgeNotification(notificationId, studentIdentifier, client = null) {
    if (!isUuid(notificationId)) {
      throw new ValidationError(`notification_id không phải UUID hợp lệ: ${notificationId}`);
    }
    const runner = client || this.db;
    const existing = await runner.query('SELECT id FROM notifications WHERE id = $1::uuid LIMIT 1', [notificationId]);
    if (!existing.rows[0]) {
      throw new NotFoundError(`Không tìm thấy thông báo: ${notificationId}`);
    }

    const student = await this.studentRepo.requireStudent(studentIdentifier, runner);
    const { rows } = await runner.query(
      `INSERT INTO student_notifications (
         student_id, notification_id, is_read, read_at, is_acknowledged, acknowledged_at
       ) VALUES (
         $1::uuid, $2::uuid, TRUE, NOW(), TRUE, NOW()
       )
       ON CONFLICT (student_id, notification_id) DO UPDATE SET
         is_acknowledged = TRUE,
         acknowledged_at = COALESCE(student_notifications.acknowledged_at, NOW()),
         is_read = TRUE,
         read_at = COALESCE(student_notifications.read_at, NOW())
       RETURNING student_id, notification_id, is_read, read_at, is_acknowledged, acknowledged_at`,
      [student.id, notificationId]
    );
    const r = rows[0];
    return {
      success: true,
      notification_id: r.notification_id,
      student_id: r.student_id,
      acknowledged_at: r.acknowledged_at instanceof Date ? r.acknowledged_at.toISOString() : r.acknowledged_at,
      message: 'Đã xác nhận nhận tin khẩn cấp thành công (Read Receipt)',
    };
  }

  async createCollectedNotification(payload = {}) {
    const rawChannel = payload.source_channel || payload.source_code || payload.source_type || 'DUT_GENERAL';
    const sourceChannel = normalizeSourceChannel(rawChannel);
    const publishedAt = payload.published_at || new Date().toISOString();
    const contentHash = buildContentHash({
      source_channel: sourceChannel,
      title: payload.title,
      published_at: publishedAt,
    });

    const existing = await this.findByHash(contentHash);
    if (existing) {
      return { inserted: false, duplicate: true, notification: existing };
    }

    const classified = classifyNotification({
      source_type: payload.source_type || rawChannel,
      ...(payload.source_channel ? { source_channel: sourceChannel } : {}),
      title: payload.title,
      content: payload.content,
      course_code: payload.course_code,
      scope_type: payload.scope_type,
      target_student_id: payload.target_student_id,
    });

    let targetStudentUuid = null;
    if (payload.target_student_id || classified.target_student_id) {
      const targetRef = payload.target_student_id || classified.target_student_id;
      const targetStudent = await this.studentRepo.resolveStudent(targetRef);
      if (targetStudent) targetStudentUuid = targetStudent.id;
    }

    const dbScope = mapScopeToDb(payload.scope || payload.scope_type || classified.scope_type);
    const saved = await this.upsertNotification({
      id: crypto.randomUUID(),
      title: String(payload.title).trim(),
      content: String(payload.content).trim(),
      summary: payload.summary || classified.summary,
      source_channel: sourceChannel,
      source_name: payload.source_name || payload.sender_name || sourceChannel,
      classified_by: payload.classified_by || 'RULE_ENGINE',
      scope: dbScope,
      priority: payload.priority || classified.priority,
      priority_score: Number(payload.priority_score ?? classified.priority_score),
      category: payload.category || classified.category || 'ACADEMIC',
      category_code: payload.category_code || classified.category_code || 'hoc_tap',
      category_name: payload.category_name || classified.category_name || 'Thông báo học tập',
      course_code: payload.course_code || classified.course_code,
      target_student_id: targetStudentUuid,
      is_emergency: Boolean(payload.is_emergency || classified.priority === 'URGENT'),
      tags: Array.isArray(payload.tags) && payload.tags.length > 0 ? payload.tags : classified.tags,
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
      source_url: payload.source_url || null,
      content_hash: contentHash,
      published_at: publishedAt,
    });

    // Preserve semantic scope_type if classifier returned legacy label (CLASS/GENERAL)
    const responseNotification = {
      ...saved,
      scope_type: payload.scope_type || classified.scope_type || saved.scope,
      source_type: payload.source_type || saved.source_channel,
    };

    return {
      inserted: true,
      duplicate: false,
      notification: responseNotification,
    };
  }

  async createCollectedBatch(items = []) {
    let insertedCount = 0;
    let duplicateCount = 0;
    const savedItems = [];

    for (const item of items) {
      const res = await this.createCollectedNotification(item);
      if (res.inserted) {
        insertedCount += 1;
      } else {
        duplicateCount += 1;
      }
      savedItems.push(res.notification);
    }

    return {
      total_received: items.length,
      inserted_count: insertedCount,
      duplicate_count: duplicateCount,
      items: savedItems,
    };
  }
}

module.exports = {
  DEFAULT_SOURCES,
  SOURCE_CHANNEL_ALIASES,
  normalizeSourceChannel,
  mapScopeToDb,
  mapPriorityToDb,
  normalizeNotificationRow,
  buildContentHash,
  NotificationRepository,
};
