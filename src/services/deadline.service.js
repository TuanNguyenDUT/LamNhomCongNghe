/**
 * DỊCH VỤ QUẢN LÝ HẠN CHÓT (DEADLINE MANAGEMENT) & NHẮC HẠN ĐA TẦNG (FR-06, FR-07)
 * Kiến trúc Direct PostgreSQL Query.
 */

const crypto = require('node:crypto');
const { db: defaultDb, createDbAdapter } = require('../config/db');
const { StudentRepository } = require('../db/student.repository');
const { DeadlineRepository, normalizeDeadlineTitle } = require('../db/deadline.repository');
const { detectNotificationCategory, matchesInterestedTopics } = require('./classifier.service');
const { NotFoundError } = require('../utils/errors');

class DeadlineService {
  constructor({ pool = null, db = null, studentRepo = null, deadlineRepo = null } = {}) {
    this.db = db || (pool ? createDbAdapter(pool) : defaultDb);
    this.studentRepo = studentRepo || new StudentRepository(this.db);
    this.deadlineRepo = deadlineRepo || new DeadlineRepository(this.db);
  }

  /**
   * Tạo hạn chót mới (FR-06)
   * Chống trùng lặp tuyệt đối: Nếu đã có hạn chót cho cùng thông báo hoặc cùng tiêu đề, cập nhật bản ghi hiện tại
   */
  async createDeadline(data = {}) {
    const student = await this.studentRepo.requireStudent(data.student_id || data.student_code);
    const targetStudentId = student.id;

    const cleanTitle = normalizeDeadlineTitle(data.title || '');
    const formattedTitle = (data.title || 'Hạn chót học tập').replace(/\s+/g, ' ').trim();
    const isReminder = data.item_type === 'REMINDER' || formattedTitle.startsWith('[Nhắc nhở]');
    const itemType = data.item_type || (isReminder ? 'REMINDER' : 'DEADLINE');

    const existing = await this.deadlineRepo.findDuplicateDeadline(targetStudentId, {
      notificationId: data.notification_id || null,
      cleanTitle,
    });

    if (existing) {
      if (data.due_date) existing.due_date = new Date(data.due_date).toISOString();
      if (data.description && !existing.description) existing.description = data.description;
      if (data.notification_id && !existing.notification_id) existing.notification_id = data.notification_id;
      if (data.course_code && !existing.course_code) existing.course_code = data.course_code;
      if (!existing.item_type) existing.item_type = itemType;
      existing.updated_at = new Date().toISOString();
      this._updateDeadlineStatus(existing);
      return this.deadlineRepo.saveDeadline(existing);
    }

    const catInfo = data.category
      ? {
          category: data.category,
          category_code: data.category_code || null,
          category_name: data.category_name || null,
        }
      : detectNotificationCategory({
          title: formattedTitle,
          content: data.description || '',
        });

    const deadline = {
      deadline_id: crypto.randomUUID(),
      student_id: targetStudentId,
      notification_id: data.notification_id || null,
      course_code: data.course_code || null,
      category: catInfo.category,
      category_code: catInfo.category_code,
      category_name: catInfo.category_name,
      title: formattedTitle,
      description: data.description || '',
      due_date: data.due_date
        ? new Date(data.due_date).toISOString()
        : new Date(Date.now() + 86400000 * 3).toISOString(),
      status: data.status || 'PENDING',
      item_type: itemType,
      google_event_id: data.google_event_id || null,
      last_synced_at: data.last_synced_at || null,
      reminder_stage_sent: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this._updateDeadlineStatus(deadline);
    return this.deadlineRepo.saveDeadline(deadline);
  }

  /**
   * Lấy danh sách hạn chót của sinh viên (FR-06)
   */
  async getDeadlines(studentIdentifier, filters = {}) {
    const student = await this.studentRepo.requireStudent(studentIdentifier);
    let list = await this.deadlineRepo.getDeadlinesByStudent(student.id, filters);

    for (const d of list) {
      this._updateDeadlineStatus(d);
    }

    if (filters.item_type) {
      if (filters.item_type === 'REMINDER') {
        list = list.filter((d) => d.item_type === 'REMINDER' || (d.title && d.title.startsWith('[Nhắc nhở]')));
      } else if (filters.item_type === 'DEADLINE') {
        list = list.filter((d) => d.item_type !== 'REMINDER' && !(d.title && d.title.startsWith('[Nhắc nhở]')));
      }
    }

    for (const d of list) {
      if (!d.category) {
        const catInfo = detectNotificationCategory({
          title: (d.title || '').replace(/^\[(?:hạn chót|nhắc nhở)\]\s*/i, ''),
          content: d.description || '',
        });
        d.category = catInfo.category;
        d.category_code = catInfo.category_code;
        d.category_name = catInfo.category_name;
      }
    }

    const rawCats = filters.categories || filters.category;
    if (rawCats && rawCats !== 'ALL') {
      const catList = (Array.isArray(rawCats) ? rawCats : String(rawCats).split(','))
        .map((c) => c.trim())
        .filter((c) => c && c.toUpperCase() !== 'ALL');
      if (catList.length > 0) {
        list = list.filter((d) => matchesInterestedTopics(d, catList));
      }
    } else if (
      student &&
      student.is_personalized_enabled !== false &&
      Array.isArray(student.interested_topics) &&
      student.interested_topics.length > 0
    ) {
      list = list.filter((d) => matchesInterestedTopics(d, student.interested_topics));
    }

    const seen = new Set();
    const deduped = [];
    for (const d of list) {
      const cleanTitle = normalizeDeadlineTitle(d.title);
      const typeKey = d.item_type || (d.title && d.title.startsWith('[Nhắc nhở]') ? 'REMINDER' : 'DEADLINE');
      const key = `${cleanTitle}|${typeKey}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(d);
    }

    return deduped;
  }

  async getDeadlineById(deadlineId) {
    const deadline = await this.deadlineRepo.getDeadlineById(deadlineId);
    if (!deadline) {
      throw new NotFoundError(`Không tìm thấy deadline với ID: ${deadlineId}`);
    }
    return deadline;
  }

  async updateDeadline(deadlineId, updates = {}) {
    const deadline = await this.getDeadlineById(deadlineId);

    if (updates.title !== undefined) deadline.title = updates.title;
    if (updates.description !== undefined) deadline.description = updates.description;
    if (updates.due_date !== undefined) deadline.due_date = new Date(updates.due_date).toISOString();
    if (updates.course_code !== undefined) deadline.course_code = updates.course_code;
    if (updates.status !== undefined) deadline.status = updates.status;
    if (updates.google_event_id !== undefined) deadline.google_event_id = updates.google_event_id;
    if (updates.last_synced_at !== undefined) deadline.last_synced_at = updates.last_synced_at;

    deadline.updated_at = new Date().toISOString();
    this._updateDeadlineStatus(deadline);
    return this.deadlineRepo.saveDeadline(deadline);
  }

  async markAsCompleted(deadlineId) {
    return this.updateDeadline(deadlineId, { status: 'COMPLETED' });
  }

  async deleteDeadline(deadlineId) {
    const deleted = await this.deadlineRepo.deleteDeadline(deadlineId);
    if (!deleted) {
      throw new NotFoundError(`Không tìm thấy deadline với ID: ${deadlineId}`);
    }
    return { success: true, message: 'Đã xóa hạn chót thành công' };
  }

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
   */
  async processEscalationReminders() {
    const triggeredReminders = [];
    const now = Date.now();
    const deadlines = await this.deadlineRepo.listNonCompletedDeadlines();

    for (const deadline of deadlines) {
      const dueTime = new Date(deadline.due_date).getTime();
      const hoursRemaining = (dueTime - now) / (1000 * 60 * 60);

      if (hoursRemaining <= 0) continue;

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

      if (currentStage > (deadline.reminder_stage_sent || 0)) {
        deadline.reminder_stage_sent = currentStage;
        deadline.updated_at = new Date().toISOString();
        await this.deadlineRepo.saveDeadline(deadline);

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
