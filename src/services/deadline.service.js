/**
 * DỊCH VỤ QUẢN LÝ HẠN CHÓT (DEADLINE MANAGEMENT) & NHẮC HẠN ĐA TẦNG (FR-06, FR-07)
 * Triển khai theo đặc tả AGENT.md
 */

const crypto = require('node:crypto');
const { getDbStore } = require('../config/db');

class DeadlineService {
  constructor(dbStore = getDbStore()) {
    this.dbStore = dbStore;
  }

  /**
   * Tạo hạn chót mới (FR-06)
   * Chống trùng lặp tuyệt đối: Nếu đã có hạn chót cho cùng thông báo hoặc cùng tiêu đề, cập nhật bản ghi hiện tại
   */
  async createDeadline(data = {}) {
    const student = this.dbStore.findStudentByCodeOrId(data.student_id);
    const targetStudentId = student ? student.id : (data.student_id || 'a0000000-0000-0000-0000-000000000001');

    const cleanTitle = (data.title || '').trim().replace(/^\[(?:hạn chót|nhắc nhở)\]\s*/i, '').replace(/\s+/g, ' ').toLowerCase();
    const formattedTitle = (data.title || 'Hạn chót học tập').replace(/\s+/g, ' ').trim();

    const isReminder = data.item_type === 'REMINDER' || formattedTitle.startsWith('[Nhắc nhở]');
    const itemType = data.item_type || (isReminder ? 'REMINDER' : 'DEADLINE');

    // 1. Kiểm tra xem hạn chót/nhắc việc này đã tồn tại cho sinh viên hay chưa
    for (const d of this.dbStore.deadlines.values()) {
      if (d.student_id === targetStudentId) {
        const dCleanTitle = (d.title || '').trim().replace(/^\[(?:hạn chót|nhắc nhở)\]\s*/i, '').replace(/\s+/g, ' ').toLowerCase();
        const sameNotif = data.notification_id && d.notification_id && d.notification_id === data.notification_id;
        const sameTitle = cleanTitle && dCleanTitle === cleanTitle;

        if (sameNotif || sameTitle) {
          // Đã tồn tại -> Cập nhật thông tin và trả về bản ghi hiện tại, KHÔNG TẠO BẢN GHI MỚI!
          if (data.due_date) d.due_date = new Date(data.due_date).toISOString();
          if (data.description && !d.description) d.description = data.description;
          if (data.notification_id && !d.notification_id) d.notification_id = data.notification_id;
          if (data.course_code && !d.course_code) d.course_code = data.course_code;
          if (!d.item_type) d.item_type = itemType;
          d.updated_at = new Date().toISOString();
          this._updateDeadlineStatus(d);
          this.dbStore.saveDeadline(d);
          return d;
        }
      }
    }

    const deadline = {
      deadline_id: crypto.randomUUID(),
      student_id: targetStudentId,
      notification_id: data.notification_id || null,
      course_code: data.course_code || null,
      title: formattedTitle,
      description: data.description || '',
      due_date: data.due_date ? new Date(data.due_date).toISOString() : new Date(Date.now() + 86400000 * 3).toISOString(),
      status: data.status || 'PENDING',
      item_type: itemType,
      google_event_id: data.google_event_id || null,
      last_synced_at: data.last_synced_at || null,
      reminder_stage_sent: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this._updateDeadlineStatus(deadline);
    this.dbStore.saveDeadline(deadline);
    return deadline;
  }

  /**
   * Lấy danh sách hạn chót của sinh viên (FR-06)
   * Tự động khử trùng lặp hiển thị để đảm bảo giao diện luôn hiển thị duy nhất 1 thẻ cho mỗi mốc hạn chót
   */
  async getDeadlines(studentId, filters = {}) {
    const student = this.dbStore.findStudentByCodeOrId(studentId);
    const targetStudentId = student ? student.id : (studentId || 'a0000000-0000-0000-0000-000000000001');

    let list = this.dbStore.getDeadlinesByStudent(targetStudentId, filters);
    // Tự động kiểm tra và cập nhật trạng thái PENDING / DUE_SOON / OVERDUE
    for (const d of list) {
      this._updateDeadlineStatus(d);
    }

    // Lọc theo item_type nếu có: 'DEADLINE' vs 'REMINDER'
    if (filters.item_type) {
      if (filters.item_type === 'REMINDER') {
        list = list.filter((d) => d.item_type === 'REMINDER' || (d.title && d.title.startsWith('[Nhắc nhở]')));
      } else if (filters.item_type === 'DEADLINE') {
        list = list.filter((d) => d.item_type !== 'REMINDER' && !(d.title && d.title.startsWith('[Nhắc nhở]')));
      }
    }

    // Khử trùng lặp trên tầng đọc (Deduplicate on read)
    const seen = new Set();
    const deduped = [];
    for (const d of list) {
      const cleanTitle = (d.title || '').trim().replace(/^\[(?:hạn chót|nhắc nhở)\]\s*/i, '').replace(/\s+/g, ' ').toLowerCase();
      const typeKey = d.item_type || (d.title && d.title.startsWith('[Nhắc nhở]') ? 'REMINDER' : 'DEADLINE');
      const key = `${cleanTitle}|${typeKey}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      deduped.push(d);
    }

    return deduped;
  }

  /**
   * Cập nhật hạn chót (FR-06)
   */
  async updateDeadline(deadlineId, updates = {}) {
    const deadline = this.dbStore.deadlines.get(deadlineId);
    if (!deadline) {
      throw new Error(`Không tìm thấy deadline với ID: ${deadlineId}`);
    }

    if (updates.title !== undefined) deadline.title = updates.title;
    if (updates.description !== undefined) deadline.description = updates.description;
    if (updates.due_date !== undefined) deadline.due_date = new Date(updates.due_date).toISOString();
    if (updates.course_code !== undefined) deadline.course_code = updates.course_code;
    if (updates.status !== undefined) deadline.status = updates.status;
    if (updates.google_event_id !== undefined) deadline.google_event_id = updates.google_event_id;
    if (updates.last_synced_at !== undefined) deadline.last_synced_at = updates.last_synced_at;

    deadline.updated_at = new Date().toISOString();
    this._updateDeadlineStatus(deadline);
    this.dbStore.saveDeadline(deadline);
    return deadline;
  }

  /**
   * Đánh dấu hạn chót đã hoàn thành (FR-06)
   */
  async markAsCompleted(deadlineId) {
    return this.updateDeadline(deadlineId, { status: 'COMPLETED' });
  }

  /**
   * Xóa hạn chót (FR-06)
   */
  async deleteDeadline(deadlineId) {
    if (!this.dbStore.deadlines.has(deadlineId)) {
      throw new Error(`Không tìm thấy deadline với ID: ${deadlineId}`);
    }
    this.dbStore.deadlines.delete(deadlineId);
    return { success: true, message: 'Đã xóa hạn chót thành công' };
  }

  /**
   * Cập nhật trạng thái động (PENDING, DUE_SOON, OVERDUE)
   */
  _updateDeadlineStatus(deadline) {
    if (deadline.status === 'COMPLETED') return;
    const now = Date.now();
    const dueTime = new Date(deadline.due_date).getTime();
    const diffHours = (dueTime - now) / (1000 * 60 * 60);

    if (diffHours < 0) {
      deadline.status = 'OVERDUE';
    } else if (diffHours <= 72) {
      deadline.status = 'DUE_SOON';
    } else {
      deadline.status = 'PENDING';
    }
  }

  /**
   * Worker quét và gửi thông báo nhắc việc leo thang đa tầng (FR-07)
   * Các mốc: Trước 7 ngày (168h), Trước 3 ngày (72h), Trước 1 ngày (24h), Trước 2 giờ (2h)
   */
  async processEscalationReminders() {
    const triggeredReminders = [];
    const now = Date.now();

    for (const deadline of this.dbStore.deadlines.values()) {
      if (deadline.status === 'COMPLETED') continue;

      const dueTime = new Date(deadline.due_date).getTime();
      const hoursRemaining = (dueTime - now) / (1000 * 60 * 60);

      if (hoursRemaining <= 0) continue; // Đã quá hạn

      let currentStage = 0;
      let stageLabel = '';

      if (hoursRemaining <= 2) {
        currentStage = 4;
        stageLabel = 'GẤP: Chỉ còn 2 giờ để hoàn thành!';
      } else if (hoursRemaining <= 24) {
        currentStage = 3;
        stageLabel = 'Nhắc nhở: Hạn chót trong vòng 24 giờ tới.';
      } else if (hoursRemaining <= 72) {
        currentStage = 2;
        stageLabel = 'Nhắc nhở: Hạn chót còn 3 ngày.';
      } else if (hoursRemaining <= 168) {
        currentStage = 1;
        stageLabel = 'Thông báo: Hạn chót còn 7 ngày.';
      }

      // Nếu mốc hiện tại cao hơn mốc đã gửi trước đó -> Kích hoạt nhắc việc
      if (currentStage > (deadline.reminder_stage_sent || 0)) {
        deadline.reminder_stage_sent = currentStage;
        deadline.updated_at = new Date().toISOString();
        this.dbStore.saveDeadline(deadline);

        triggeredReminders.push({
          deadline_id: deadline.deadline_id,
          student_id: deadline.student_id,
          title: deadline.title,
          stage: currentStage,
          stage_label: stageLabel,
          hours_remaining: Math.round(hoursRemaining * 10) / 10,
          due_date: deadline.due_date,
        });
      }
    }

    return triggeredReminders;
  }
}

const deadlineService = new DeadlineService();

module.exports = {
  DeadlineService,
  deadlineService,
};

