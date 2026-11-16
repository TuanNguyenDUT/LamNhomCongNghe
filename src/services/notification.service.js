/**
 * DỊCH VỤ ĐIỀU PHỐI THÔNG BÁO TRUNG TÂM (NOTIFICATION SERVICE)
 * Triển khai theo đặc tả AGENT.md (FR-02, FR-07, FR-08 & TSD Mục 3.1)
 *
 * Chức năng:
 * 1. Chống trùng lặp tin bằng mã băm SHA-256 (content_hash)
 * 2. Tiếp nhận tin (ingest) -> Smart Classifier -> Lưu DB
 * 3. Tự động sinh mốc hạn chót (Deadline) nếu tin có deadline_at
 * 4. Điều phối bắn thông báo đẩy FCM
 * 5. Xác nhận đã nhận tin khẩn cấp (Read Receipt - ack)
 */

const crypto = require('node:crypto');
const { getDbStore } = require('../config/db');
const { classifySmartNotification, detectNotificationTopics } = require('./classifier.service');
const { deadlineService } = require('./deadline.service');
const { sendPushNotification } = require('./pushNotificationService');

/**
 * Kiểm tra xem một thông báo có thuộc về đối tượng sinh viên cụ thể hay không.
 * - Thông báo chung (GLOBAL): hiển thị cho tất cả.
 * - Thông báo cá nhân (PERSONAL): chỉ hiển thị nếu đúng mã sinh viên.
 * - Thông báo Lớp học phần (DUT_COURSE_CLASS): BẮT BUỘC phải thuộc các học phần sinh viên đang học.
 *   Xác định qua: Mã học phần đầy đủ (VD: 1023910.2610.23.16), hoặc Nhóm lớp (23.Nh16/23.16) + Tên môn.
 */
function isNoticeForStudent(notification, student, studentCourses = []) {
  if (!student) return true;

  const sourceChannel = notification.source_channel || notification.source_type;

  // 1. Các kênh thông báo chung toàn trường (GLOBAL)
  const GLOBAL_CHANNELS = [
    'DUT_GENERAL',
    'DUT_TRAINING',
    'DUT_STUDENT_AFFAIRS',
    'DUT_TUITION_FEE',
    'DUT_TESTING_QA',
    'DUT_REGULATIONS',
    'FB_CTSV',
    'FB_TUVAN_SV',
  ];
  if (GLOBAL_CHANNELS.includes(sourceChannel) || notification.scope === 'GLOBAL') {
    return true;
  }

  // 2. Thông báo cá nhân (PERSONAL)
  if (notification.scope === 'PERSONAL') {
    const sCode = student.student_code || student.student_id;
    const sId = student.id;
    return (
      notification.target_student_id === sCode ||
      notification.target_student_id === sId ||
      (notification.content && sCode && notification.content.includes(sCode))
    );
  }

  // 3. Thông báo Lớp học phần (DUT_COURSE_CLASS / scope === 'COURSE' / scope === 'CLASS')
  if (
    sourceChannel === 'DUT_COURSE_CLASS' ||
    notification.scope === 'COURSE' ||
    notification.scope === 'CLASS'
  ) {
    if (!studentCourses || studentCourses.length === 0) {
      return false;
    }

    const notifText = `${notification.title} ${notification.content || ''}`.toLowerCase();
    const groupMatch = (notification.title + ' ' + (notification.content || '')).match(/\[(\d{2}\.(?:Nh)?[0-9A-Za-z]+)\]/i);
    const notifGroupNorm = groupMatch ? groupMatch[1].replace(/Nh/i, '').toUpperCase() : null;

    for (const sc of studentCourses) {
      const courseCode = (sc.course_code || '').trim();
      const courseName = (sc.course_name || '').trim().toLowerCase();

      // a) Trùng khớp mã học phần trực tiếp (VD: 1023910.2610.23.16 hoặc IT401)
      if (notification.course_code && notification.course_code.toLowerCase() === courseCode.toLowerCase()) {
        return true;
      }
      if (courseCode && notifText.includes(courseCode.toLowerCase())) {
        return true;
      }

      // b) Trùng khớp theo quy tắc mã chuẩn: <MãHP>.<Kỳ>.<Khóa>.<Lớp>
      // VD: 1023603.2610.23.99 -> Khóa 23, Lớp 99 -> Nhóm "23.99" / "23.Nh99"
      const parts = courseCode.split('.');
      if (parts.length >= 4) {
        const hpPrefix = `${parts[0]}.${parts[1]}`.toLowerCase(); // 1023603.2610
        const courseCohort = parts[2]; // 23
        const courseClass = parts[3]; // 99 hoặc 16 hoặc 16A
        const courseGroupNorm = `${courseCohort}.${courseClass}`.toUpperCase(); // 23.99

        // Nếu thông báo có chứa tiền tố mã học phần và khớp nhóm
        if (notifText.includes(hpPrefix) && (!notifGroupNorm || notifGroupNorm === courseGroupNorm)) {
          return true;
        }

        // Nếu thông báo có nhóm lớp [23.Nh99] và tên môn học khớp
        if (notifGroupNorm && notifGroupNorm === courseGroupNorm) {
          if (courseName && (notifText.includes(courseName) || (notification.title && notification.title.toLowerCase().includes(courseName)))) {
            return true;
          }
        }
      }

      // c) Mã ngắn legacy (IT401, IT302...)
      if (courseCode.length <= 8 && notifText.includes(courseCode.toLowerCase())) {
        return true;
      }
    }

    // Nếu là thông báo Lớp học phần nhưng KHÔNG khớp bất kỳ môn nào của sinh viên này -> KHÔNG hiển thị!
    return false;
  }

  return true;
}

class NotificationService {
  constructor(dbStore = getDbStore()) {
    this.dbStore = dbStore;
  }

  _getSourceName(sourceChannel) {
    const map = {
      DUT_GENERAL: 'Thông báo chung (Cổng DUT)',
      DUT_TRAINING: 'Phòng Đào tạo',
      DUT_COURSE_CLASS: 'Lớp học phần (Giảng viên)',
      DUT_STUDENT_AFFAIRS: 'Phòng Công tác Sinh viên',
      DUT_TESTING_QA: 'Phòng Khảo thí & ĐBCL',
      DUT_TUITION_FEE: 'Học phí & Kế hoạch Tài chính',
      DUT_REGULATIONS: 'Quy chế & Quy định',
      FB_CTSV: 'Fanpage Phòng Công tác Sinh viên',
      FB_TUVAN_SV: 'Fanpage Tư vấn Sinh viên DUT',
      TRAINING_DEPT: 'Phòng Đào tạo',
      FACULTY: 'Khoa',
      CLASS_SECTION: 'Lớp học phần',
      STUDENT_EMAIL: 'Email Sinh viên',
      EXTRACURRICULAR: 'Đoàn Thanh niên & Ngoại khóa',
    };
    return map[sourceChannel] || 'Thông báo DUT';
  }

  /**
   * Chuẩn hóa tiêu đề bài viết để so khớp và tính mã băm chống trùng lặp chính xác
   */
  _normalizeTitle(title) {
    return String(title || '')
      .normalize('NFKC')
      .replace(/[\p{Extended_Pictographic}\uFE0E\uFE0F\u200D]/gu, ' ')
      .replace(/[«»“”"''\[\]【】–—\-!?:;.,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  /**
   * Tính mã băm SHA-256 chống trùng lặp tin (FR-02)
   */
  generateContentHash({ source_channel = 'DUT_GENERAL', title = '', published_at = '' }) {
    const isFb = source_channel === 'FB_CTSV' || source_channel === 'FB_TUVAN_SV';
    const cleanTitle = isFb ? this._normalizeTitle(title) : String(title || '').replace(/\s+/g, ' ').trim().toLowerCase();
    let datePart = '';
    // Đối với Fanpage Facebook, không băm kèm datePart để tránh lệch ngày quét
    if (isFb) {
      const raw = `${source_channel}|${cleanTitle}`;
      return crypto.createHash('sha256').update(raw).digest('hex');
    }
    try {
      datePart = published_at ? new Date(published_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    } catch {
      datePart = String(published_at || '').slice(0, 10);
    }
    const raw = `${source_channel}|${cleanTitle}|${datePart}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Sửa chữa và dọn dẹp các bài viết Facebook cũ bị lưu link chung hoặc trùng lặp
   */
  async repairAndDeduplicateFacebookNotices() {
    const { fbCrawlerService } = require('./fb-crawler.service');
    const ctsvFallbacks = fbCrawlerService._getCuratedFallbackNotices('FB_CTSV');
    const tuvanFallbacks = fbCrawlerService._getCuratedFallbackNotices('FB_TUVAN_SV');
    const allCurated = [...ctsvFallbacks, ...tuvanFallbacks];

    let repairedCount = 0;
    const seenByChannelAndTitle = new Map();
    const toDeleteIds = new Set();

    for (const [id, n] of this.dbStore.notifications.entries()) {
      if (n.source_channel !== 'FB_CTSV' && n.source_channel !== 'FB_TUVAN_SV') continue;

      const norm = this._normalizeTitle(n.title);
      const key = `${n.source_channel}|${norm}`;

      // 1. Kiểm tra sửa chữa link bài viết nếu đang là link trang chủ Fanpage chung
      const isGenericUrl = !n.source_url || !n.source_url.includes('/posts/') || n.source_url.endsWith('/ctsvdhbkdhdn') || n.source_url.endsWith('/tuvansinhvien.dut');
      if (isGenericUrl) {
        for (const c of allCurated) {
          const cNorm = this._normalizeTitle(c.title);
          if (norm.length > 10 && (norm === cNorm || norm.includes(cNorm) || cNorm.includes(norm))) {
            n.source_url = c.source_url;
            if ((!n.attachments || n.attachments.length === 0) && c.attachments && c.attachments.length > 0) {
              n.attachments = c.attachments;
            }
            if ((!n.content || n.content.length < (c.content || '').length) && c.content) {
              n.content = c.content;
            }
            if (c.published_at && !n.published_at) {
              n.published_at = c.published_at;
            }
            this.dbStore.saveNotification(n);
            if (this.dbStore.pool) {
              await this.dbStore.pool.query(
                'UPDATE notifications SET source_url = $1, attachments = $2::jsonb, content = $3, published_at = $4 WHERE id = $5',
                [n.source_url, JSON.stringify(n.attachments || []), n.content || '', n.published_at, n.id]
              ).catch(() => {});
            }
            repairedCount++;
            break;
          }
        }
      }

      // 2. Kiểm tra trùng lặp
      if (seenByChannelAndTitle.has(key)) {
        const first = seenByChannelAndTitle.get(key);
        const firstIsSpecific = first.source_url && first.source_url.includes('/posts/');
        const nIsSpecific = n.source_url && n.source_url.includes('/posts/');

        let keepRecord = first;
        let deleteRecord = n;

        if (!firstIsSpecific && nIsSpecific) {
          keepRecord = n;
          deleteRecord = first;
          seenByChannelAndTitle.set(key, n);
        } else if (firstIsSpecific && nIsSpecific) {
          // Ưu tiên bản ghi có nội dung đầy đủ hơn
          if ((n.content || '').length > (first.content || '').length) {
            keepRecord = n;
            deleteRecord = first;
            seenByChannelAndTitle.set(key, n);
          }
        }

        // Kế thừa dữ liệu attachments và content nếu bản ghi bị xóa có nội dung đầy đủ hơn
        let keepUpdated = false;
        if ((!keepRecord.attachments || keepRecord.attachments.length === 0) && deleteRecord.attachments && deleteRecord.attachments.length > 0) {
          keepRecord.attachments = deleteRecord.attachments;
          keepUpdated = true;
        }
        if ((!keepRecord.content || keepRecord.content.length < 50) && deleteRecord.content && deleteRecord.content.length > 50) {
          keepRecord.content = deleteRecord.content;
          keepUpdated = true;
        }
        if (keepUpdated) {
          this.dbStore.saveNotification(keepRecord);
          if (this.dbStore.pool) {
            await this.dbStore.pool.query(
              'UPDATE notifications SET attachments = $1::jsonb, content = $2 WHERE id = $3',
              [JSON.stringify(keepRecord.attachments || []), keepRecord.content || '', keepRecord.id]
            ).catch(() => {});
          }
        }

        toDeleteIds.add(deleteRecord.id);
      } else {
        seenByChannelAndTitle.set(key, n);
      }
    }

    // Xóa các bản ghi trùng lặp
    for (const delId of toDeleteIds) {
      this.dbStore.notifications.delete(delId);
      if (this.dbStore.student_notifications) {
        this.dbStore.student_notifications = this.dbStore.student_notifications.filter(
          (sn) => sn.notification_id !== delId
        );
      }
      if (this.dbStore.pool) {
        await this.dbStore.pool.query('DELETE FROM notifications WHERE id = $1', [delId]).catch(() => {});
      }
    }

    return { repairedCount, deletedDuplicates: toDeleteIds.size };
  }

  /**
   * Dọn dẹp các bài viết Facebook cũ hoặc trùng lặp để nạp mới 100% dữ liệu thật
   */
  async purgeMockAndDuplicateFacebookNotices() {
    const fbIds = [];
    for (const [id, n] of this.dbStore.notifications.entries()) {
      if (n.source_channel === 'FB_CTSV' || n.source_channel === 'FB_TUVAN_SV') {
        fbIds.push(id);
        this.dbStore.notifications.delete(id);
      }
    }
    if (this.dbStore.student_notifications) {
      this.dbStore.student_notifications = this.dbStore.student_notifications.filter(
        (sn) => !fbIds.includes(sn.notification_id)
      );
    }
    if (this.dbStore.pool) {
      try {
        await this.dbStore.pool.query(
          "DELETE FROM notifications WHERE source_channel IN ('FB_CTSV', 'FB_TUVAN_SV')"
        );
      } catch (_) {}
    }
    return fbIds.length;
  }

  /**
   * Tiếp nhận & xử lý thông báo mới (Ingestion Pipeline)
   */
  async ingestNotification(payload = {}) {
    const sourceChannel = payload.source_channel || payload.source_type || 'DUT_GENERAL';
    const isFb = sourceChannel === 'FB_CTSV' || sourceChannel === 'FB_TUVAN_SV';
    const title = (payload.title || '').replace(/\s+/g, ' ').trim();
    const cleanTitle = String(title || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const content = payload.content || '';
    const publishedAt = payload.published_at || new Date().toISOString();

    // 1. Kiểm tra chống trùng lặp bằng SHA-256
    const contentHash = this.generateContentHash({
      source_channel: sourceChannel,
      title,
      published_at: publishedAt,
    });

    let existing = this.dbStore.findNotificationByHash(contentHash);

    // 1b. Chống trùng lặp nâng cao cho các bài đăng Fanpage Facebook
    if (isFb && !existing) {
      const normInputTitle = this._normalizeTitle(title);
      existing = Array.from(this.dbStore.notifications.values()).find((n) => {
        if (n.source_channel !== sourceChannel) return false;
        // Kiểm tra trùng link bài viết trực tiếp hoặc cùng ID bài viết
        if (payload.source_url && n.source_url) {
          const u1 = payload.source_url.replace(/\/$/, '');
          const u2 = n.source_url.replace(/\/$/, '');
          if (u1 === u2) return true;
          const m1 = u1.match(/\/posts\/([a-zA-Z0-9_-]+)/);
          const m2 = u2.match(/\/posts\/([a-zA-Z0-9_-]+)/);
          if (m1 && m2 && m1[1] === m2[1]) return true;
        }
        // Kiểm tra trùng tiêu đề chuẩn hóa
        const normExistingTitle = this._normalizeTitle(n.title);
        return normInputTitle.length > 10 && normInputTitle === normExistingTitle;
      });
    }

    if (existing) {
      let isUpdated = false;

      // Cập nhật source_url nếu bài viết cũ lưu link Fanpage chung hoặc thiếu link bài cụ thể
      if (isFb && payload.source_url) {
        const isPayloadSpecific = payload.source_url.includes('/posts/');
        const isExistingGeneric = !existing.source_url || !existing.source_url.includes('/posts/') || existing.source_url.endsWith('/ctsvdhbkdhdn') || existing.source_url.endsWith('/tuvansinhvien.dut');
        if (isPayloadSpecific && (isExistingGeneric || existing.source_url !== payload.source_url)) {
          existing.source_url = payload.source_url;
          isUpdated = true;
        }
      }

      // Cập nhật attachments nếu payload có liên kết đính kèm thật mà existing chưa có
      if (payload.attachments && payload.attachments.length > 0) {
        if (!existing.attachments || existing.attachments.length === 0) {
          existing.attachments = payload.attachments;
          isUpdated = true;
        }
      }

      // Cập nhật published_at chuẩn
      if (payload.published_at && isFb) {
        existing.published_at = payload.published_at;
        isUpdated = true;
      }

      // Cập nhật content nếu payload có nội dung dài hơn nội dung cũ
      if (isFb && payload.content && (!existing.content || existing.content.length < payload.content.length)) {
        existing.content = payload.content;
        isUpdated = true;
      }

      if (isUpdated) {
        if (isFb && existing.content_hash !== contentHash) {
          existing.content_hash = contentHash;
        }
        this.dbStore.saveNotification(existing);
        if (this.dbStore.pool) {
          await this.dbStore.pool.query(
            'UPDATE notifications SET source_url = $1, attachments = $2::jsonb, published_at = $3, content = $4, content_hash = $5 WHERE id = $6',
            [existing.source_url, JSON.stringify(existing.attachments || []), existing.published_at, existing.content || '', existing.content_hash, existing.id]
          ).catch((e) => console.warn('Failed to update FB existing notice in DB:', e.message));
        }
      }

      // Xóa các bản ghi trùng lặp tàn dư (nếu có bài cũ bị nhân bản với tiêu đề gần giống)
      if (isFb) {
        const normInputTitle = this._normalizeTitle(title);
        const dupIdsToDelete = new Set();
        for (const [id, n] of this.dbStore.notifications.entries()) {
          if (id === existing.id || n.source_channel !== sourceChannel) continue;
          const normNTitle = this._normalizeTitle(n.title);
          const sameTitle = normInputTitle.length > 10 && normInputTitle === normNTitle;
          const sameUrl = payload.source_url && n.source_url && payload.source_url.includes('/posts/') && n.source_url === payload.source_url;
          if (sameTitle || sameUrl) {
            dupIdsToDelete.add(id);
          }
        }
        for (const dupId of dupIdsToDelete) {
          this.dbStore.notifications.delete(dupId);
          if (this.dbStore.student_notifications) {
            this.dbStore.student_notifications = this.dbStore.student_notifications.filter(
              (sn) => sn.notification_id !== dupId
            );
          }
          if (this.dbStore.pool) {
            await this.dbStore.pool.query('DELETE FROM notifications WHERE id = $1', [dupId]).catch(() => {});
          }
        }
      }

      return {
        status: 'DUPLICATE',
        message: 'Thông báo đã tồn tại trên hệ thống (đã đồng bộ dữ liệu chuẩn)',
        notification: existing,
      };
    }

    // 1c. Chống trùng lặp chéo giữa các chuyên mục của nhà trường (VD: Thông báo chung & Phòng Đào tạo)
    let datePart = '';
    try {
      datePart = publishedAt ? new Date(publishedAt).toISOString().slice(0, 10) : '';
    } catch {
      datePart = String(publishedAt || '').slice(0, 10);
    }
    const crossExisting = Array.from(this.dbStore.notifications.values()).find((n) => {
      const nClean = String(n.title || '').replace(/\s+/g, ' ').trim().toLowerCase();
      let nDate = '';
      try {
        nDate = n.published_at ? new Date(n.published_at).toISOString().slice(0, 10) : '';
      } catch {
        nDate = String(n.published_at || '').slice(0, 10);
      }
      return nClean === cleanTitle && nDate === datePart;
    });

    if (crossExisting) {
      if (crossExisting.source_channel === 'DUT_GENERAL' && sourceChannel !== 'DUT_GENERAL') {
        crossExisting.source_channel = sourceChannel;
        crossExisting.source_name = payload.source_name || this._getSourceName(sourceChannel);
        this.dbStore.saveNotification(crossExisting);
      }
      return {
        status: 'DUPLICATE',
        message: 'Thông báo đã tồn tại trên hệ thống (trùng khớp tiêu đề và ngày đăng giữa các chuyên mục)',
        notification: crossExisting,
      };
    }

    // 2. Chạy Smart Classification Router (Rules Engine + AI API)
    const classified = await classifySmartNotification({
      ...payload,
      source_channel: sourceChannel,
      title,
      content,
    });

    // 3. Chuẩn bị đối tượng thông báo đầy đủ theo Schema
    const notification = {
      id: crypto.randomUUID(),
      title,
      summary: classified.summary || title,
      action_required: classified.action_required || null,
      content,
      source_channel: sourceChannel,
      source_type: sourceChannel,
      source_name: payload.source_name || this._getSourceName(sourceChannel),
      sender_name: payload.sender_name || payload.source_name || this._getSourceName(sourceChannel),
      classified_by: classified.classified_by || 'RULE_ENGINE',
      scope: classified.scope || 'GLOBAL',
      scope_type: classified.scope_type || classified.scope || 'GLOBAL',
      priority: classified.priority || 'NORMAL',
      priority_score: classified.priority_score || 0,
      course_code: (sourceChannel === 'FB_CTSV' || sourceChannel === 'FB_TUVAN_SV') ? null : (classified.course_code || null),
      target_faculty: payload.target_faculty || null,
      target_cohort: payload.target_cohort || null,
      is_emergency: Boolean(classified.is_emergency),
      tags: (sourceChannel === 'FB_CTSV' || sourceChannel === 'FB_TUVAN_SV')
        ? (classified.tags || []).filter(t => !t.includes('LớpHọcPhần') && !t.includes('IT408') && !t.includes('SSH101'))
        : (classified.tags || []),
      attachments: payload.attachments || [],
      source_url: payload.source_url || null,
      deadline_at: classified.deadline_at || null,
      content_hash: contentHash,
      published_at: publishedAt,
      created_at: new Date().toISOString(),
    };

    // 4. Lưu vào CSDL
    this.dbStore.saveNotification(notification);

    // 5. Phân phối tới sinh viên mục tiêu (đúng học phần của sinh viên)
    for (const student of this.dbStore.students.values()) {
      const studentCourses = this.dbStore.getStudentCourses(student.id);
      const isTargeted = isNoticeForStudent(notification, student, studentCourses);

      if (isTargeted) {
        // Tự động map course_code chính xác nếu thông báo chưa gắn course_code
        if (!notification.course_code && (notification.source_channel === 'DUT_COURSE_CLASS' || notification.scope === 'COURSE')) {
          const matched = studentCourses.find((c) => {
            const notifText = `${notification.title} ${notification.content || ''}`.toLowerCase();
            return notifText.includes(c.course_name.toLowerCase()) || notifText.includes(c.course_code.toLowerCase());
          });
          if (matched) {
            notification.course_code = matched.course_code;
          }
        }

        this.dbStore.distributeNotification(notification.id, student.id);

        // 6. Tự động sinh mốc Deadline nếu tin có hạn chót (FR-06)
        if (notification.deadline_at) {
          await deadlineService.createDeadline({
            student_id: student.id,
            notification_id: notification.id,
            course_code: notification.course_code,
            title: `[Hạn chót] ${notification.title.trim()}`,
            description: notification.action_required || notification.summary,
            due_date: notification.deadline_at,
          });
        }

        // 7. Gửi Push Notification (FCM) theo cơ chế cá nhân hóa & tin khẩn cấp (FR-07)
        let shouldPush = false;
        if (notification.is_emergency || notification.priority === 'URGENT') {
          shouldPush = true; // Tin khẩn cấp luôn luôn gửi để đảm bảo quyền lợi và an toàn sinh viên
        } else if (student.is_personalized_enabled === false) {
          shouldPush = notification.scope === 'COURSE';
        } else {
          const studentTopics = student.interested_topics || ['hoc_vu', 'hoc_bong', 'tuyen_dung'];
          const notifTopics = notification.topics || detectNotificationTopics(notification);
          const hasTopicMatch = notifTopics.some((t) => studentTopics.includes(t));
          shouldPush = hasTopicMatch || notification.scope === 'COURSE';
        }

        if (shouldPush) {
          try {
            await sendPushNotification({
              studentId: student.id,
              title: notification.is_emergency ? `🚨 [KHẨN CẤP] ${notification.title}` : notification.title,
              body: notification.summary || notification.content.slice(0, 100),
              data: {
                notification_id: notification.id,
                is_emergency: String(notification.is_emergency),
                priority: notification.priority,
              },
            });
          } catch (e) {
            // Không làm gián đoạn ingestion khi FCM chưa cấu hình local
          }
        }
      }
    }

    return {
      status: 'INSERTED',
      message: 'Thu thập và phân loại thông báo thành công',
      notification,
    };
  }

  /**
   * Phân phối các thông báo hiện có và bóc tách deadline cho sinh viên mới đăng nhập
   * Đảm bảo chỉ phân phối thông báo học phần thuộc các lớp sinh viên đang học
   * Tuyệt đối không sinh lặp lại deadline đã có
   */
  async distributeExistingNotificationsToStudent(student) {
    if (!student || !student.id) return;
    const studentCourses = this.dbStore.getStudentCourses(student.id);

    // Lấy trước các hạn chót hiện có của sinh viên để chống tạo lặp
    const existingDeadlines = await deadlineService.getDeadlines(student.id);

    for (const notification of this.dbStore.notifications.values()) {
      const isTargeted = isNoticeForStudent(notification, student, studentCourses);

      if (isTargeted) {
        // Gắn course_code nếu notification thuộc môn của sinh viên nhưng chưa có mã
        if (!notification.course_code && (notification.source_channel === 'DUT_COURSE_CLASS' || notification.scope === 'COURSE')) {
          const matched = studentCourses.find((c) => {
            const notifText = `${notification.title} ${notification.content || ''}`.toLowerCase();
            return notifText.includes(c.course_name.toLowerCase()) || notifText.includes(c.course_code.toLowerCase());
          });
          if (matched) {
            notification.course_code = matched.course_code;
          }
        }

        this.dbStore.distributeNotification(notification.id, student.id);
        if (notification.deadline_at) {
          const cleanNotifTitle = (notification.title || '').trim().replace(/^\[(?:hạn chót|nhắc nhở)\]\s*/i, '').replace(/\s+/g, ' ').toLowerCase();
          const alreadyHas = existingDeadlines.some(
            (d) => (d.notification_id && d.notification_id === notification.id) ||
              (d.title || '').trim().replace(/^\[(?:hạn chót|nhắc nhở)\]\s*/i, '').replace(/\s+/g, ' ').toLowerCase() === cleanNotifTitle
          );

          if (!alreadyHas) {
            await deadlineService.createDeadline({
              student_id: student.id,
              notification_id: notification.id,
              course_code: notification.course_code,
              title: `[Hạn chót] ${notification.title.replace(/\s+/g, ' ').trim()}`,
              description: notification.action_required || notification.summary || notification.content,
              due_date: notification.deadline_at,
            });
          }
        }
      }
    }
  }

  /**
   * Lấy danh sách bảng tin thông báo tập trung (FR-05)
   * Lọc chính xác thông báo học phần cho từng sinh viên cụ thể
   */
  async getFeedNotifications({
    student_id = null,
    source_channel = null,
    priority = null,
    tag = null,
    search = null,
    limit = 50,
    offset = 0,
  } = {}) {
    let list = Array.from(this.dbStore.notifications.values());

    // 1. Phân loại theo đúng đối tượng sinh viên (nếu có student_id)
    let sId = null;
    let student = null;
    let studentCourses = [];
    if (student_id) {
      student = this.dbStore.findStudentByCodeOrId(student_id);
      sId = student ? student.id : student_id;
      studentCourses = sId ? this.dbStore.getStudentCourses(sId) : [];
      if (student) {
        list = list.filter((n) => isNoticeForStudent(n, student, studentCourses));
      }
    }

    // Lọc theo source_channel
    if (source_channel && source_channel !== 'ALL') {
      list = list.filter((n) => n.source_channel === source_channel || n.source_type === source_channel);
    }

    // Lọc theo độ ưu tiên
    if (priority) {
      list = list.filter((n) => n.priority === priority);
    }

    // Lọc theo tag
    if (tag) {
      list = list.filter((n) => n.tags && n.tags.includes(tag));
    }

    // Tìm kiếm từ khóa
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((n) =>
        (n.title && n.title.toLowerCase().includes(q)) ||
        (n.content && n.content.toLowerCase().includes(q)) ||
        (n.summary && n.summary.toLowerCase().includes(q)) ||
        (n.course_code && n.course_code.toLowerCase().includes(q)) ||
        (n.tags && n.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }

    // Sắp xếp: tin khẩn cấp lên đầu, ưu tiên tin thuộc chủ đề sinh viên quan tâm nếu bật cá nhân hóa trên Bảng tin mặc định
    const isPersonalized = student && student.is_personalized_enabled !== false;
    const studentTopics = isPersonalized ? (student.interested_topics || ['hoc_vu', 'hoc_bong', 'tuyen_dung']) : [];

    const getTopicMatchScore = (n) => {
      if (!isPersonalized || studentTopics.length === 0) return 0;
      const notifTopics = n.topics || detectNotificationTopics(n);
      return notifTopics.some((t) => studentTopics.includes(t)) ? 1 : 0;
    };

    list.sort((a, b) => {
      if (a.is_emergency && !b.is_emergency) return -1;
      if (!a.is_emergency && b.is_emergency) return 1;

      // Ưu tiên hiển thị nội dung cá nhân hóa trên tab Bảng tin mặc định (ALL)
      if ((!source_channel || source_channel === 'ALL') && isPersonalized) {
        const scoreA = getTopicMatchScore(a);
        const scoreB = getTopicMatchScore(b);
        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }
      }

      return new Date(b.published_at) - new Date(a.published_at);
    });

    // Chống trùng lặp tuyệt đối khi trả về danh sách Bảng tin (Deduplicate on feed display)
    const seenNotif = new Set();
    list = list.filter((n) => {
      const cleanTitle = (n.title || '').trim().replace(/\s+/g, ' ').toLowerCase();
      const channel = n.source_channel || '';
      // Đối với Fanpage Facebook, khóa deduplicate theo tiêu đề và kênh (bất kể lệch ngày quét)
      const isFb = channel === 'FB_CTSV' || channel === 'FB_TUVAN_SV';
      let datePart = '';
      if (!isFb) {
        try {
          datePart = n.published_at ? new Date(n.published_at).toISOString().slice(0, 10) : '';
        } catch {
          datePart = String(n.published_at || '').slice(0, 10);
        }
      }
      const key = `${cleanTitle}|${channel}|${datePart}`;
      if (seenNotif.has(key)) {
        return false;
      }
      seenNotif.add(key);
      return true;
    });

    // Bổ sung trạng thái is_read, is_acknowledged của sinh viên nếu có student_id

    const items = list.slice(offset, offset + limit).map((n) => {
      let isRead = false;
      let isAcknowledged = false;
      if (sId) {
        const record = this.dbStore.student_notifications.find(
          (sn) => sn.notification_id === n.id && sn.student_id === sId
        );
        if (record) {
          isRead = Boolean(record.is_read);
          isAcknowledged = Boolean(record.is_acknowledged);
        }
      }
      return {
        ...n,
        topics: n.topics || detectNotificationTopics(n),
        is_read: isRead,
        is_acknowledged: isAcknowledged,
      };
    });

    return {
      total: list.length,
      limit,
      offset,
      notifications: items,
    };
  }

  /**
   * Xác nhận đã nhận / đã hiểu thông báo khẩn cấp (Read Receipt - ack) (FR-08)
   */
  async acknowledgeEmergencyNotification(notificationId, studentId) {
    const student = this.dbStore.findStudentByCodeOrId(studentId);
    const sId = student ? student.id : (studentId || 'a0000000-0000-0000-0000-000000000001');

    const record = this.dbStore.student_notifications.find(
      (sn) => sn.notification_id === notificationId && sn.student_id === sId
    );

    if (record) {
      record.is_acknowledged = true;
      record.acknowledged_at = new Date().toISOString();
      record.is_read = true;
      record.read_at = record.read_at || new Date().toISOString();
    } else {
      this.dbStore.student_notifications.push({
        student_id: sId,
        notification_id: notificationId,
        is_read: true,
        read_at: new Date().toISOString(),
        is_acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
    }

    return {
      success: true,
      notification_id: notificationId,
      student_id: sId,
      acknowledged_at: new Date().toISOString(),
      message: 'Đã xác nhận nhận tin khẩn cấp thành công (Read Receipt)',
    };
  }

  /**
   * Dọn sạch các bài đăng FB giả lập, trùng lặp hoặc có link ảo
   */
  async purgeMockAndDuplicateFacebookNotices() {
    const toDeleteIds = [];
    const seen = new Set();
    for (const [id, n] of this.dbStore.notifications.entries()) {
      if (n.source_channel === 'FB_CTSV' || n.source_channel === 'FB_TUVAN_SV') {
        const cleanTitle = String(n.title || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const key = `${n.source_channel}|${cleanTitle}`;
        if (seen.has(key)) {
          toDeleteIds.push(id);
        } else {
          seen.add(key);
          if (Array.isArray(n.attachments)) {
            n.attachments = n.attachments.filter(att => {
              const url = typeof att === 'string' ? att : (att && att.url ? att.url : '');
              return url.startsWith('http') && !url.includes('bieu-mau/vay-von') && !url.includes('workshop-ai');
            });
            this.dbStore.saveNotification(n);
          }
        }
      }
    }
    for (const id of toDeleteIds) {
      this.dbStore.notifications.delete(id);
    }
    return { deleted: toDeleteIds.length };
  }
}

const notificationService = new NotificationService();

module.exports = {
  NotificationService,
  notificationService,
};

