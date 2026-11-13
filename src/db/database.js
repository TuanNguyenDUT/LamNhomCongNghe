/**
 * TASK 11 & TASK 15: Quản lý Cơ sở dữ liệu SQLite, Truy vấn Phân trang, Batch Transaction & Cache
 * Phụ trách: Nguyễn Hữu Tuấn
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { DEFAULT_COURSES, classifyNotification } = require('../services/classifierService');
const { feedCache } = require('../services/cacheService');

class DatabaseManager {
  constructor(dbPath = path.join(__dirname, '../../data/notifications.db')) {
    this.dbPath = dbPath;
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(dbPath);
    this.initSchema();
  }

  initSchema() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    this.db.exec(schemaSql);
    this.applySchemaMigrations();
    this.seedReferenceData();
  }

  applySchemaMigrations() {
    const deviceTokenColumns = this.db
      .prepare('PRAGMA table_info(device_tokens)')
      .all()
      .map((column) => column.name);
    if (!deviceTokenColumns.includes('target_type')) {
      this.db.exec(
        "ALTER TABLE device_tokens ADD COLUMN target_type TEXT NOT NULL DEFAULT 'TOKEN' " +
        "CHECK (target_type IN ('TOKEN', 'FID'))"
      );
    }
  }

  seedReferenceData() {
    const sources = [
      {
        source_code: 'PORTAL_PDT',
        source_name: 'Phòng Đào tạo Đại học (Portal)',
        source_type: 'TRAINING_DEPT',
        endpoint_url: 'https://sv.dut.udn.vn/thong-bao-dao-tao',
        base_weight: 30,
      },
      {
        source_code: 'FACULTY_IT',
        source_name: 'Khoa Công nghệ Thông tin',
        source_type: 'FACULTY',
        endpoint_url: 'https://it.dut.udn.vn/tin-tuc-sinh-vien',
        base_weight: 24,
      },
      {
        source_code: 'CLASS_LMS',
        source_name: 'Kênh Lớp học phần (LMS / Giảng viên)',
        source_type: 'CLASS',
        endpoint_url: 'https://lms.dut.udn.vn/announcements',
        base_weight: 25,
      },
      {
        source_code: 'EMAIL_SV',
        source_name: 'Hộp thư Email Sinh viên (@sv.dut.udn.vn)',
        source_type: 'STUDENT_EMAIL',
        endpoint_url: 'imap://mail.sv.dut.udn.vn',
        base_weight: 22,
      },
      {
        source_code: 'CLUB_EXTRA',
        source_name: 'Đoàn Thanh niên & Kênh Ngoại khóa',
        source_type: 'EXTRACURRICULAR',
        endpoint_url: 'https://youth.dut.udn.vn/events',
        base_weight: 10,
      },
    ];

    const insertSourceStmt = this.db.prepare(`
      INSERT OR IGNORE INTO notification_sources
      (source_code, source_name, source_type, endpoint_url, base_weight)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const s of sources) {
      insertSourceStmt.run(s.source_code, s.source_name, s.source_type, s.endpoint_url, s.base_weight);
    }

    const insertCourseStmt = this.db.prepare(`
      INSERT OR REPLACE INTO courses
      (course_code, course_name, course_tag, faculty, keywords)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (const c of DEFAULT_COURSES) {
      insertCourseStmt.run(
        c.course_code,
        c.course_name,
        c.course_tag,
        c.faculty,
        Array.isArray(c.keywords) ? c.keywords.join(',') : c.keywords
      );
    }
  }

  /**
   * Khởi tạo dữ liệu mẫu ban đầu nếu bảng notifications đang trống
   */
  seedSampleNotificationsIfEmpty() {
    const countRow = this.db.prepare('SELECT COUNT(*) AS total FROM notifications').get();
    if (countRow && countRow.total > 0) {
      return 0;
    }

    const now = Date.now();
    const hoursAgo = (h) => new Date(now - h * 3600 * 1000).toISOString();

    const initialRawItems = [
      {
        external_id: 'SEED-PDT-01',
        source_code: 'PORTAL_PDT',
        source_type: 'TRAINING_DEPT',
        channel_name: 'Phòng Đào tạo Đại học',
        title: '[THÔNG BÁO KHẨN] Điều chỉnh lịch thi cuối kỳ và phòng thi tập trung HK1',
        content:
          'Phòng Đào tạo thông báo điều chỉnh danh sách phòng thi cuối kỳ đối với các học phần đại cương và chuyên ngành. Sinh viên bắt buộc kiểm tra lịch thi cá nhân trước 17h hôm nay.',
        sender_name: 'Phòng Đào tạo',
        source_url: 'https://sv.dut.udn.vn/tb-lich-thi-hk1',
        published_at: hoursAgo(2),
      },
      {
        external_id: 'SEED-CLS-02',
        source_code: 'CLASS_LMS',
        source_type: 'CLASS',
        channel_name: 'Lớp học phần IT401 - Công nghệ phần mềm',
        title: '[IT401] Nhắc hạn chót nộp báo cáo Sprint MVP môn Công nghệ phần mềm hôm nay',
        content:
          'Các nhóm thuộc lớp học phần Công nghệ phần mềm (IT401) hoàn thiện chức năng MVP, kiểm thử tích hợp và đẩy code lên GitHub trước 23h59 hôm nay để giảng viên chấm điểm.',
        sender_name: 'PGS.TS Nguyễn Văn Hùng',
        course_code: 'IT401',
        published_at: hoursAgo(3),
      },
      {
        external_id: 'SEED-MAIL-03',
        source_code: 'EMAIL_SV',
        source_type: 'STUDENT_EMAIL',
        channel_name: 'Email Sinh viên (@sv.dut.udn.vn)',
        title: 'Thông báo cảnh báo học vụ và nhắc đóng học phí cá nhân đối với MSSV: 102230099',
        content:
          'Gửi sinh viên MSSV: 102230099, hệ thống ghi nhận bạn chưa hoàn thành nghĩa vụ học phí học kỳ này. Vui lòng hoàn tất thanh toán học phí trong vòng 24h để tránh bị hủy đăng ký học phần.',
        sender_name: 'Phòng Công tác Sinh viên & KHTC',
        sender_email: 'ctsv@dut.udn.vn',
        recipient_student_id: '102230099',
        published_at: hoursAgo(5),
      },
      {
        external_id: 'SEED-FAC-04',
        source_code: 'FACULTY_IT',
        source_type: 'FACULTY',
        channel_name: 'Khoa Công nghệ Thông tin',
        title: 'Kế hoạch thực tập doanh nghiệp và xét học bổng khuyến khích học tập Khoa CNTT',
        content:
          'Khoa CNTT công bố danh sách các doanh nghiệp đối tác nhận thực tập sinh và tiêu chuẩn xét học bổng khuyến khích học tập học kỳ 1. Sinh viên nộp hồ sơ trực tuyến trên trang Khoa.',
        sender_name: 'Văn phòng Khoa CNTT',
        source_url: 'https://it.dut.udn.vn/hoc-bong-thuc-tap',
        published_at: hoursAgo(8),
      },
      {
        external_id: 'SEED-CLS-05',
        source_code: 'CLASS_LMS',
        source_type: 'CLASS',
        channel_name: 'Lớp học phần IT205 - Mạng máy tính',
        title: 'Thông báo thay đổi lịch học và học bù thực hành Mạng máy tính (IT205)',
        content:
          'Buổi thực hành cấu hình Routing & TCP/IP của lớp học phần Mạng máy tính IT205 chuyển sang chiều thứ Sáu tại phòng Lab C203.',
        sender_name: 'ThS. Lê Hoàng Nam',
        course_code: 'IT205',
        published_at: hoursAgo(12),
      },
      {
        external_id: 'SEED-EXT-06',
        source_code: 'CLUB_EXTRA',
        source_type: 'EXTRACURRICULAR',
        channel_name: 'Kênh Ngoại khóa & CLB Sinh viên',
        title: 'Tuyển thành viên chiến dịch Tình nguyện Mùa hè xanh & CLB Văn nghệ Sinh viên',
        content:
          'Đoàn Thanh niên phát động chương trình tình nguyện cộng đồng và đêm nhạc giao lưu câu lạc bộ sinh viên toàn trường. Đăng ký tham gia để nhận điểm hoạt động ngoại khóa.',
        sender_name: 'BCH Đoàn Trường',
        published_at: hoursAgo(18),
      },
    ];

    const courses = this.getCourses();
    const classified = initialRawItems.map((item) => classifyNotification(item, courses));
    const res = this.insertNotificationsBatch(classified, 'SEED-INITIAL');
    return res.insertedCount;
  }

  getCourses() {
    const rows = this.db.prepare('SELECT * FROM courses ORDER BY course_code ASC').all();
    return rows.map((r) => ({
      ...r,
      keywords: String(r.keywords || '')
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean),
    }));
  }

  getSources() {
    return this.db.prepare('SELECT * FROM notification_sources ORDER BY base_weight DESC').all();
  }

  /**
   * Đăng ký hoặc làm mới FCM token cho một thiết bị (Task 6).
   * Cùng student_id + device_id sẽ được upsert. Nếu token đã chuyển sang một
   * thiết bị khác, bản ghi active cũ được vô hiệu hóa trước khi đăng ký mới.
   */
  registerDeviceToken({
    student_id,
    token,
    target_type = 'TOKEN',
    platform,
    device_id,
    app_version = null,
  }) {
    const studentId = String(student_id).trim();
    const normalizedToken = String(token).trim();
    const normalizedTargetType = String(target_type).trim().toUpperCase();
    const normalizedPlatform = String(platform).trim().toUpperCase();
    const deviceId = String(device_id).trim();
    const appVersion = app_version === null || app_version === undefined
      ? null
      : String(app_version).trim().slice(0, 100);
    const tokenHash = crypto.createHash('sha256').update(normalizedToken).digest('hex');
    const now = new Date().toISOString();

    const existing = this.db
      .prepare('SELECT id FROM device_tokens WHERE student_id = ? AND device_id = ?')
      .get(studentId, deviceId);

    this.db.exec('BEGIN IMMEDIATE TRANSACTION');
    try {
      this.db
        .prepare(`
          UPDATE device_tokens
          SET is_active = 0,
              last_error_code = 'TOKEN_REASSIGNED',
              updated_at = ?
          WHERE token_hash = ?
            AND is_active = 1
            AND NOT (student_id = ? AND device_id = ?)
        `)
        .run(now, tokenHash, studentId, deviceId);

      this.db
        .prepare(`
          INSERT INTO device_tokens (
            student_id, token, token_hash, target_type, platform, device_id, app_version,
            is_active, failure_count, last_seen_at, last_error_code,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0, ?, NULL, ?, ?)
          ON CONFLICT(student_id, device_id) DO UPDATE SET
            token = excluded.token,
            token_hash = excluded.token_hash,
            target_type = excluded.target_type,
            platform = excluded.platform,
            app_version = excluded.app_version,
            is_active = 1,
            failure_count = 0,
            last_seen_at = excluded.last_seen_at,
            last_error_code = NULL,
            updated_at = excluded.updated_at
        `)
        .run(
          studentId,
          normalizedToken,
          tokenHash,
          normalizedTargetType,
          normalizedPlatform,
          deviceId,
          appVersion,
          now,
          now,
          now
        );

      const row = this.db
        .prepare('SELECT * FROM device_tokens WHERE student_id = ? AND device_id = ?')
        .get(studentId, deviceId);
      this.db.exec('COMMIT');
      return {
        created: !existing,
        device: this.formatDeviceTokenRow(row),
      };
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  getActiveDeviceTokenForDelivery(deviceId, studentId = null) {
    const conditions = ['device_id = ?', 'is_active = 1'];
    const values = [String(deviceId).trim()];
    if (studentId) {
      conditions.push('student_id = ?');
      values.push(String(studentId).trim());
    }
    return this.db
      .prepare(`SELECT * FROM device_tokens WHERE ${conditions.join(' AND ')} LIMIT 1`)
      .get(...values) || null;
  }

  getDeviceTokenByIdForDelivery(id) {
    return this.db
      .prepare('SELECT * FROM device_tokens WHERE id = ? AND is_active = 1')
      .get(Number(id)) || null;
  }

  listStudentDevices(studentId, { activeOnly = true } = {}) {
    const whereActive = activeOnly ? 'AND is_active = 1' : '';
    return this.db
      .prepare(`
        SELECT * FROM device_tokens
        WHERE student_id = ? ${whereActive}
        ORDER BY last_seen_at DESC
      `)
      .all(String(studentId).trim())
      .map((row) => this.formatDeviceTokenRow(row));
  }

  unregisterDeviceToken(deviceId, studentId = null) {
    const conditions = ['device_id = ?', 'is_active = 1'];
    const values = [String(deviceId).trim()];
    if (studentId) {
      conditions.push('student_id = ?');
      values.push(String(studentId).trim());
    }
    const result = this.db
      .prepare(`
        UPDATE device_tokens
        SET is_active = 0,
            last_error_code = 'UNREGISTERED_BY_CLIENT',
            updated_at = ?
        WHERE ${conditions.join(' AND ')}
      `)
      .run(new Date().toISOString(), ...values);
    return result.changes > 0;
  }

  recordDevicePushSuccess(id) {
    this.db
      .prepare(`
        UPDATE device_tokens
        SET failure_count = 0,
            last_error_code = NULL,
            updated_at = ?
        WHERE id = ?
      `)
      .run(new Date().toISOString(), Number(id));
  }

  recordDevicePushFailure(id, errorCode, { deactivate = false } = {}) {
    this.db
      .prepare(`
        UPDATE device_tokens
        SET failure_count = failure_count + 1,
            last_error_code = ?,
            is_active = CASE WHEN ? = 1 THEN 0 ELSE is_active END,
            updated_at = ?
        WHERE id = ?
      `)
      .run(String(errorCode || 'UNKNOWN_PUSH_ERROR'), deactivate ? 1 : 0, new Date().toISOString(), Number(id));
  }

  /**
   * Thêm 1 thông báo mới (qua bộ phân loại tự động Task 13)
   */
  insertSingleNotification(rawPayload) {
    const courses = this.getCourses();
    const classified = classifyNotification(rawPayload, courses);
    const batchRes = this.insertNotificationsBatch([classified], `SINGLE-${Date.now()}`);
    const row = this.db
      .prepare('SELECT * FROM notifications WHERE content_hash = ?')
      .get(classified.content_hash);
    return {
      inserted: batchRes.insertedCount > 0,
      duplicate: batchRes.duplicateCount > 0,
      notification: this.formatNotificationRow(row),
    };
  }

  /**
   * Thêm hàng loạt thông báo trong 1 Transaction duy nhất (Tối ưu hiệu năng Task 15)
   */
  insertNotificationsBatch(classifiedList = [], batchId = `BATCH-${Date.now()}`) {
    if (!Array.isArray(classifiedList) || classifiedList.length === 0) {
      return { insertedCount: 0, duplicateCount: 0, durationMs: 0 };
    }

    const start = performance.now();
    const insertStmt = this.db.prepare(`
      INSERT OR IGNORE INTO notifications (
        external_id, source_code, source_type, channel_name,
        title, content, summary, sender_name, sender_email,
        recipient_student_id, course_code, course_tag, scope_type,
        category, priority, priority_score, tags_json,
        source_url, is_read, is_pinned, content_hash, published_at
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?
      )
    `);

    const logStmt = this.db.prepare(`
      INSERT INTO ingestion_logs (
        batch_id, source_code, channel_type, fetched_count,
        inserted_count, duplicate_count, duration_ms, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SUCCESS')
    `);

    let insertedCount = 0;
    let duplicateCount = 0;

    this.db.exec('BEGIN IMMEDIATE TRANSACTION');
    try {
      for (const item of classifiedList) {
        const result = insertStmt.run(
          item.external_id,
          item.source_code,
          item.source_type,
          item.channel_name,
          item.title,
          item.content,
          item.summary,
          item.sender_name,
          item.sender_email,
          item.recipient_student_id,
          item.course_code,
          item.course_tag,
          item.scope_type,
          item.category,
          item.priority,
          item.priority_score,
          item.tags_json,
          item.source_url,
          item.is_read || 0,
          item.is_pinned || 0,
          item.content_hash,
          item.published_at
        );

        if (result.changes > 0) {
          insertedCount += 1;
        } else {
          duplicateCount += 1;
        }
      }

      const durationMs = Number((performance.now() - start).toFixed(2));
      const firstSource = classifiedList[0]?.source_code || 'MULTI_SOURCE';
      const firstType = classifiedList[0]?.source_type || 'MIXED';

      logStmt.run(
        batchId,
        firstSource,
        firstType,
        classifiedList.length,
        insertedCount,
        duplicateCount,
        durationMs
      );

      this.db.exec('COMMIT');
      // Xóa cache khi dữ liệu thay đổi để đảm bảo tính nhất quán
      if (insertedCount > 0) {
        feedCache.invalidateAll();
      }

      return { insertedCount, duplicateCount, durationMs };
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  /**
   * Truy vấn danh sách thông báo có bộ lọc đa chiều, tìm kiếm, sắp xếp, phân trang & Cache (Task 11, 14, 15)
   */
  queryNotifications(params = {}) {
    const startTime = performance.now();
    const page = Math.max(1, Number.parseInt(params.page || '1', 10));
    const limit = Math.min(100, Math.max(1, Number.parseInt(params.limit || '6', 10)));
    const offset = (page - 1) * limit;
    const sortBy = params.sort_by || 'priority_ smart';

    const cacheKey = JSON.stringify({
      q: params.q || '',
      source_type: params.source_type || '',
      priority: params.priority || '',
      scope_type: params.scope_type || '',
      course_code: params.course_code || '',
      is_read: params.is_read ?? '',
      sortBy,
      page,
      limit,
    });

    const cached = feedCache.get(cacheKey);
    if (cached) {
      return {
        ...cached,
        performance: {
          query_time_ms: Number((performance.now() - startTime).toFixed(3)),
          cache_hit: true,
        },
      };
    }

    const conditions = [];
    const bindValues = [];

    if (params.source_type && params.source_type !== 'ALL') {
      conditions.push('source_type = ?');
      bindValues.push(params.source_type);
    }

    if (params.priority && params.priority !== 'ALL') {
      conditions.push('priority = ?');
      bindValues.push(params.priority);
    }

    if (params.scope_type && params.scope_type !== 'ALL') {
      conditions.push('scope_type = ?');
      bindValues.push(params.scope_type);
    }

    if (params.course_code && params.course_code !== 'ALL') {
      conditions.push('course_code = ?');
      bindValues.push(params.course_code);
    }

    if (params.is_read !== undefined && params.is_read !== '' && params.is_read !== 'ALL') {
      conditions.push('is_read = ?');
      bindValues.push(Number(params.is_read));
    }

    if (params.q && String(params.q).trim() !== '') {
      const kw = `%${String(params.q).trim()}%`;
      conditions.push('(title LIKE ? OR content LIKE ? OR channel_name LIKE ? OR tags_json LIKE ?)');
      bindValues.push(kw, kw, kw, kw);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    let orderClause = 'ORDER BY is_pinned DESC, priority_score DESC, published_at DESC';
    if (sortBy === 'newest') {
      orderClause = 'ORDER BY published_at DESC, priority_score DESC';
    } else if (sortBy === 'priority_desc') {
      orderClause = 'ORDER BY priority_score DESC, published_at DESC';
    }

    const countSql = `SELECT COUNT(*) AS total FROM notifications ${whereClause}`;
    const totalRow = this.db.prepare(countSql).get(...bindValues);
    const total = totalRow ? totalRow.total : 0;

    const dataSql = `
      SELECT *
      FROM notifications
      ${whereClause}
      ${orderClause}
      LIMIT ? OFFSET ?
    `;

    const rows = this.db.prepare(dataSql).all(...bindValues, limit, offset);
    const items = rows.map((r) => this.formatNotificationRow(r));
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const queryTimeMs = Number((performance.now() - startTime).toFixed(3));

    const responseData = {
      items,
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
        has_next: page < totalPages,
        has_prev: page > 1,
      },
      performance: {
        query_time_ms: queryTimeMs,
        cache_hit: false,
      },
    };

    feedCache.set(cacheKey, responseData);
    return responseData;
  }

  getNotificationById(id) {
    const row = this.db.prepare('SELECT * FROM notifications WHERE id = ?').get(Number(id));
    return row ? this.formatNotificationRow(row) : null;
  }

  updateReadStatus(id, isRead = true) {
    const val = isRead ? 1 : 0;
    const res = this.db
      .prepare('UPDATE notifications SET is_read = ? WHERE id = ?')
      .run(val, Number(id));
    if (res.changes > 0) {
      feedCache.invalidateAll();
    }
    return this.getNotificationById(id);
  }

  markAllRead() {
    const res = this.db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
    feedCache.invalidateAll();
    return { updated_count: res.changes };
  }

  getDashboardStats() {
    const cached = feedCache.get('DASHBOARD_STATS');
    if (cached) {
      return {
        ...cached,
        cache: feedCache.getStats(),
      };
    }

    const summary = this.db
      .prepare(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread_count,
          SUM(CASE WHEN priority IN ('URGENT', 'HIGH') THEN 1 ELSE 0 END) AS high_priority_count,
          SUM(CASE WHEN scope_type IN ('PERSONAL', 'CLASS') THEN 1 ELSE 0 END) AS targeted_count
        FROM notifications
      `)
      .get();

    const bySource = this.db
      .prepare(`
        SELECT source_type, COUNT(*) AS count
        FROM notifications
        GROUP BY source_type
      `)
      .all();

    const byPriority = this.db
      .prepare(`
        SELECT priority, COUNT(*) AS count
        FROM notifications
        GROUP BY priority
      `)
      .all();

    const byScope = this.db
      .prepare(`
        SELECT scope_type, COUNT(*) AS count
        FROM notifications
        GROUP BY scope_type
      `)
      .all();

    const byCourse = this.db
      .prepare(`
        SELECT course_code, course_tag, COUNT(*) AS count
        FROM notifications
        WHERE course_code IS NOT NULL
        GROUP BY course_code, course_tag
        ORDER BY count DESC
      `)
      .all();

    const result = {
      total: summary.total || 0,
      unread_count: summary.unread_count || 0,
      high_priority_count: summary.high_priority_count || 0,
      targeted_count: summary.targeted_count || 0,
      by_source: bySource,
      by_priority: byPriority,
      by_scope: byScope,
      by_course: byCourse,
      courses: this.getCourses(),
      sources: this.getSources(),
      cache: feedCache.getStats(),
    };

    feedCache.set('DASHBOARD_STATS', result);
    return result;
  }

  getIngestionLogs(limit = 15) {
    return this.db
      .prepare('SELECT * FROM ingestion_logs ORDER BY id DESC LIMIT ?')
      .all(Number(limit));
  }

  formatNotificationRow(row) {
    if (!row) return null;
    let parsedTags = [];
    try {
      parsedTags = JSON.parse(row.tags_json || '[]');
    } catch {
      parsedTags = [];
    }
    return {
      ...row,
      is_read: Boolean(row.is_read),
      is_pinned: Boolean(row.is_pinned),
      tags: parsedTags,
    };
  }

  formatDeviceTokenRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      student_id: row.student_id,
      platform: row.platform,
      target_type: row.target_type || 'TOKEN',
      device_id: row.device_id,
      app_version: row.app_version,
      is_active: Boolean(row.is_active),
      failure_count: row.failure_count,
      last_seen_at: row.last_seen_at,
      last_error_code: row.last_error_code,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  close() {
    this.db.close();
  }
}

module.exports = {
  DatabaseManager,
};
