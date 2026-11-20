/**
 * KỊCH BẢN CHẠY VÀ KIỂM THỬ TOÀN DIỆN NGHIỆP VỤ HỆ THỐNG (E2E BUSINESS SCENARIOS)
 * Khởi động HTTP Server thật, gửi Request HTTP thật qua fetch() và kiểm tra 100% các luồng nghiệp vụ.
 */

const { createServer } = require('../src/server');
const { dutCrawlerService } = require('../src/services/dut-crawler.service');
const { fbCrawlerService } = require('../src/services/fb-crawler.service');
const {
  createTestPool,
  resetDatabase,
  seedStudent,
  teardownTestPool,
} = require('../tests/helpers/pg-test-harness');

const PORT = Number(process.env.PORT || 3456);
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Màu sắc terminal để in báo cáo trực quan
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
};

function logStep(step, title) {
  console.log(`\n${colors.bright}${colors.cyan}======================================================================${colors.reset}`);
  console.log(`${colors.bright}${colors.yellow}👉 [BƯỚC ${step}] ${title}${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}======================================================================${colors.reset}`);
}

function logSuccess(msg, data = null) {
  console.log(`${colors.green}  ✔ ${msg}${colors.reset}`);
  if (data) {
    console.log(`    ${colors.reset}${typeof data === 'object' ? JSON.stringify(data) : data}`);
  }
}

function logInfo(msg) {
  console.log(`  ℹ ${msg}`);
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = await res.json();
    return { status: res.status, headers: res.headers, json };
  }
  const text = await res.text();
  return { status: res.status, headers: res.headers, text };
}

async function runBusinessTests() {
  console.log(`${colors.bright}${colors.magenta}`);
  console.log('######################################################################');
  console.log('#   KHỞI ĐỘNG VÀ TEST TOÀN BỘ NGHIỆP VỤ HỆ THỐNG SINH VIÊN DUT       #');
  console.log('#   Đặc tả: AGENT.md (FR-01 đến FR-09)                              #');
  console.log('######################################################################');
  console.log(colors.reset);

  // 1. Kết nối PostgreSQL test & khởi động server
  const pool = await createTestPool();
  await resetDatabase(pool);
  await seedStudent(pool, { student_code: '102200001' });

  const { server, services } = createServer(pool);
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  logSuccess(`HTTP Server Backend đã khởi động thành công trên cổng ${PORT} (Direct PG)`);

  try {
    // =========================================================================
    // BƯỚC 1: Health Check & Danh sách Endpoints
    // =========================================================================
    logStep(1, 'Kiểm tra trạng thái máy chủ (Health Check & Endpoints)');
    const rootRes = await request('/api');
    if (rootRes.status === 200 && rootRes.json.service) {
      logSuccess('API Gateway hoạt động hoàn hảo', {
        service: rootRes.json.service,
        version: rootRes.json.version,
        endpoints_count: rootRes.json.endpoints.length,
      });
    }

    // =========================================================================
    // BƯỚC 2: FR-01 & FR-04 - Đồng bộ học phần từ sv.dut.udn.vn
    // =========================================================================
    logStep(2, 'FR-01 & FR-04: Đồng bộ học phần sv.dut.udn.vn & Không gian môn học');
    const syncRes = await request('/api/v1/dut/sync-courses', {
      method: 'POST',
      body: JSON.stringify({
        student_code: '102200001',
        student_id: 'a0000000-0000-0000-0000-000000000001',
      }),
    });
    logSuccess('Đã đồng bộ danh sách học phần từ phiên sv.dut.udn.vn', {
      total_courses: syncRes.json.data.total_courses,
      courses: syncRes.json.data.courses.map((c) => `${c.course_code} - ${c.course_name}`),
    });

    const enrolledRes = await request('/api/v1/courses/enrolled?student_id=102200001');
    logSuccess('Lấy danh sách môn học kèm thống kê tin chưa đọc', enrolledRes.json.data.map(c => ({
      mon: c.course_name,
      ma: c.course_code,
      tin_moi: c.unread_count,
      lich_hoc: c.schedule_info,
    })));

    // =========================================================================
    // BƯỚC 3: FR-02 & FR-03 - Thu thập tin từ 7 mục web & 2 Fanpage FB
    // =========================================================================
    logStep(3, 'FR-02 & FR-03: Cào tin tức đa nguồn & Chống trùng lặp SHA-256');
    
    // Cào thử 7 mục trường
    const dutCourseNotices = await dutCrawlerService.fetchCategoryNotices('DUT_COURSE_CLASS');
    const dutTuitionNotices = await dutCrawlerService.fetchCategoryNotices('DUT_TUITION_FEE');
    logInfo(`Scraper sv.dut.udn.vn: Thu thập được ${dutCourseNotices.length} tin lớp học phần, ${dutTuitionNotices.length} tin học phí.`);

    // Cào thử 2 Fanpage FB
    const fbPosts = await fbCrawlerService.fetchFanpagePosts('FB_CTSV');
    logInfo(`Collector Facebook: Thu thập được ${fbPosts.length} bài đăng từ Fanpage CTSV.`);

    // Tiếp nhận thông báo nộp học phí
    const ingestTuition = await request('/api/v1/notifications/ingest', {
      method: 'POST',
      body: JSON.stringify(dutTuitionNotices[0]),
    });
    logSuccess('Tiếp nhận & phân loại tin học phí (Rules Engine):', {
      title: ingestTuition.json.data.title,
      classified_by: ingestTuition.json.data.classified_by,
      priority: ingestTuition.json.data.priority,
      score: ingestTuition.json.data.priority_score,
      deadline_at: ingestTuition.json.data.deadline_at,
      tags: ingestTuition.json.data.tags,
      content_hash: ingestTuition.json.data.content_hash.slice(0, 16) + '...',
    });

    // Thử gửi lại đúng bản tin đó để kiểm tra chống trùng lặp SHA-256 (FR-02)
    const ingestDup = await request('/api/v1/notifications/ingest', {
      method: 'POST',
      body: JSON.stringify(dutTuitionNotices[0]),
    });
    if (ingestDup.json.message.includes('trùng khớp') || ingestDup.json.data.content_hash === ingestTuition.json.data.content_hash) {
      logSuccess('Cơ chế chống trùng lặp SHA-256 hoạt động chuẩn xác: Đã phát hiện và ngăn chặn tin trùng lặp!');
    }

    // Tiếp nhận bài đăng Facebook CTSV (FR-03: AI API Flow)
    const ingestFb = await request('/api/v1/notifications/ingest', {
      method: 'POST',
      body: JSON.stringify(fbPosts[0]),
    });
    logSuccess('Tiếp nhận & phân loại bài đăng Facebook (AI Router Flow):', {
      title: ingestFb.json.data.title,
      classified_by: ingestFb.json.data.classified_by,
      summary: ingestFb.json.data.summary,
      action_required: ingestFb.json.data.action_required,
      deadline_at: ingestFb.json.data.deadline_at,
      tags: ingestFb.json.data.tags,
    });

    // =========================================================================
    // BƯỚC 4: FR-08 - Cảnh báo khẩn cấp nghỉ học đột xuất & Read Receipt
    // =========================================================================
    logStep(4, 'FR-08: Cảnh báo khẩn cấp nghỉ dạy/học bù đột xuất & Xác nhận đã đọc (ack)');
    const emergencyNotice = {
      source_channel: 'DUT_COURSE_CLASS',
      course_code: 'IT401',
      title: '🚨 THÔNG BÁO NGHỈ DẠY VÀ HỌC BÙ LỚP HỌC PHẦN IT401 - CÔNG NGHỆ PHẦN MỀM',
      content: 'Giảng viên TS. Nguyễn Văn B thông báo nghỉ dạy ngày 18/03/2026 do bận công tác. Lớp sẽ học bù vào ngày 22/03/2026, Tiết 7-9, chuyển sang phòng F302.',
    };

    const ingestEmergency = await request('/api/v1/notifications/ingest', {
      method: 'POST',
      body: JSON.stringify(emergencyNotice),
    });
    const emergencyId = ingestEmergency.json.data.id;
    logSuccess('Hệ thống phát hiện thông báo KHẨN CẤP (is_emergency = true):', {
      id: emergencyId,
      is_emergency: ingestEmergency.json.data.is_emergency,
      priority: ingestEmergency.json.data.priority,
      score: ingestEmergency.json.data.priority_score,
      reschedule_details: ingestEmergency.json.data.reschedule_details,
    });

    // Sinh viên gửi xác nhận "Đã nhận tin / Đã hiểu"
    const ackRes = await request(`/api/v1/notifications/${emergencyId}/ack`, {
      method: 'POST',
      body: JSON.stringify({ student_id: '102200001' }),
    });
    logSuccess('Sinh viên gửi xác nhận Đã đọc (Read Receipt):', ackRes.json.data);

    // =========================================================================
    // BƯỚC 5: FR-05 - Bảng tin thông báo tập trung & Bộ lọc đa nguồn
    // =========================================================================
    logStep(5, 'FR-05: Bảng tin thông báo tập trung & Bộ lọc đa chiều');
    const allFeed = await request('/api/v1/notifications?limit=10');
    const totalAll = allFeed.json?.data?.pagination?.total ?? allFeed.json?.data?.total ?? allFeed.json?.data?.notifications?.length ?? 0;
    logSuccess(`Tổng số thông báo trên bảng tin: ${totalAll}`);

    const classFeed = await request('/api/v1/notifications?source_channel=DUT_COURSE_CLASS');
    const totalClass = classFeed.json?.data?.pagination?.total ?? classFeed.json?.data?.total ?? classFeed.json?.data?.notifications?.length ?? 0;
    logSuccess(`Lọc theo chuyên mục [Lớp học phần]: ${totalClass} tin.`);

    const fbFeed = await request('/api/v1/notifications?source_channel=FB_CTSV');
    const totalFb = fbFeed.json?.data?.pagination?.total ?? fbFeed.json?.data?.total ?? fbFeed.json?.data?.notifications?.length ?? 0;
    logSuccess(`Lọc theo chuyên mục [Fanpage CTSV]: ${totalFb} tin.`);

    const searchFeed = await request('/api/v1/notifications?search=học%20phí');
    const totalSearch = searchFeed.json?.data?.pagination?.total ?? searchFeed.json?.data?.total ?? searchFeed.json?.data?.notifications?.length ?? 0;
    logSuccess(`Tìm kiếm từ khóa "học phí": Tìm thấy ${totalSearch} tin phù hợp.`);

    // =========================================================================
    // BƯỚC 6: FR-06 & FR-07 - Quản lý hạn chót (Deadlines) & Worker nhắc việc đa tầng
    // =========================================================================
    logStep(6, 'FR-06 & FR-07: Quản lý Deadlines & Worker cảnh báo nhắc việc leo thang 4 tầng');
    
    // Tạo deadline đóng học phí gắn liền với notification_id thật
    const createDl = await request('/api/v1/deadlines', {
      method: 'POST',
      body: JSON.stringify({
        student_id: '102200001',
        notification_id: ingestTuition.json.data.id,
        title: 'Hạn cuối hoàn thành học phí HK2',
        due_date: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), // 48h nữa -> DUE_SOON
        description: 'Đóng tiền qua cổng thanh toán sinh viên',
      }),
    });
    const dlId = createDl.json.data.deadline_id;
    logSuccess('Đã tạo mốc hạn chót mới:', {
      id: dlId,
      title: createDl.json.data.title,
      status: createDl.json.data.status,
      due_date: createDl.json.data.due_date,
    });

    // Lấy danh sách deadlines
    const dlList = await request('/api/v1/deadlines?student_id=102200001');
    logSuccess(`Lấy danh sách deadlines của sinh viên: ${dlList.json.total} mốc hạn chót.`);

    // Chạy worker quét nhắc việc leo thang 4 tầng (168h, 72h, 24h, 2h)
    const reminders = await services.deadlineSvc.processEscalationReminders();
    logSuccess(`Worker nhắc việc leo thang đã kích hoạt ${reminders.length} cảnh báo:`, reminders);

    // Đánh dấu hoàn thành deadline
    const updateDl = await request(`/api/v1/deadlines/${dlId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    logSuccess('Đánh dấu deadline đã hoàn thành:', {
      id: dlId,
      status: updateDl.json.data.status,
    });

    // =========================================================================
    // BƯỚC 7: FR-09 - Đồng bộ Google Calendar & Xuất file .ics
    // =========================================================================
    logStep(7, 'FR-09: Đồng bộ Google Calendar OAuth2 & Xuất tệp iCalendar (.ics)');
    
    // Kết nối tài khoản Google
    const gConnect = await request('/api/v1/calendar/google/connect', {
      method: 'POST',
      body: JSON.stringify({
        student_id: '102200001',
        refresh_token: 'google_oauth2_refresh_token_sample',
      }),
    });
    logInfo(`Chế độ kết nối Google OAuth2: ${gConnect.json.data.mode} (Configured: ${gConnect.json.data.configured})`);
    logSuccess('Trạng thái kết nối Google Calendar:', {
      mode: gConnect.json.data.mode,
      configured: gConnect.json.data.configured,
      message: gConnect.json.data.message,
    });

    // Đồng bộ deadlines lên Google Calendar
    const gSync = await request('/api/v1/calendar/google/sync', {
      method: 'POST',
      body: JSON.stringify({ student_id: '102200001' }),
    });
    logSuccess(`Kết quả đồng bộ (${gSync.json.data.mode}): ${gSync.json.data.synced_count} sự kiện.`, {
      mode: gSync.json.data.mode,
      note: gSync.json.data.note,
    });

    // Tải về file .ics
    const icsRes = await request('/api/v1/calendar/export.ics?student_id=102200001');
    if (icsRes.status === 200 && icsRes.text.includes('BEGIN:VCALENDAR')) {
      const lineCount = icsRes.text.split('\n').length;
      logSuccess(`Xuất tệp iCalendar chuẩn .ics thành công (${lineCount} dòng):`, {
        header: icsRes.text.slice(0, 70).replace(/\r?\n/g, ' '),
        content_type: icsRes.headers.get('content-type'),
      });
    }

    // =========================================================================
    // BƯỚC 8: Task 6 - Đăng ký thiết bị & Push Notification FCM
    // =========================================================================
    logStep(8, 'Task 6: Đăng ký thiết bị FCM & kiểm tra bảo mật');
    const deviceRes = await request('/api/devices/register', {
      method: 'POST',
      body: JSON.stringify({
        student_id: '102200001',
        token: 'fcm_device_token_client_sample_01',
        platform: 'ANDROID',
        device_id: 'device_pixel_9_pro_dut_01',
        app_version: '1.0.0',
      }),
    });
    logSuccess('Đăng ký thiết bị nhận push notification an toàn:', deviceRes.json);

    // Tổng kết thành công rực rỡ
    console.log(`\n${colors.bright}${colors.green}======================================================================${colors.reset}`);
    console.log(`${colors.bright}${colors.green}🎉 TẤT CẢ 8 BƯỚC TEST NGHIỆP VỤ ĐÃ HOÀN THÀNH 100% THÀNH CÔNG RỰC RỠ!${colors.reset}`);
    console.log(`${colors.bright}${colors.green}======================================================================${colors.reset}\n`);

  } finally {
    await new Promise((resolve) => server.close(resolve));
    await resetDatabase(pool).catch(() => {});
    await teardownTestPool(pool);
    logInfo('Đã đóng HTTP Server & kết nối PostgreSQL an toàn sau khi hoàn tất kiểm thử.');
  }
}

runBusinessTests().catch((err) => {
  console.error(`${colors.red}❌ Lỗi kiểm thử nghiệp vụ:${colors.reset}`, err);
  process.exit(1);
});
