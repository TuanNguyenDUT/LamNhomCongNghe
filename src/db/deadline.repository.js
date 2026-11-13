/**
 * TASK 2 & 4: Tầng truy xuất dữ liệu Deadlines & Logic tự động phân loại trạng thái
 * Hỗ trợ PostgreSQL và In-Memory Fallback khi chưa cấu hình CSDL
 */

const DEFAULT_COURSES = [
  { course_code: 'IT401', course_name: 'Công nghệ phần mềm', course_tag: '#IT401-CNPM' },
  { course_code: 'IT302', course_name: 'Mạng máy tính', course_tag: '#IT302-NET' },
  { course_code: 'IT501', course_name: 'Trí tuệ nhân tạo', course_tag: '#IT501-AI' },
  { course_code: 'IT305', course_name: 'Hệ cơ sở dữ liệu', course_tag: '#IT305-DBMS' },
  { course_code: 'IT210', course_name: 'Lập trình web', course_tag: '#IT210-WEB' },
  { course_code: 'MATH201', course_name: 'Giải tích', course_tag: '#MATH201-CALC' },
];

/**
 * Thuật toán tính toán trạng thái hạn chót tự động (Task 4)
 * - Đã tick checkbox => COMPLETED
 * - Quá hạn (due_date < now) => OVERDUE
 * - Sắp đến (trong vòng 48h tới) => DUE_SOON
 * - Còn nhiều thời gian (> 48h) => UPCOMING
 */
function computeDeadlineStatus(dueDate, isCompleted = false) {
  if (isCompleted) {
    return 'COMPLETED';
  }
  const now = new Date();
  const target = new Date(dueDate);
  const diffHours = (target.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours < 0) {
    return 'OVERDUE';
  }
  if (diffHours <= 48) {
    return 'DUE_SOON';
  }
  return 'UPCOMING';
}

class DeadlineRepository {
  constructor(pgPool = null) {
    this.pool = pgPool;
    this.courses = [...DEFAULT_COURSES];

    // Seed sẵn dữ liệu mẫu cho bộ nhớ trong
    const now = new Date();
    this.memoryDeadlines = [
      {
        deadline_id: 1,
        title: 'Nộp báo cáo bài tập lớn CNPM',
        subject: 'IT401',
        course_code: 'IT401',
        due_date: new Date(now.getTime() - 24 * 3600000).toISOString(),
        is_completed: false,
        status: 'OVERDUE',
        note: 'Nộp trên hệ thống LMS',
        created_at: new Date().toISOString(),
      },
      {
        deadline_id: 2,
        title: 'Làm bài tập Mạng máy tính tuần 9',
        subject: 'IT302',
        course_code: 'IT302',
        due_date: new Date(now.getTime() + 20 * 3600000).toISOString(),
        is_completed: false,
        status: 'DUE_SOON',
        note: '',
        created_at: new Date().toISOString(),
      },
      {
        deadline_id: 3,
        title: 'Nộp đồ án giữa kỳ AI',
        subject: 'IT501',
        course_code: 'IT501',
        due_date: new Date(now.getTime() + 50 * 3600000).toISOString(),
        is_completed: false,
        status: 'UPCOMING',
        note: 'File PDF + source code',
        created_at: new Date().toISOString(),
      },
      {
        deadline_id: 4,
        title: 'Bài tập HTML/CSS responsive',
        subject: 'IT210',
        course_code: 'IT210',
        due_date: new Date(now.getTime() + 7 * 86400000).toISOString(),
        is_completed: true,
        status: 'COMPLETED',
        note: 'Đã nộp sớm',
        created_at: new Date().toISOString(),
      },
    ];

    // Bảng lưu Device Tokens (Task 6)
    this.memoryTokens = [];
    this.nextDeadlineId = 5;
    this.nextTokenId = 1;
  }

  // Lấy danh sách môn học
  async getCourses() {
    if (this.pool) {
      const { rows } = await this.pool.query('SELECT * FROM courses ORDER BY course_code ASC');
      return rows;
    }
    return this.courses;
  }

  // Lấy danh sách hạn chót có bộ lọc
  async getDeadlines({ subject, status, search } = {}) {
    if (this.pool) {
      let query = 'SELECT * FROM deadlines WHERE 1=1';
      const params = [];

      if (subject) {
        params.push(subject);
        query += ` AND (subject = $${params.length} OR course_code = $${params.length})`;
      }
      if (status) {
        params.push(status);
        query += ` AND status = $${params.length}`;
      }
      if (search) {
        params.push(`%${search}%`);
        query += ` AND (title ILIKE $${params.length} OR note ILIKE $${params.length})`;
      }

      query += ' ORDER BY due_date ASC';
      const { rows } = await this.pool.query(query, params);
      return rows.map((r) => ({
        ...r,
        status: computeDeadlineStatus(r.due_date, r.is_completed),
      }));
    }

    // In-memory fallback
    return this.memoryDeadlines
      .map((item) => ({
        ...item,
        status: computeDeadlineStatus(item.due_date, item.is_completed),
      }))
      .filter((item) => {
        if (subject && item.subject !== subject && item.course_code !== subject) return false;
        if (status && item.status.toLowerCase() !== status.toLowerCase()) return false;
        if (search) {
          const q = search.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchSub = (item.subject || '').toLowerCase().includes(q);
          if (!matchTitle && !matchSub) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
  }

  // Lấy chi tiết hạn chót
  async getDeadlineById(id) {
    const numId = Number(id);
    if (this.pool) {
      const { rows } = await this.pool.query('SELECT * FROM deadlines WHERE deadline_id = $1', [numId]);
      if (rows.length === 0) return null;
      const row = rows[0];
      return {
        ...row,
        status: computeDeadlineStatus(row.due_date, row.is_completed),
      };
    }

    const item = this.memoryDeadlines.find((d) => d.deadline_id === numId);
    if (!item) return null;
    return {
      ...item,
      status: computeDeadlineStatus(item.due_date, item.is_completed),
    };
  }

  // Thêm mới hạn chót
  async createDeadline({ title, subject, due_date, note, student_id }) {
    const isCompleted = false;
    const computedStatus = computeDeadlineStatus(due_date, isCompleted);

    if (this.pool) {
      const { rows } = await this.pool.query(
        `INSERT INTO deadlines (title, subject, course_code, due_date, status, is_completed, note, student_id)
         VALUES ($1, $2, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [title, subject, due_date, computedStatus, isCompleted, note || '', student_id || null]
      );
      return rows[0];
    }

    const newRecord = {
      deadline_id: this.nextDeadlineId++,
      title: String(title).trim(),
      subject: String(subject).trim(),
      course_code: String(subject).trim(),
      due_date: new Date(due_date).toISOString(),
      status: computedStatus,
      is_completed: isCompleted,
      note: note ? String(note).trim() : '',
      student_id: student_id || null,
      created_at: new Date().toISOString(),
    };
    this.memoryDeadlines.push(newRecord);
    return newRecord;
  }

  // Cập nhật hạn chót
  async updateDeadline(id, { title, subject, due_date, note, is_completed }) {
    const numId = Number(id);
    const existing = await this.getDeadlineById(numId);
    if (!existing) return null;

    const newDueDate = due_date || existing.due_date;
    const newCompleted = typeof is_completed === 'boolean' ? is_completed : existing.is_completed;
    const computedStatus = computeDeadlineStatus(newDueDate, newCompleted);

    if (this.pool) {
      const { rows } = await this.pool.query(
        `UPDATE deadlines
         SET title = COALESCE($1, title),
             subject = COALESCE($2, subject),
             due_date = COALESCE($3, due_date),
             status = $4,
             is_completed = $5,
             note = COALESCE($6, note),
             updated_at = NOW()
         WHERE deadline_id = $7
         RETURNING *`,
        [title, subject, newDueDate, computedStatus, newCompleted, note, numId]
      );
      return rows[0];
    }

    const index = this.memoryDeadlines.findIndex((d) => d.deadline_id === numId);
    if (index === -1) return null;

    const updated = {
      ...this.memoryDeadlines[index],
      title: title !== undefined ? String(title).trim() : this.memoryDeadlines[index].title,
      subject: subject !== undefined ? String(subject).trim() : this.memoryDeadlines[index].subject,
      course_code: subject !== undefined ? String(subject).trim() : this.memoryDeadlines[index].course_code,
      due_date: newDueDate ? new Date(newDueDate).toISOString() : this.memoryDeadlines[index].due_date,
      status: computedStatus,
      is_completed: newCompleted,
      note: note !== undefined ? String(note).trim() : this.memoryDeadlines[index].note,
      updated_at: new Date().toISOString(),
    };
    this.memoryDeadlines[index] = updated;
    return updated;
  }

  // Đổi trạng thái hoàn thành (Checkbox tick - Task 4)
  async toggleComplete(id) {
    const existing = await this.getDeadlineById(id);
    if (!existing) return null;
    return this.updateDeadline(id, { is_completed: !existing.is_completed });
  }

  // Xóa hạn chót
  async deleteDeadline(id) {
    const numId = Number(id);
    if (this.pool) {
      const { rowCount } = await this.pool.query('DELETE FROM deadlines WHERE deadline_id = $1', [numId]);
      return rowCount > 0;
    }

    const idx = this.memoryDeadlines.findIndex((d) => d.deadline_id === numId);
    if (idx === -1) return false;
    this.memoryDeadlines.splice(idx, 1);
    return true;
  }

  // ==========================================
  // TASK 6: LƯU TRỮ TOKEN FCM / APNs VÀO DB
  // ==========================================
  async saveDeviceToken({ student_id, device_token, platform = 'WEB', device_model = 'Browser' }) {
    if (this.pool) {
      const { rows } = await this.pool.query(
        `INSERT INTO user_device_tokens (student_id, device_token, platform, device_model, is_active, last_used_at)
         VALUES ($1, $2, $3, $4, TRUE, NOW())
         ON CONFLICT (device_token)
         DO UPDATE SET last_used_at = NOW(), is_active = TRUE
         RETURNING *`,
        [student_id || null, device_token, platform, device_model]
      );
      return rows[0];
    }

    const existingIndex = this.memoryTokens.findIndex((t) => t.device_token === device_token);
    if (existingIndex >= 0) {
      this.memoryTokens[existingIndex].last_used_at = new Date().toISOString();
      this.memoryTokens[existingIndex].is_active = true;
      return this.memoryTokens[existingIndex];
    }

    const tokenRecord = {
      token_id: this.nextTokenId++,
      student_id: student_id || null,
      device_token,
      platform,
      device_model,
      is_active: true,
      created_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
    };
    this.memoryTokens.push(tokenRecord);
    return tokenRecord;
  }

  async getAllDeviceTokens() {
    if (this.pool) {
      const { rows } = await this.pool.query('SELECT * FROM user_device_tokens WHERE is_active = TRUE');
      return rows;
    }
    return this.memoryTokens.filter((t) => t.is_active);
  }
}

module.exports = {
  DeadlineRepository,
  computeDeadlineStatus,
};
