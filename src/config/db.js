/**
 * Cấu hình kết nối Cơ sở dữ liệu PostgreSQL (qua pg.Pool) & In-Memory Store dự phòng
 * Hỗ trợ chạy Dual-mode: kết nối Postgres thật khi có CSDL hoặc Mock Store khi test/local.
 */

const { Pool } = require('pg');
const crypto = require('node:crypto');

let globalPool = null;

function getPool() {
  if (globalPool) return globalPool;
  if (!process.env.DATABASE_URL && !process.env.PGHOST) {
    return null;
  }
  try {
    globalPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      host: process.env.PGHOST || 'localhost',
      port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
      database: process.env.PGDATABASE || 'dut_notifications',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    globalPool.on('error', (err) => {
      console.error('Lỗi kết nối PostgreSQL pool:', err);
    });
    return globalPool;
  } catch (err) {
    console.warn('Không thể khởi tạo PG Pool, chuyển sang in-memory:', err.message);
    return null;
  }
}

/**
 * In-Memory Store hỗ trợ đầy đủ các bảng và quan hệ chuẩn theo AGENT.md
 */
class InMemoryDbStore {
  constructor(pool = getPool()) {
    this.pool = pool;
    this.students = new Map();
    this.courses = new Map();
    this.student_courses = []; // { student_id, course_code, is_muted, enrolled_at }
    this.notifications = new Map();
    this.student_notifications = []; // { student_id, notification_id, is_read, read_at, is_acknowledged, acknowledged_at }
    this.deadlines = new Map();
    this.device_tokens = new Map();
    this._seedDefaults();
    if (this.pool) {
      this._preloadFromPostgres().catch((err) =>
        console.warn('Preload from PostgreSQL warning:', err.message)
      );
    }
  }

  async _preloadFromPostgres() {
    try {
      // Đảm bảo schema có đầy đủ các cột phục vụ cá nhân hóa và phiên bảo mật
      await this.pool.query(`
        ALTER TABLE students ADD COLUMN IF NOT EXISTS dut_session_encrypted TEXT;
        ALTER TABLE students ADD COLUMN IF NOT EXISTS is_personalized_enabled BOOLEAN DEFAULT TRUE;
        ALTER TABLE students ADD COLUMN IF NOT EXISTS interested_topics JSONB DEFAULT '["hoc_vu", "hoc_bong", "tuyen_dung"]'::jsonb;
      `).catch(() => {});

      const studentRes = await this.pool.query('SELECT * FROM students');
      for (const row of studentRes.rows) {
        if (typeof row.interested_topics === 'string') {
          try {
            row.interested_topics = JSON.parse(row.interested_topics);
          } catch (_) {}
        }
        if (!row.interested_topics) {
          row.interested_topics = ['hoc_vu', 'hoc_bong', 'tuyen_dung'];
        }
        if (row.is_personalized_enabled === undefined || row.is_personalized_enabled === null) {
          row.is_personalized_enabled = true;
        }
        this.students.set(row.id, row);
        this.students.set(row.student_code, row);
      }
      const courseRes = await this.pool.query('SELECT * FROM courses');
      for (const row of courseRes.rows) {
        this.courses.set(row.course_code, row);
      }
      const scRes = await this.pool.query('SELECT * FROM student_courses');
      for (const row of scRes.rows) {
        const exists = this.student_courses.some(
          (sc) => sc.student_id === row.student_id && sc.course_code === row.course_code
        );
        if (!exists) this.student_courses.push(row);
      }
      const dlRes = await this.pool.query('SELECT * FROM deadlines');
      for (const row of dlRes.rows) {
        if (row.due_date instanceof Date) row.due_date = row.due_date.toISOString();
        if (row.created_at instanceof Date) row.created_at = row.created_at.toISOString();
        if (row.updated_at instanceof Date) row.updated_at = row.updated_at.toISOString();
        this.deadlines.set(row.deadline_id, row);
      }
      const notifRes = await this.pool.query('SELECT * FROM notifications ORDER BY published_at DESC');
      for (const row of notifRes.rows) {
        if (row.published_at instanceof Date) row.published_at = row.published_at.toISOString();
        if (row.created_at instanceof Date) row.created_at = row.created_at.toISOString();
        if (row.deadline_at instanceof Date) row.deadline_at = row.deadline_at.toISOString();
        this.notifications.set(row.id, row);
      }
      const snRes = await this.pool.query('SELECT * FROM student_notifications');
      for (const row of snRes.rows) {
        if (row.created_at instanceof Date) row.created_at = row.created_at.toISOString();
        if (row.read_at instanceof Date) row.read_at = row.read_at.toISOString();
        if (row.acknowledged_at instanceof Date) row.acknowledged_at = row.acknowledged_at.toISOString();
        const exists = this.student_notifications.some(
          (sn) => sn.student_id === row.student_id && sn.notification_id === row.notification_id
        );
        if (!exists) this.student_notifications.push(row);
      }
      console.log('✔ Đã nạp thành công dữ liệu từ PostgreSQL vào bộ nhớ!');
    } catch (err) {
      console.warn('Lỗi đọc dữ liệu khởi đầu từ PostgreSQL:', err.message);
    }
  }

  _seedDefaults() {
    // Thêm sinh viên mẫu mặc định
    const defaultStudent = {
      id: 'a0000000-0000-0000-0000-000000000001',
      firebase_uid: 'dut_student_firebase_uid_001',
      student_code: '102200001',
      full_name: 'Nguyễn Văn A',
      faculty: 'Khoa Công nghệ Thông tin',
      cohort: '20TCLC_DT1',
      class_name: '20TCLC_DT1',
      dut_session_encrypted: null,
      is_personalized_enabled: true,
      interested_topics: ['hoc_vu', 'hoc_bong', 'tuyen_dung'],
      dut_last_synced_at: new Date().toISOString(),
      fcm_tokens: ['fcm_token_test_device_1'],
      google_refresh_token: null,
      google_calendar_id: 'primary',
      is_calendar_sync_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.saveStudent(defaultStudent);

    const loiStudent = {
      id: '5619b2b4-904e-45af-9269-b4c8454a9881',
      firebase_uid: 'dut_uid_102230026',
      student_code: '102230026',
      full_name: 'Nguyễn Văn Lợi',
      faculty: 'Khoa Công nghệ Thông tin',
      cohort: 'K2023',
      class_name: '23T_Nhat1',
      dut_session_encrypted: null,
      is_personalized_enabled: true,
      interested_topics: ['hoc_vu', 'hoc_bong', 'tuyen_dung'],
      dut_last_synced_at: new Date().toISOString(),
      fcm_tokens: ['fcm_token_test_device_loi'],
      google_refresh_token: null,
      google_calendar_id: 'primary',
      is_calendar_sync_enabled: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.saveStudent(loiStudent);

    // Thêm danh mục môn học mẫu
    const defaultCourses = [
      {
        course_code: 'IT401',
        course_name: 'Công nghệ phần mềm',
        semester: 'Học kỳ 2 (2025-2026)',
        lecturer_name: 'TS. Nguyễn Văn B',
        schedule_info: 'Thứ 4, Tiết 1-3, Phòng F102',
        created_at: new Date().toISOString(),
      },
      {
        course_code: 'IT302',
        course_name: 'Cơ sở dữ liệu',
        semester: 'Học kỳ 2 (2025-2026)',
        lecturer_name: 'ThS. Trần Thị C',
        schedule_info: 'Thứ 2, Tiết 7-9, Phòng F301',
        created_at: new Date().toISOString(),
      },
      {
        course_code: 'IT408',
        course_name: 'Trí tuệ nhân tạo',
        semester: 'Học kỳ 2 (2025-2026)',
        lecturer_name: 'PGS. TS. Lê Văn D',
        schedule_info: 'Thứ 6, Tiết 4-6, Phòng F204',
        created_at: new Date().toISOString(),
      },
    ];

    for (const c of defaultCourses) {
      this.saveCourse(c);
      this.enrollStudentCourse(defaultStudent.id, c.course_code);
    }
  }

  // --- Helpers for In-Memory Queries ---
  findStudentByCodeOrId(identifier) {
    if (this.students.has(identifier)) return this.students.get(identifier);
    for (const s of this.students.values()) {
      if (s.student_code === identifier || s.id === identifier || s.firebase_uid === identifier) {
        return s;
      }
    }
    return null;
  }

  saveStudent(student) {
    if (!student.id) student.id = crypto.randomUUID();
    student.created_at = student.created_at || new Date().toISOString();
    student.updated_at = new Date().toISOString();
    if (student.is_personalized_enabled === undefined) student.is_personalized_enabled = true;
    if (!student.interested_topics) student.interested_topics = ['hoc_vu', 'hoc_bong', 'tuyen_dung'];
    if (student.is_calendar_sync_enabled === undefined) student.is_calendar_sync_enabled = true;
    if (!student.quick_reminder_options) student.quick_reminder_options = ['1_hour', 'tonight', 'tomorrow_morning', '1_day', '3_days', '1_week'];

    this.students.set(student.id, student);
    this.students.set(student.student_code, student);

    if (this.pool) {
      this.pool
        .query(
          `INSERT INTO students (id, firebase_uid, student_code, full_name, faculty, cohort, class_name, dut_session_encrypted, dut_last_synced_at, is_personalized_enabled, interested_topics, is_calendar_sync_enabled, quick_reminder_options)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (student_code) DO UPDATE SET
             full_name = EXCLUDED.full_name,
             faculty = EXCLUDED.faculty,
             cohort = EXCLUDED.cohort,
             class_name = EXCLUDED.class_name,
             dut_session_encrypted = COALESCE(EXCLUDED.dut_session_encrypted, students.dut_session_encrypted),
             dut_last_synced_at = EXCLUDED.dut_last_synced_at,
             is_personalized_enabled = EXCLUDED.is_personalized_enabled,
             interested_topics = EXCLUDED.interested_topics,
             is_calendar_sync_enabled = EXCLUDED.is_calendar_sync_enabled,
             quick_reminder_options = EXCLUDED.quick_reminder_options,
             updated_at = NOW()`,
          [
            student.id,
            student.firebase_uid || `dut_uid_${student.student_code}`,
            student.student_code,
            student.full_name,
            student.faculty,
            student.cohort,
            student.class_name,
            student.dut_session_encrypted || null,
            student.dut_last_synced_at || new Date().toISOString(),
            student.is_personalized_enabled !== false,
            JSON.stringify(student.interested_topics || ['hoc_vu', 'hoc_bong', 'tuyen_dung']),
            Boolean(student.is_calendar_sync_enabled),
            JSON.stringify(student.quick_reminder_options || ['1_hour', 'tonight', 'tomorrow_morning', '1_day', '3_days', '1_week']),
          ]
        )
        .catch((err) => console.warn('PG sync error (students):', err.message));
    }

    return student;
  }

  saveCourse(course) {
    course.created_at = course.created_at || new Date().toISOString();
    this.courses.set(course.course_code, course);

    if (this.pool) {
      this.pool
        .query(
          `INSERT INTO courses (course_code, course_name, semester, lecturer_name, schedule_info)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (course_code) DO UPDATE SET
             course_name = EXCLUDED.course_name,
             semester = EXCLUDED.semester,
             lecturer_name = EXCLUDED.lecturer_name,
             schedule_info = EXCLUDED.schedule_info`,
          [
            course.course_code,
            course.course_name,
            course.semester || 'Học kỳ 1 (2026-2027)',
            course.lecturer_name || 'Chưa cập nhật',
            course.schedule_info || 'Chưa có lịch cụ thể',
          ]
        )
        .catch((err) => console.warn('PG sync error (courses):', err.message));
    }

    return course;
  }

  enrollStudentCourse(studentId, courseCode) {
    const exists = this.student_courses.some(
      (sc) => sc.student_id === studentId && sc.course_code === courseCode
    );
    if (!exists) {
      this.student_courses.push({
        student_id: studentId,
        course_code: courseCode,
        is_muted: false,
        enrolled_at: new Date().toISOString(),
      });
    }

    if (this.pool) {
      this.pool
        .query(
          `INSERT INTO student_courses (student_id, course_code)
           VALUES ($1, $2)
           ON CONFLICT (student_id, course_code) DO NOTHING`,
          [studentId, courseCode]
        )
        .catch((err) => console.warn('PG sync error (student_courses):', err.message));
    }
  }

  getStudentCourses(studentId) {
    return this.student_courses
      .filter((sc) => sc.student_id === studentId)
      .map((sc) => {
        const course = this.courses.get(sc.course_code) || { course_code: sc.course_code };
        return {
          ...course,
          is_muted: sc.is_muted,
          enrolled_at: sc.enrolled_at,
        };
      });
  }

  findNotificationByHash(contentHash) {
    for (const n of this.notifications.values()) {
      if (n.content_hash === contentHash) return n;
    }
    return null;
  }

  saveNotification(notification) {
    const isExisting = notification.id && this.notifications.has(notification.id);
    if (!notification.id) notification.id = crypto.randomUUID();
    notification.created_at = notification.created_at || new Date().toISOString();
    notification.published_at = notification.published_at || new Date().toISOString();
    this.notifications.set(notification.id, notification);

    if (this.pool) {
      if (notification.course_code) {
        this.saveCourse({
          course_code: notification.course_code,
          course_name: `Học phần ${notification.course_code}`,
          semester: 'Học kỳ 1 (2026-2027)',
        });
      }

      const validPriority = ['LOW', 'NORMAL', 'HIGH', 'URGENT'].includes(notification.priority)
        ? notification.priority
        : (notification.priority === 'MEDIUM' ? 'NORMAL' : 'NORMAL');

      if (isExisting) {
        this.pool
          .query(
            `UPDATE notifications SET
               title = $1, summary = $2, action_required = $3, content = $4,
               source_channel = $5, classified_by = $6, scope = $7, priority = $8,
               priority_score = $9, course_code = $10, target_faculty = $11,
               target_cohort = $12, is_emergency = $13, tags = $14::jsonb,
               attachments = $15::jsonb, source_url = $16, deadline_at = $17,
               content_hash = $18, published_at = $19
             WHERE id = $20`,
            [
              notification.title,
              notification.summary || '',
              notification.action_required || null,
              notification.content || '',
              notification.source_channel || 'DUT_GENERAL',
              notification.classified_by || 'RULE_ENGINE',
              notification.scope || 'GLOBAL',
              validPriority,
              notification.priority_score || 0,
              notification.course_code || null,
              notification.target_faculty || null,
              notification.target_cohort || null,
              !!notification.is_emergency,
              JSON.stringify(notification.tags || []),
              JSON.stringify(notification.attachments || []),
              notification.source_url || null,
              notification.deadline_at || null,
              notification.content_hash,
              notification.published_at,
              notification.id,
            ]
          )
          .catch((err) => console.warn('PG sync error (update notifications):', err.message));
      } else {
        this.pool
          .query(
            `INSERT INTO notifications (
               id, title, summary, action_required, content, source_channel,
               classified_by, scope, priority, priority_score, course_code,
               target_faculty, target_cohort, is_emergency, tags, attachments,
               source_url, deadline_at, content_hash, published_at, created_at
             ) VALUES (
               $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
               $15::jsonb, $16::jsonb, $17, $18, $19, $20, $21
             )
             ON CONFLICT (content_hash) DO UPDATE SET
               title = EXCLUDED.title,
               summary = EXCLUDED.summary,
               action_required = EXCLUDED.action_required,
               content = EXCLUDED.content,
               published_at = EXCLUDED.published_at,
               tags = EXCLUDED.tags,
               attachments = EXCLUDED.attachments,
               source_url = EXCLUDED.source_url,
               deadline_at = EXCLUDED.deadline_at
             RETURNING id`,
            [
              notification.id,
              notification.title,
              notification.summary || '',
              notification.action_required || null,
              notification.content || '',
              notification.source_channel || 'DUT_GENERAL',
              notification.classified_by || 'RULE_ENGINE',
              notification.scope || 'GLOBAL',
              validPriority,
              notification.priority_score || 0,
              notification.course_code || null,
              notification.target_faculty || null,
              notification.target_cohort || null,
              !!notification.is_emergency,
              JSON.stringify(notification.tags || []),
              JSON.stringify(notification.attachments || []),
              notification.source_url || null,
              notification.deadline_at || null,
              notification.content_hash,
              notification.published_at,
              notification.created_at,
            ]
          )
          .then((res) => {
            if (res && res.rows && res.rows[0] && res.rows[0].id && res.rows[0].id !== notification.id) {
              const oldId = notification.id;
              const dbId = res.rows[0].id;
              this.notifications.delete(oldId);
              notification.id = dbId;
              this.notifications.set(dbId, notification);
            }
          })
          .catch((err) => console.warn('PG sync error (notifications):', err.message));
      }
    }

    return notification;
  }

  distributeNotification(notificationId, studentId) {
    const exists = this.student_notifications.some(
      (sn) => sn.notification_id === notificationId && sn.student_id === studentId
    );
    if (!exists) {
      this.student_notifications.push({
        student_id: studentId,
        notification_id: notificationId,
        is_read: false,
        read_at: null,
        is_acknowledged: false,
        acknowledged_at: null,
        created_at: new Date().toISOString(),
      });
    }

    if (this.pool) {
      this.pool
        .query(
          `INSERT INTO student_notifications (student_id, notification_id, is_read, is_acknowledged)
           VALUES ($1, $2, FALSE, FALSE)
           ON CONFLICT (student_id, notification_id) DO NOTHING`,
          [studentId, notificationId]
        )
        .catch((err) => console.warn('PG sync error (student_notifications):', err.message));
    }
  }

  saveDeadline(deadline) {
    if (!deadline.deadline_id) deadline.deadline_id = crypto.randomUUID();
    deadline.created_at = deadline.created_at || new Date().toISOString();
    deadline.updated_at = new Date().toISOString();
    this.deadlines.set(deadline.deadline_id, deadline);

    if (this.pool) {
      this.pool
        .query(
          `INSERT INTO deadlines (deadline_id, student_id, course_code, title, description, due_date, status, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (deadline_id) DO UPDATE SET
             title = EXCLUDED.title,
             description = EXCLUDED.description,
             due_date = EXCLUDED.due_date,
             status = EXCLUDED.status,
             updated_at = NOW()`,
          [
            deadline.deadline_id,
            deadline.student_id,
            deadline.course_code || null,
            deadline.title,
            deadline.description || '',
            deadline.due_date,
            deadline.status || 'PENDING',
          ]
        )
        .catch((err) => console.warn('PG sync error (deadlines):', err.message));
    }

    return deadline;
  }

  deleteDeadline(deadlineId) {
    this.deadlines.delete(deadlineId);
    if (this.pool) {
      this.pool
        .query('DELETE FROM deadlines WHERE deadline_id = $1', [deadlineId])
        .catch(() => {});
    }
  }

  getDeadlinesByStudent(studentId, filters = {}) {
    let list = Array.from(this.deadlines.values()).filter(
      (d) => d.student_id === studentId
    );
    if (filters.status) {
      list = list.filter((d) => d.status === filters.status);
    }
    if (filters.course_code) {
      list = list.filter((d) => d.course_code === filters.course_code);
    }
    list.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    return list;
  }
}

const defaultInMemoryStore = new InMemoryDbStore();

function getDbStore() {
  return defaultInMemoryStore;
}

module.exports = {
  getPool,
  InMemoryDbStore,
  getDbStore,
};

