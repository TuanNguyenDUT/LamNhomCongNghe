/**
 * TASK 6: Tích hợp SDK Firebase Cloud Messaging (FCM) / APNs
 * Phụ trách: Hồ Đăng Hùng
 * Chức năng: Lưu token thiết bị người dùng vào DB và gửi push notification
 */

class FcmService {
  /**
   * @param {import('../db/deadline.repository').DeadlineRepository} deadlineRepository
   */
  constructor(deadlineRepository) {
    this.repository = deadlineRepository;
    this.firebaseApp = null;
    this.initFirebase();
  }

  /**
   * Khởi tạo Firebase Admin SDK
   * Tự động nhận diện Service Account từ biến môi trường FIREBASE_SERVICE_ACCOUNT hoặc giả lập DEV
   */
  initFirebase() {
    try {
      if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const admin = require('firebase-admin');
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log('✅ [Task 6] Firebase Admin SDK đã kết nối thành công.');
      } else {
        console.log('ℹ️ [Task 6] Chế độ FCM Simulation (chưa cấu hình FIREBASE_SERVICE_ACCOUNT). Sẵn sàng lưu token & gửi mock notification.');
      }
    } catch (err) {
      console.warn('⚠️ [Task 6] Không thể khởi tạo Firebase Admin SDK, chuyển về chế độ giả lập:', err.message);
    }
  }

  /**
   * Lưu Token thiết bị người dùng vào Database
   */
  async registerDeviceToken({ student_id, device_token, platform = 'WEB', device_model = 'Browser' }) {
    if (!device_token) {
      throw new Error('device_token là bắt buộc');
    }
    const record = await this.repository.saveDeviceToken({
      student_id,
      device_token,
      platform,
      device_model,
    });
    return record;
  }

  /**
   * Gửi thông báo đẩy nhắc nhở hạn chót tới 1 thiết bị
   */
  async sendDeadlinePush({ device_token, title, body, data = {} }) {
    if (this.firebaseApp) {
      const admin = require('firebase-admin');
      const message = {
        token: device_token,
        notification: {
          title,
          body,
        },
        data: {
          ...data,
          sent_at: new Date().toISOString(),
        },
      };
      const response = await admin.messaging().send(message);
      return { success: true, messageId: response, simulated: false };
    }

    // Chế độ mô phỏng cho lớp học / dev
    return {
      success: true,
      messageId: `simulated_fcm_${Date.now()}`,
      simulated: true,
      payload: {
        target_token: device_token,
        notification: { title, body },
        data,
      },
    };
  }

  /**
   * Gửi thông báo nhắc nhở đa tầng tới toàn bộ token đang hoạt động
   */
  async broadcastDeadlineReminder(deadline, reminderType = 'DUE_SOON') {
    const tokens = await this.repository.getAllDeviceTokens();
    const reminderTitles = {
      '3_DAYS': `📅 Nhắc nhở: Hạn chót còn 3 ngày cho môn ${deadline.subject}`,
      '1_DAY': `⚠️ Chú ý: Còn 1 ngày nữa đến hạn nộp bài ${deadline.title}`,
      '2_HOURS': `🔥 KHẨN CẤP: Chỉ còn 2 giờ để nộp ${deadline.title}!`,
      'DUE_SOON': `⏰ Nhắc nhở hạn chót sắp đến: ${deadline.title}`,
    };

    const title = reminderTitles[reminderType] || `Nhắc nhở: ${deadline.title}`;
    const body = `Môn: ${deadline.subject} | Hạn: ${new Date(deadline.due_date).toLocaleString('vi-VN')}`;

    const results = [];
    for (const t of tokens) {
      const res = await this.sendDeadlinePush({
        device_token: t.device_token,
        title,
        body,
        data: {
          deadline_id: String(deadline.deadline_id),
          subject: String(deadline.subject),
          reminder_type: reminderType,
        },
      });
      results.push(res);
    }
    return { count: tokens.length, results };
  }
}

module.exports = {
  FcmService,
};
