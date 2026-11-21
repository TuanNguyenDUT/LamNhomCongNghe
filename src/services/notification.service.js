/**
 * DỊCH VỤ ĐIỀU PHỐI THÔNG BÁO TRUNG TÂM (NOTIFICATION SERVICE)
 * Kiến trúc Direct PostgreSQL Query (FR-02, FR-07, FR-08 & TSD Mục 3.1)
 */

const crypto = require('node:crypto');
const { db: defaultDb, createDbAdapter } = require('../config/db');
const { StudentRepository, isUuid } = require('../db/student.repository');
const { CourseRepository } = require('../db/course.repository');
const {
  NotificationRepository,
  normalizeSourceChannel,
  mapScopeToDb,
} = require('../db/postgres');
const { DeviceTokenRepository } = require('../db/device-token.repository');
const { DeadlineService } = require('./deadline.service');
const { classifySmartNotification, detectNotificationTopics, matchesInterestedTopics } = require('./classifier.service');
const { PushNotificationService } = require('./pushNotificationService');
const { AppError, NotFoundError } = require('../utils/errors');
const { PushDeliveryService } = require('./push-delivery.service');

/**
 * Kiểm tra xem một thông báo có thuộc về đối tượng sinh viên cụ thể hay không.
 */
function isNoticeForStudent(notification, student, studentCourses = []) {
  if (!student) return true;

  const sourceChannel = notification.source_channel || notification.source_type;

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
  if (notification.scope === 'PERSONAL') {
    const sCode = student.student_code || student.student_id;
    const sId = student.id;
    if (notification.target_student_id) {
      return notification.target_student_id === sCode || notification.target_student_id === sId;
    }
    return (
      notification.target_student_id === sCode ||
      notification.target_student_id === sId ||
      (notification.content && sCode && notification.content.includes(sCode))
    );
  }

  if (notification.scope === 'FACULTY' && notification.target_faculty) {
    return notification.target_faculty === student.faculty;
  }
  if (notification.scope === 'COHORT' && notification.target_cohort) {
    return notification.target_cohort === student.cohort;
  }

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

      if (notification.course_code && notification.course_code.toLowerCase() === courseCode.toLowerCase()) {
        return true;
      }
      if (courseCode && notifText.includes(courseCode.toLowerCase())) {
        return true;
      }

      const parts = courseCode.split('.');
      if (parts.length >= 4) {
        const hpPrefix = `${parts[0]}.${parts[1]}`.toLowerCase();
        const courseGroupNorm = `${parts[2]}.${parts[3]}`.toUpperCase();

        if (notifText.includes(hpPrefix) && (!notifGroupNorm || notifGroupNorm === courseGroupNorm)) {
          return true;
        }
        if (notifGroupNorm && notifGroupNorm === courseGroupNorm) {
          if (courseName && (notifText.includes(courseName) || (notification.title && notification.title.toLowerCase().includes(courseName)))) {
            return true;
          }
        }
      }

      if (courseCode.length <= 8 && notifText.includes(courseCode.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  return GLOBAL_CHANNELS.includes(sourceChannel) || notification.scope === 'GLOBAL';
}

class NotificationService {
  constructor({
    pool = null,
    db = null,
    notificationRepo = null,
    studentRepo = null,
    courseRepo = null,
    deadlineSvc = null,
    deviceRepo = null,
    pushService = null,
  } = {}) {
    this.db = db || (pool ? createDbAdapter(pool) : defaultDb);
    this.studentRepo = studentRepo || new StudentRepository(this.db);
    this.courseRepo = courseRepo || new CourseRepository(this.db);
    this.notificationRepo = notificationRepo || new NotificationRepository(this.db);
    this.deadlineSvc = deadlineSvc || new DeadlineService({ db: this.db, studentRepo: this.studentRepo });
    this.deviceRepo = deviceRepo || new DeviceTokenRepository(this.db);
    this.pushService = pushService || new PushNotificationService({ deviceRepository: this.deviceRepo });
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

  async assertCanRead(notificationId, studentIdentifier) {
    const student = await this.studentRepo.requireStudent(studentIdentifier);
    const item = await this.notificationRepo.getNotificationById(notificationId);
    if (!item) throw new NotFoundError('Không tìm thấy thông báo');
    const courses = await this.courseRepo.getStudentCourses(student.id);
    if (!isNoticeForStudent(item, student, courses)) {
      throw new AppError('Không có quyền truy cập thông báo này', { httpStatus: 403, code: 'FORBIDDEN' });
    }
    return item;
  }

  _normalizeTitle(title) {
    return String(title || '')
      .normalize('NFKC')
      .replace(/[\p{Extended_Pictographic}\uFE0E\uFE0F\u200D]/gu, ' ')
      .replace(/[«»“”"''\[\]【】–—\-!?:;.,]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  generateContentHash({ source_channel = 'DUT_GENERAL', title = '', published_at = '' }) {
    const channel = normalizeSourceChannel(source_channel);
    const isFb = channel === 'FB_CTSV' || channel === 'FB_TUVAN_SV';
    const cleanTitle = isFb ? this._normalizeTitle(title) : String(title || '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (isFb) {
      const raw = `${channel}|${cleanTitle}`;
      return crypto.createHash('sha256').update(raw).digest('hex');
    }
    let datePart = '';
    try {
      datePart = published_at ? new Date(published_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    } catch {
      datePart = String(published_at || '').slice(0, 10);
    }
    const raw = `${channel}|${cleanTitle}|${datePart}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  /**
   * Sửa chữa và dọn dẹp các bài viết Facebook cũ bị lưu link chung hoặc trùng lặp (Transactional + Re-link)
   */
  async repairAndDeduplicateFacebookNotices() {
    const { fbCrawlerService } = require('./fb-crawler.service');
    const ctsvFallbacks = fbCrawlerService._getCuratedFallbackNotices('FB_CTSV');
    const tuvanFallbacks = fbCrawlerService._getCuratedFallbackNotices('FB_TUVAN_SV');
    const allCurated = [...ctsvFallbacks, ...tuvanFallbacks];

    return this.db.withTransaction(async (tx) => {
      const fbNotices = await this.notificationRepo.listByChannels(['FB_CTSV', 'FB_TUVAN_SV'], tx);
      let repairedCount = 0;
      const seenByChannelAndTitle = new Map();
      const deletions = []; // { deleteId, keepId }

      for (const n of fbNotices) {
        const norm = this._normalizeTitle(n.title);
        const key = `${n.source_channel}|${norm}`;

        const isGenericUrl =
          !n.source_url ||
          !n.source_url.includes('/posts/') ||
          n.source_url.endsWith('/ctsvdhbkdhdn') ||
          n.source_url.endsWith('/tuvansinhvien.dut');

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
              await this.notificationRepo.updateNotificationById(
                n.id,
                {
                  source_url: n.source_url,
                  attachments: n.attachments || [],
                  content: n.content || '',
                  published_at: n.published_at,
                },
                tx
              );
              repairedCount++;
              break;
            }
          }
        }

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
            if ((n.content || '').length > (first.content || '').length) {
              keepRecord = n;
              deleteRecord = first;
              seenByChannelAndTitle.set(key, n);
            }
          }

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
            await this.notificationRepo.updateNotificationById(
              keepRecord.id,
              {
                attachments: keepRecord.attachments || [],
                content: keepRecord.content || '',
              },
              tx
            );
          }

          deletions.push({ deleteId: deleteRecord.id, keepId: keepRecord.id });
        } else {
          seenByChannelAndTitle.set(key, n);
        }
      }

      for (const { deleteId, keepId } of deletions) {
        await this.notificationRepo.deleteNotificationWithRelink(deleteId, keepId, tx);
      }

      return { repairedCount, deletedDuplicates: deletions.length };
    });
  }

  /**
   * Dọn sạch các bài đăng FB trùng lặp hoặc có link không hợp lệ (giữ 1 implementation chuẩn SQL)
   */
  async purgeMockAndDuplicateFacebookNotices() {
    return this.db.withTransaction(async (tx) => {
      const fbNotices = await this.notificationRepo.listByChannels(['FB_CTSV', 'FB_TUVAN_SV'], tx);
      const seen = new Map();
      const deletions = [];

      for (const n of fbNotices) {
        const cleanTitle = String(n.title || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const key = `${n.source_channel}|${cleanTitle}`;
        if (seen.has(key)) {
          deletions.push({ deleteId: n.id, keepId: seen.get(key).id });
        } else {
          seen.set(key, n);
          if (Array.isArray(n.attachments)) {
            const filteredAtts = n.attachments.filter((att) => {
              const url = typeof att === 'string' ? att : (att && att.url ? att.url : '');
              return url.startsWith('http') && !url.includes('bieu-mau/vay-von') && !url.includes('workshop-ai');
            });
            if (filteredAtts.length !== n.attachments.length) {
              await this.notificationRepo.updateNotificationById(n.id, { attachments: filteredAtts }, tx);
            }
          }
        }
      }

      for (const { deleteId, keepId } of deletions) {
        await this.notificationRepo.deleteNotificationWithRelink(deleteId, keepId, tx);
      }
      return { deleted: deletions.length };
    });
  }

  /**
   * Tiếp nhận & xử lý thông báo mới (Ingestion Pipeline)
   */
  async ingestNotification(payload = {}) {
    const rawChannel = payload.source_channel || payload.source_type || 'DUT_GENERAL';
    const sourceChannel = normalizeSourceChannel(rawChannel);
    const isFb = sourceChannel === 'FB_CTSV' || sourceChannel === 'FB_TUVAN_SV' || sourceChannel.startsWith('FB_');
    const title = (payload.title || '').replace(/\s+/g, ' ').trim();
    const cleanTitle = String(title || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const content = payload.content || '';
    const publishedAt = payload.published_at || new Date().toISOString();

    const contentHash = this.generateContentHash({
      source_channel: sourceChannel,
      title,
      published_at: publishedAt,
    });

    let existing = await this.notificationRepo.findByHash(contentHash);

    if (isFb && !existing) {
      const normInputTitle = this._normalizeTitle(title);
      const fbCandidates = await this.notificationRepo.listByChannels([sourceChannel]);
      existing = fbCandidates.find((n) => {
        if (payload.source_url && n.source_url) {
          const u1 = payload.source_url.replace(/\/$/, '');
          const u2 = n.source_url.replace(/\/$/, '');
          if (u1 === u2) return true;
          const m1 = u1.match(/\/posts\/([a-zA-Z0-9_-]+)/);
          const m2 = u2.match(/\/posts\/([a-zA-Z0-9_-]+)/);
          if (m1 && m2 && m1[1] === m2[1]) return true;
        }
        const normExistingTitle = this._normalizeTitle(n.title);
        return normInputTitle.length > 10 && normInputTitle === normExistingTitle;
      }) || null;
    }

    if (existing) {
      let isUpdated = false;

      if (isFb && payload.source_url) {
        const isPayloadSpecific = payload.source_url.includes('/posts/');
        const isExistingGeneric =
          !existing.source_url ||
          !existing.source_url.includes('/posts/') ||
          existing.source_url.endsWith('/ctsvdhbkdhdn') ||
          existing.source_url.endsWith('/tuvansinhvien.dut');
        if (isPayloadSpecific && (isExistingGeneric || existing.source_url !== payload.source_url)) {
          existing.source_url = payload.source_url;
          isUpdated = true;
        }
      }

      if (payload.attachments && payload.attachments.length > 0) {
        if (!existing.attachments || existing.attachments.length === 0) {
          existing.attachments = payload.attachments;
          isUpdated = true;
        }
      }

      if (payload.published_at && isFb) {
        existing.published_at = payload.published_at;
        isUpdated = true;
      }

      if (isFb && payload.content && (!existing.content || existing.content.length < payload.content.length)) {
        existing.content = payload.content;
        isUpdated = true;
      }

      if (isUpdated) {
        if (isFb && existing.content_hash !== contentHash) {
          existing.content_hash = contentHash;
        }
        existing = await this.notificationRepo.updateNotificationById(existing.id, {
          source_url: existing.source_url,
          attachments: existing.attachments || [],
          published_at: existing.published_at,
          content: existing.content || '',
          content_hash: existing.content_hash,
        });
      }

      if (isFb) {
        const normInputTitle = this._normalizeTitle(title);
        const fbCandidates = await this.notificationRepo.listByChannels([sourceChannel]);
        for (const n of fbCandidates) {
          if (n.id === existing.id) continue;
          const normNTitle = this._normalizeTitle(n.title);
          const sameTitle = normInputTitle.length > 10 && normInputTitle === normNTitle;
          const sameUrl =
            payload.source_url &&
            n.source_url &&
            payload.source_url.includes('/posts/') &&
            n.source_url === payload.source_url;
          if (sameTitle || sameUrl) {
            await this.notificationRepo.deleteNotificationWithRelink(n.id, existing.id);
          }
        }
      }

      return {
        status: 'DUPLICATE',
        message: 'Thông báo đã tồn tại trên hệ thống (đã đồng bộ dữ liệu chuẩn)',
        notification: existing,
      };
    }

    // 1c. Chống trùng lặp chéo giữa các chuyên mục của nhà trường
    let datePart = '';
    try {
      datePart = publishedAt ? new Date(publishedAt).toISOString().slice(0, 10) : '';
    } catch {
      datePart = String(publishedAt || '').slice(0, 10);
    }

    const allExisting = await this.notificationRepo.listAllNotifications();
    const crossExisting = allExisting.find((n) => {
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
      let updatedCross = crossExisting;
      if (crossExisting.source_channel === 'DUT_GENERAL' && sourceChannel !== 'DUT_GENERAL') {
        updatedCross = await this.notificationRepo.updateNotificationById(crossExisting.id, {
          source_channel: sourceChannel,
          source_name: payload.source_name || this._getSourceName(sourceChannel),
        });
      }
      return {
        status: 'DUPLICATE',
        message: 'Thông báo đã tồn tại trên hệ thống (trùng khớp tiêu đề và ngày đăng giữa các chuyên mục)',
        notification: updatedCross,
      };
    }

    // 2. Chạy Smart Classification Router (kèm danh mục khóa học từ PostgreSQL)
    const knownCourses = await this.courseRepo.getAllCourses();
    const classified = await classifySmartNotification({
      ...payload,
      source_channel: sourceChannel,
      title,
      content,
      known_courses: knownCourses,
    });

    let targetStudentUuid = null;
    if (payload.target_student_id || classified.target_student_id) {
      const targetRef = payload.target_student_id || classified.target_student_id;
      const targetStudent = await this.studentRepo.resolveStudent(targetRef);
      if (targetStudent) targetStudentUuid = targetStudent.id;
    }

    const notificationPayload = {
      id: crypto.randomUUID(),
      title,
      summary: classified.summary || title,
      action_required: classified.action_required || null,
      content,
      source_channel: sourceChannel,
      source_name: payload.source_name || this._getSourceName(sourceChannel),
      classified_by: classified.classified_by || 'RULE_ENGINE',
      scope: mapScopeToDb(classified.scope || 'GLOBAL'),
      priority: classified.priority || 'NORMAL',
      priority_score: classified.priority_score || 0,
      category: payload.category || classified.category || 'ACADEMIC',
      category_code: payload.category_code || classified.category_code || 'hoc_tap',
      category_name: payload.category_name || classified.category_name || 'Thông báo học tập',
      course_code: isFb ? null : (classified.course_code || null),
      target_faculty: payload.target_faculty || null,
      target_cohort: payload.target_cohort || null,
      target_student_id: targetStudentUuid,
      is_emergency: Boolean(classified.is_emergency),
      tags: isFb
        ? (classified.tags || []).filter((t) => !t.includes('LớpHọcPhần') && !t.includes('IT408') && !t.includes('SSH101'))
        : (classified.tags || []),
      attachments: payload.attachments || [],
      reschedule_details: classified.reschedule_details || null,
      source_url: payload.source_url || null,
      deadline_at: classified.deadline_at || null,
      content_hash: contentHash,
      published_at: publishedAt,
      created_at: new Date().toISOString(),
    };

    return this.db.withTransaction(async (tx) => {
      const db = {query:tx.query.bind(tx), withTransaction:fn => fn(tx)};
      const notificationRepo = new NotificationRepository(db);
      const studentRepo = new StudentRepository(db);
      const courseRepo = new CourseRepository(db);
      const deviceRepo = new DeviceTokenRepository(db);
      const deadlineSvc = new DeadlineService({db,studentRepo});
      const deliveries = new PushDeliveryService({db});
      const saved = await notificationRepo.upsertNotification(notificationPayload);
      saved.topics = classified.topics || detectNotificationTopics(saved);
      saved.scope_type = classified.scope_type || saved.scope;
      saved.source_type = saved.source_channel;
      saved.category_tag = classified.category_tag || '#HọcTập';

      // 5. Phân phối tới sinh viên mục tiêu trực tiếp trên PostgreSQL
      const students = await studentRepo.listAllStudents();
      for (const student of students) {
        const studentCourses = await courseRepo.getStudentCourses(student.id);
        const isTargeted = isNoticeForStudent(saved, student, studentCourses);

        if (isTargeted) {
          if (!saved.course_code && (saved.source_channel === 'DUT_COURSE_CLASS' || saved.scope === 'COURSE')) {
            const matched = studentCourses.find((c) => {
              const notifText = `${saved.title} ${saved.content || ''}`.toLowerCase();
              return notifText.includes((c.course_name || '').toLowerCase()) || notifText.includes((c.course_code || '').toLowerCase());
            });
            if (matched) {
              saved.course_code = matched.course_code;
              await notificationRepo.updateNotificationById(saved.id, { course_code: matched.course_code });
            }
          }

          await notificationRepo.distributeToStudent(saved.id, student.id);

          if (saved.deadline_at) {
            await deadlineSvc.createDeadline({
              student_id: student.id,
              notification_id: saved.id,
              course_code: saved.course_code,
              category: saved.category,
              category_code: saved.category_code,
              category_name: saved.category_name,
              title: `[Hạn chót] ${saved.title.trim()}`,
              description: saved.action_required || saved.summary,
              due_date: saved.deadline_at,
            });
          }

          let shouldPush = false;
          if (saved.is_emergency || saved.priority === 'URGENT') {
            shouldPush = true;
          } else if (student.is_personalized_enabled === false) {
            shouldPush = saved.scope === 'COURSE';
          } else {
            const studentTopics = student.interested_topics || ['hoc_vu', 'hoc_bong', 'tuyen_dung'];
            const notifTopics = saved.topics || detectNotificationTopics(saved);
            const hasTopicMatch = notifTopics.some((t) => studentTopics.includes(t));
            shouldPush = hasTopicMatch || saved.scope === 'COURSE';
          }

          if (shouldPush) {
            const devices = await deviceRepo.listStudentDevices(
              [student.id, student.student_code, student.firebase_uid],
              { activeOnly: true }
            );
            for (const device of devices) {
              await deliveries.enqueue({
                notificationId: saved.id,
                studentId: student.id,
                deviceId: device.id,
                title: saved.is_emergency ? `🚨 [KHẨN CẤP] ${saved.title}` : saved.title,
                body: saved.summary || (saved.content || '').slice(0, 100),
                data: {
                  notification_id: saved.id,
                  is_emergency: String(saved.is_emergency),
                  priority: saved.priority,
                },
              });
            }
          }
        }
      }

      return {
        status: 'INSERTED',
        message: 'Thu thập và phân loại thông báo thành công',
        notification: saved,
      };
    });
  }

  /**
   * Phân phối các thông báo hiện có và bóc tách deadline cho sinh viên mới đăng nhập
   */
  async distributeExistingNotificationsToStudent(student) {
    if (!student || !student.id) return;
    const studentCourses = await this.courseRepo.getStudentCourses(student.id);
    const existingDeadlines = await this.deadlineSvc.getDeadlines(student.id);
    const allNotifications = await this.notificationRepo.listAllNotifications();

    for (const notification of allNotifications) {
      const isTargeted = isNoticeForStudent(notification, student, studentCourses);

      if (isTargeted) {
        if (!notification.course_code && (notification.source_channel === 'DUT_COURSE_CLASS' || notification.scope === 'COURSE')) {
          const matched = studentCourses.find((c) => {
            const notifText = `${notification.title} ${notification.content || ''}`.toLowerCase();
            return notifText.includes((c.course_name || '').toLowerCase()) || notifText.includes((c.course_code || '').toLowerCase());
          });
          if (matched) {
            notification.course_code = matched.course_code;
            await this.notificationRepo.updateNotificationById(notification.id, { course_code: matched.course_code });
          }
        }

        await this.notificationRepo.distributeToStudent(notification.id, student.id);

        if (notification.deadline_at) {
          const cleanNotifTitle = (notification.title || '')
            .trim()
            .replace(/^\[(?:hạn chót|nhắc nhở)\]\s*/i, '')
            .replace(/\s+/g, ' ')
            .toLowerCase();
          const alreadyHas = existingDeadlines.some(
            (d) =>
              (d.notification_id && d.notification_id === notification.id) ||
              (d.title || '')
                .trim()
                .replace(/^\[(?:hạn chót|nhắc nhở)\]\s*/i, '')
                .replace(/\s+/g, ' ')
                .toLowerCase() === cleanNotifTitle
          );

          if (!alreadyHas) {
            await this.deadlineSvc.createDeadline({
              student_id: student.id,
              notification_id: notification.id,
              course_code: notification.course_code,
              category: notification.category,
              category_code: notification.category_code,
              category_name: notification.category_name,
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
   * Lấy danh sách bảng tin thông báo tập trung trực tiếp từ PostgreSQL (FR-05)
   */
  async getFeedNotifications({
    student_id = null,
    source_channel = null,
    priority = null,
    tag = null,
    category = null,
    categories = null,
    search = null,
    limit = 50,
    offset = 0,
  } = {}) {
    let list = await this.notificationRepo.listAllNotifications();

    let sId = null;
    let student = null;
    let studentCourses = [];
    if (student_id) {
      student = await this.studentRepo.resolveStudent(student_id);
      if (student) {
        sId = student.id;
        studentCourses = await this.courseRepo.getStudentCourses(sId);
        list = list.filter((n) => isNoticeForStudent(n, student, studentCourses));
      } else if (isUuid(student_id)) {
        sId = student_id;
      }
    }

    if (source_channel && source_channel !== 'ALL') {
      list = list.filter((n) => n.source_channel === source_channel || n.source_type === source_channel);
    }

    if (priority) {
      list = list.filter((n) => n.priority === priority);
    }

    if (tag) {
      list = list.filter((n) => Array.isArray(n.tags) && n.tags.includes(tag));
    }

    const rawCats = categories || category;
    if (rawCats && rawCats !== 'ALL') {
      const catList = (Array.isArray(rawCats) ? rawCats : String(rawCats).split(','))
        .map((c) => c.trim())
        .filter((c) => c && c.toUpperCase() !== 'ALL');
      if (catList.length > 0) {
        list = list.filter((n) => matchesInterestedTopics(n, catList));
      }
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (n) =>
          (n.title && n.title.toLowerCase().includes(q)) ||
          (n.content && n.content.toLowerCase().includes(q)) ||
          (n.summary && n.summary.toLowerCase().includes(q)) ||
          (n.course_code && n.course_code.toLowerCase().includes(q)) ||
          (Array.isArray(n.tags) && n.tags.some((t) => t.toLowerCase().includes(q)))
      );
    }

    const isPersonalized = student && student.is_personalized_enabled !== false;
    const studentTopics = isPersonalized
      ? student.interested_topics || ['ACADEMIC', 'GRADE', 'ADMINISTRATIVE', 'EVENT', 'CAREER', 'SCHOLARSHIP']
      : [];

    if (isPersonalized && studentTopics.length > 0 && !rawCats) {
      list = list.filter((n) => n.is_emergency || matchesInterestedTopics(n, studentTopics));
    }

    const getTopicMatchScore = (n) => {
      if (!isPersonalized || studentTopics.length === 0) return 0;
      return matchesInterestedTopics(n, studentTopics) ? 1 : 0;
    };

    list.sort((a, b) => {
      if (a.is_emergency && !b.is_emergency) return -1;
      if (!a.is_emergency && b.is_emergency) return 1;

      if ((!source_channel || source_channel === 'ALL') && isPersonalized) {
        const scoreA = getTopicMatchScore(a);
        const scoreB = getTopicMatchScore(b);
        if (scoreA !== scoreB) {
          return scoreB - scoreA;
        }
      }

      return new Date(b.published_at) - new Date(a.published_at);
    });

    const seenNotif = new Set();
    list = list.filter((n) => {
      const cleanTitle = (n.title || '').trim().replace(/\s+/g, ' ').toLowerCase();
      const channel = n.source_channel || '';
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
      if (seenNotif.has(key)) return false;
      seenNotif.add(key);
      return true;
    });

    const paged = list.slice(offset, offset + limit);
    const statusMap = sId
      ? await this.notificationRepo.getStudentStatusesMap(sId, paged.map((n) => n.id))
      : new Map();

    const items = paged.map((n) => {
      const record = statusMap.get(String(n.id));
      return {
        ...n,
        topics: n.topics || detectNotificationTopics(n),
        is_read: record ? Boolean(record.is_read) : false,
        is_acknowledged: record ? Boolean(record.is_acknowledged) : false,
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
   * Xác nhận đã nhận / đã hiểu thông báo khẩn cấp trực tiếp trong PostgreSQL (FR-08)
   */
  async acknowledgeEmergencyNotification(notificationId, studentIdentifier) {
    return this.notificationRepo.acknowledgeNotification(notificationId, studentIdentifier);
  }
}

const notificationService = new NotificationService();

module.exports = {
  NotificationService,
  notificationService,
  isNoticeForStudent,
};
