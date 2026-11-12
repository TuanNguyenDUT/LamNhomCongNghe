/**
 * TASK 11: Kết nối PostgreSQL & Tầng truy cập dữ liệu (Repository) cho API thu thập thông báo
 * Kiến trúc: Node.js Backend + PostgreSQL
 * Phụ trách: Nguyễn Hữu Tuấn
 */

const crypto = require('node:crypto');

// Danh sách kênh nguồn mặc định trong hệ thống
const DEFAULT_SOURCES = [
  {
    source_id: 1,
    source_code: 'PORTAL_PDT',
    source_name: 'Phòng Đào tạo Đại học (Portal)',
    source_type: 'TRAINING_DEPT',
    endpoint_url: 'https://sv.dut.udn.vn/thong-bao-dao-tao',
    default_weight: 30,
    is_active: true,
  },
  {
    source_id: 2,
    source_code: 'FACULTY_IT',
    source_name: 'Khoa Công nghệ Thông tin',
    source_type: 'FACULTY',
    endpoint_url: 'https://it.dut.udn.vn/thong-bao',
    default_weight: 25,
    is_active: true,
  },
  {
    source_id: 3,
    source_code: 'LMS_CLASS',
    source_name: 'Kênh Lớp học phần / Giảng viên',
    source_type: 'CLASS_SECTION',
    endpoint_url: 'https://lms.dut.udn.vn/api/announcements',
    default_weight: 25,
    is_active: true,
  },
  {
    source_id: 4,
    source_code: 'EMAIL_SV',
    source_name: 'Email Sinh viên (@sv.dut.udn.vn)',
    source_type: 'STUDENT_EMAIL',
    endpoint_url: 'imap://mail.sv.dut.udn.vn',
    default_weight: 22,
    is_active: true,
  },
  {
    source_id: 5,
    source_code: 'CLUB_EXTRA',
    source_name: 'Đoàn Thanh niên & Kênh Ngoại khóa',
    source_type: 'EXTRACURRICULAR',
    endpoint_url: 'https://youth.dut.udn.vn/events',
    default_weight: 10,
    is_active: true,
  },
];

/**
 * Tạo mã băm SHA-256 chống trùng lặp khi thu thập thông báo
 */
function buildContentHash({ source_type, title, published_at }) {
  const datePart = String(published_at || new Date().toISOString()).slice(0, 10);
  const raw = `${source_type || 'TRAINING_DEPT'}|${String(title || '').trim().toLowerCase()}|${datePart}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}

class NotificationRepository {
  /**
   * @param {import('pg').Pool | null} pgPool - Kết nối PostgreSQL Pool (nếu đã cấu hình DATABASE_URL)
   */
  constructor(pgPool = null) {
    this.pool = pgPool;
    this.sources = [...DEFAULT_SOURCES];
    this.memoryNotifications = [];
  }

  /**
   * Lấy danh sách các kênh nguồn thông báo (Phòng Đào tạo, Khoa, Lớp, Email SV, Ngoại khóa)
   */
  async getSources() {
    if (this.pool) {
      const { rows } = await this.pool.query(
        'SELECT * FROM notification_sources WHERE is_active = TRUE ORDER BY default_weight DESC'
      );
      return rows;
    }
    return this.sources;
  }

  /**
   * Lưu 1 thông báo thu thập được từ kênh nguồn vào bảng notifications
   */
  async createCollectedNotification(payload) {
    const source =
      this.sources.find((s) => s.source_code === payload.source_code) ||
      this.sources.find((s) => s.source_type === payload.source_type) ||
      this.sources[0];

    const publishedAt = payload.published_at || new Date().toISOString();
    const contentHash = buildContentHash({
      source_type: source.source_type,
      title: payload.title,
      published_at: publishedAt,
    });

    const record = {
      external_id: payload.external_id || null,
      source_id: source.source_id,
      source_code: source.source_code,
      source_type: source.source_type,
      title: String(payload.title).trim(),
      content: String(payload.content).trim(),
      summary:
        payload.summary ||
        (String(payload.content).length > 160
          ? `${String(payload.content).slice(0, 157)}...`
          : String(payload.content)),
      sender_name: payload.sender_name || source.source_name,
      sender_email: payload.sender_email || null,
      course_code: payload.course_code || null,
      section_id: payload.section_id || null,
      target_student_id: payload.target_student_id || null,
      scope_type: payload.scope_type || 'GENERAL',
      priority: payload.priority || 'MEDIUM',
      priority_score: Number(payload.priority_score ?? 50),
      tags: Array.isArray(payload.tags) ? payload.tags : [],
      attachments: Array.isArray(payload.attachments) ? payload.attachments : [],
      source_url: payload.source_url || null,
      content_hash: contentHash,
      published_at: publishedAt,
      ingested_at: new Date().toISOString(),
    };

    if (this.pool) {
      const insertSql = `
        INSERT INTO notifications (
          external_id, source_id, source_type, title, content, summary,
          sender_name, sender_email, course_code, section_id, target_student_id,
          scope_type, priority, priority_score, tags, attachments,
          source_url, content_hash, published_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15::jsonb, $16::jsonb,
          $17, $18, $19
        )
        ON CONFLICT (content_hash) DO NOTHING
        RETURNING *;
      `;
      const values = [
        record.external_id,
        record.source_id,
        record.source_type,
        record.title,
        record.content,
        record.summary,
        record.sender_name,
        record.sender_email,
        record.course_code,
        record.section_id,
        record.target_student_id,
        record.scope_type,
        record.priority,
        record.priority_score,
        JSON.stringify(record.tags),
        JSON.stringify(record.attachments),
        record.source_url,
        record.content_hash,
        record.published_at,
      ];
      const { rows } = await this.pool.query(insertSql, values);
      return {
        inserted: rows.length > 0,
        duplicate: rows.length === 0,
        notification: rows[0] || record,
      };
    }

    // Fallback lưu trong bộ nhớ khi chưa bật PostgreSQL container
    const existing = this.memoryNotifications.find((n) => n.content_hash === contentHash);
    if (existing) {
      return { inserted: false, duplicate: true, notification: existing };
    }
    const created = {
      notification_id: this.memoryNotifications.length + 1,
      ...record,
    };
    this.memoryNotifications.unshift(created);
    return { inserted: true, duplicate: false, notification: created };
  }

  /**
   * Thu thập hàng loạt thông báo từ một phiên đồng bộ (Batch Collect)
   */
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

  /**
   * Truy vấn danh sách thông báo đã thu thập (phục vụ Flutter client & kiểm tra dữ liệu)
   */
  async listNotifications({ source_type, scope_type, course_code, page = 1, limit = 10 } = {}) {
    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
    const offset = (safePage - 1) * safeLimit;

    if (this.pool) {
      const conditions = [];
      const values = [];

      if (source_type) {
        values.push(source_type);
        conditions.push(`source_type = $${values.length}`);
      }
      if (scope_type) {
        values.push(scope_type);
        conditions.push(`scope_type = $${values.length}`);
      }
      if (course_code) {
        values.push(course_code);
        conditions.push(`course_code = $${values.length}`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const countRes = await this.pool.query(
        `SELECT COUNT(*)::int AS total FROM notifications ${whereClause}`,
        values
      );
      const dataRes = await this.pool.query(
        `SELECT * FROM notifications ${whereClause} ORDER BY published_at DESC LIMIT $${
          values.length + 1
        } OFFSET $${values.length + 2}`,
        [...values, safeLimit, offset]
      );

      return {
        items: dataRes.rows,
        pagination: {
          page: safePage,
          limit: safeLimit,
          total: countRes.rows[0].total,
        },
      };
    }

    let filtered = [...this.memoryNotifications];
    if (source_type) filtered = filtered.filter((n) => n.source_type === source_type);
    if (scope_type) filtered = filtered.filter((n) => n.scope_type === scope_type);
    if (course_code) filtered = filtered.filter((n) => n.course_code === course_code);

    return {
      items: filtered.slice(offset, offset + safeLimit),
      pagination: {
        page: safePage,
        limit: safeLimit,
        total: filtered.length,
      },
    };
  }

  async getNotificationById(notificationId) {
    if (this.pool) {
      const { rows } = await this.pool.query(
        'SELECT * FROM notifications WHERE notification_id = $1',
        [Number(notificationId)]
      );
      return rows[0] || null;
    }
    return (
      this.memoryNotifications.find((n) => n.notification_id === Number(notificationId)) || null
    );
  }
}

module.exports = {
  DEFAULT_SOURCES,
  NotificationRepository,
};
