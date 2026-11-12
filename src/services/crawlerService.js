/**
 * TASK 12: Xây dựng module tự động cào/tổng hợp thông báo từ các kênh nguồn
 * Phụ trách: Nguyễn Hữu Tuấn
 *
 * Hỗ trợ:
 * 1. Bóc tách HTML từ Portal Nhà trường / Phòng Đào tạo / Website Khoa (parsePortalHtml)
 * 2. Bóc tách Email sinh viên từ Raw MIME / Email Webhook (parseStudentEmail)
 * 3. Tiếp nhận Webhook từ LMS Lớp học phần & Kênh Ngoại khóa (parseWebhookPayload)
 * 4. Đồng bộ đa luồng đồng thời từ tất cả kênh nguồn (crawlAllSources)
 */

const crypto = require('node:crypto');
const { classifyNotification } = require('./classifierService');

/**
 * Bóc tách danh sách thông báo từ HTML Portal nhà trường / Phòng Đào tạo / Khoa
 */
function parsePortalHtml(htmlString, sourceConfig = {}) {
  const results = [];
  if (!htmlString || typeof htmlString !== 'string') {
    return results;
  }

  const articleRegex = /<article[^>]*class=["'][^"']*notice-item[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi;
  let match;

  while ((match = articleRegex.exec(htmlString)) !== null) {
    const block = match[1];
    const idMatch = match[0].match(/data-id=["']([^"']+)["']/i);
    const titleMatch = block.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i);
    const contentMatch = block.match(/<p[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/p>/i);
    const dateMatch = block.match(/<time[^>]*datetime=["']([^"']+)["'][^>]*>/i);
    const linkMatch = block.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/i);
    const senderMatch = block.match(/<span[^>]*class=["'][^"']*sender[^"']*["'][^>]*>([\s\S]*?)<\/span>/i);

    const stripTags = (str = '') =>
      str
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    const title = titleMatch ? stripTags(titleMatch[1]) : '';
    const content = contentMatch ? stripTags(contentMatch[1]) : '';

    if (title && content) {
      results.push({
        external_id: idMatch ? idMatch[1] : null,
        source_code: sourceConfig.source_code || 'PORTAL_PDT',
        source_type: sourceConfig.source_type || 'TRAINING_DEPT',
        channel_name: sourceConfig.channel_name || 'Portal Phòng Đào tạo',
        title,
        content,
        sender_name: senderMatch ? stripTags(senderMatch[1]) : sourceConfig.sender_name || 'Phòng Đào tạo',
        source_url: linkMatch ? linkMatch[1] : sourceConfig.endpoint_url || 'https://sv.dut.udn.vn',
        published_at: dateMatch ? dateMatch[1] : new Date().toISOString(),
      });
    }
  }

  return results;
}

/**
 * Bóc tách thông báo từ Email sinh viên (hỗ trợ cả Raw MIME text và JSON payload)
 */
function parseStudentEmail(emailInput) {
  if (!emailInput) {
    throw new Error('Dữ liệu email đầu vào không hợp lệ');
  }

  // Trường hợp 1: Raw Email Text (From / To / Subject / Date / Body)
  if (typeof emailInput === 'string') {
    const lines = emailInput.split(/\r?\n/);
    const headers = {};
    let bodyStartIndex = 0;

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (line.trim() === '') {
        bodyStartIndex = i + 1;
        break;
      }
      const colonIdx = line.indexOf(':');
      if (colonIdx > 0) {
        const key = line.slice(0, colonIdx).trim().toLowerCase();
        const val = line.slice(colonIdx + 1).trim();
        headers[key] = val;
      }
    }

    const body = lines.slice(bodyStartIndex).join('\n').trim();
    const toHeader = headers.to || '';
    const studentIdMatch = toHeader.match(/\b(\d{9,10})\b/) || body.match(/MSSV:\s*(\d{9,10})/i);

    return {
      external_id: headers['message-id'] || null,
      source_code: 'EMAIL_SV',
      source_type: 'STUDENT_EMAIL',
      channel_name: 'Email Sinh viên (@sv.dut.udn.vn)',
      title: headers.subject || 'Thông báo từ Email Sinh viên',
      content: body,
      sender_name: headers.from || 'Phòng Công tác Sinh viên',
      sender_email: headers.from || 'ctsv@dut.udn.vn',
      recipient_student_id: studentIdMatch ? studentIdMatch[1] : null,
      published_at: headers.date ? new Date(headers.date).toISOString() : new Date().toISOString(),
    };
  }

  // Trường hợp 2: Object JSON từ Email Webhook
  const recipientMatch =
    String(emailInput.to || '').match(/\b(\d{9,10})\b/) ||
    String(emailInput.body || emailInput.content || '').match(/MSSV:\s*(\d{9,10})/i);

  return {
    external_id: emailInput.message_id || emailInput.external_id || null,
    source_code: emailInput.source_code || 'EMAIL_SV',
    source_type: 'STUDENT_EMAIL',
    channel_name: emailInput.channel_name || 'Email Sinh viên (@sv.dut.udn.vn)',
    title: emailInput.subject || emailInput.title || 'Thông báo Email Sinh viên',
    content: emailInput.body || emailInput.content || '',
    sender_name: emailInput.from_name || emailInput.sender_name || 'Hệ thống Email Trường',
    sender_email: emailInput.from || emailInput.sender_email || 'no-reply@dut.udn.vn',
    recipient_student_id: emailInput.recipient_student_id || (recipientMatch ? recipientMatch[1] : null),
    published_at: emailInput.published_at || new Date().toISOString(),
  };
}

/**
 * Chuẩn hóa dữ liệu từ Webhook đa kênh (Khoa, Lớp học phần, CLB Ngoại khóa, Portal)
 */
function parseWebhookPayload(payload = {}) {
  if (payload.raw_email || payload.subject) {
    return parseStudentEmail(payload.raw_email || payload);
  }

  return {
    external_id: payload.external_id || null,
    source_code: payload.source_code || 'PORTAL_PDT',
    source_type: payload.source_type || 'TRAINING_DEPT',
    channel_name: payload.channel_name || 'Webhook Kênh Nguồn',
    title: String(payload.title || '').trim(),
    content: String(payload.content || '').trim(),
    sender_name: payload.sender_name || 'Hệ thống Tích hợp',
    sender_email: payload.sender_email || null,
    recipient_student_id: payload.recipient_student_id || null,
    course_code: payload.course_code || null,
    scope_type: payload.scope_type || null,
    source_url: payload.source_url || null,
    published_at: payload.published_at || new Date().toISOString(),
  };
}

/**
 * Dữ liệu mô phỏng thực tế từ các kênh nguồn khi bấm "Đồng bộ / Cào tin đa nguồn"
 */
function getSimulatedMultiSourceFeeds() {
  const now = new Date();
  const isoHoursAgo = (h) => new Date(now.getTime() - h * 3600 * 1000).toISOString();

  // 1. HTML từ Portal Phòng Đào tạo
  const portalHtml = `
    <div class="portal-feed">
      <article class="notice-item" data-id="PDT-2026-109">
        <h3>[KHẨN CẤP] Thông báo lịch thi cuối kỳ và danh sách phòng thi học kỳ 1 năm học 2026-2027</h3>
        <span class="sender">Phòng Đào tạo Đại học</span>
        <time datetime="${isoHoursAgo(1)}"></time>
        <p class="content">Phòng Đào tạo công bố lịch thi cuối kỳ chính thức cho toàn bộ các lớp học phần. Sinh viên kiểm tra kỹ phòng thi và có mặt trước 15 phút. Các trường hợp trùng lịch thi cần báo ngay trong vòng 24h.</p>
        <a href="https://sv.dut.udn.vn/lich-thi-hk1-2026">Xem chi tiết</a>
      </article>
      <article class="notice-item" data-id="PDT-2026-110">
        <h3>Thông báo kế hoạch đăng ký học phần học kỳ tiếp theo</h3>
        <span class="sender">Phòng Đào tạo Đại học</span>
        <time datetime="${isoHoursAgo(4)}"></time>
        <p class="content">Hệ thống đăng ký tín chỉ sẽ mở theo từng khóa từ tuần tới. Sinh viên chủ động tra cứu chương trình đào tạo và chuẩn bị danh sách mã lớp học phần dự kiến.</p>
        <a href="https://sv.dut.udn.vn/dang-ky-tin-chi">Xem chi tiết</a>
      </article>
    </div>
  `;

  // 2. HTML từ Website Khoa CNTT
  const facultyHtml = `
    <div class="faculty-feed">
      <article class="notice-item" data-id="FAC-IT-202">
        <h3>Thông báo lịch bảo vệ đồ án môn Công nghệ phần mềm (IT401)</h3>
        <span class="sender">Giáo vụ Khoa CNTT</span>
        <time datetime="${isoHoursAgo(2)}"></time>
        <p class="content">Các nhóm sinh viên thuộc lớp học phần IT401 Công nghệ phần mềm nộp quyển báo cáo và source code MVP trước 17h hôm nay để hội đồng xếp lịch bảo vệ đồ án.</p>
        <a href="https://it.dut.udn.vn/bao-ve-cnpm-it401">Xem chi tiết</a>
      </article>
    </div>
  `;

  // 3. Raw Email từ hệ thống Email Sinh viên
  const rawStudentEmails = [
    [
      'Message-ID: <mail-tuition-10223001@sv.dut.udn.vn>',
      'From: Phòng Kế hoạch Tài chính <khtc@dut.udn.vn>',
      'To: 10223001@sv.dut.udn.vn',
      'Subject: [Nhắc nợ học phí cá nhân] Thông báo hạn chót thanh toán học phí HK1 đối với MSSV: 10223001',
      `Date: ${isoHoursAgo(0.5)}`,
      '',
      'Chào bạn (MSSV: 10223001), hệ thống ghi nhận tài khoản cá nhân của bạn còn khoản học phí chưa tất toán. Vui lòng hoàn tất thanh toán học phí trước 17h hôm nay để không bị khóa đăng ký phòng thi cuối kỳ.',
    ].join('\n'),
    [
      'Message-ID: <mail-ai-quiz-10223001@sv.dut.udn.vn>',
      'From: LMS Hệ thống Quản lý Học tập <lms@dut.udn.vn>',
      'To: 10223001@sv.dut.udn.vn',
      'Subject: [IT408 - Trí tuệ nhân tạo] Nhắc hạn chót nộp bài tập lớn & kiểm tra nhanh chiều nay',
      `Date: ${isoHoursAgo(1.5)}`,
      '',
      'Thông báo đến lớp học phần IT408 Trí tuệ nhân tạo: Giảng viên vừa mở cổng nộp báo cáo Machine Learning. Hạn chót nộp bài tập là 23:59 hôm nay.',
    ].join('\n'),
  ];

  // 4. Feed từ Lớp học phần & Kênh Ngoại khóa
  const channelPayloads = [
    {
      external_id: 'CLS-IT302-88',
      source_code: 'CLASS_LMS',
      source_type: 'CLASS',
      channel_name: 'LMS Lớp học phần',
      title: '[Thông báo khẩn] Đổi phòng học và lịch học bù môn Cơ sở dữ liệu (IT302)',
      content:
        'Do phòng F204 phục vụ hội thảo cấp trường, lớp học phần Cơ sở dữ liệu IT302 sáng mai chuyển sang phòng A105. Sinh viên chú ý đi đúng phòng học mới.',
      sender_name: 'TS. Trần Minh Quân (GV CSDL)',
      course_code: 'IT302',
      published_at: isoHoursAgo(0.8),
    },
    {
      external_id: 'EXTRA-CLB-55',
      source_code: 'CLUB_EXTRA',
      source_type: 'EXTRACURRICULAR',
      channel_name: 'Đoàn Thanh niên & CLB Ngoại khóa',
      title: 'Ngày hội Giao lưu Câu lạc bộ Sinh viên & Workshop Kỹ năng mềm SSH101 cuối tuần',
      content:
        'Mời toàn thể sinh viên tham gia ngày hội giao lưu văn nghệ, minigame và workshop ngoại khóa do Đoàn trường phối hợp cùng CLB Kỹ năng mềm tổ chức tại hội trường khu F.',
      sender_name: 'CLB Kỹ năng & Đoàn Thanh niên',
      published_at: isoHoursAgo(5),
    },
  ];

  return {
    portalHtml,
    facultyHtml,
    rawStudentEmails,
    channelPayloads,
  };
}

/**
 * Thực thi thu thập đồng thời từ nhiều kênh nguồn (Multi-source Concurrent Crawler)
 */
async function crawlAllSources(dbManager, customFeeds = null) {
  const startTime = performance.now();
  const batchId = `BATCH-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
  const feeds = customFeeds || getSimulatedMultiSourceFeeds();
  const courses = dbManager.getCourses();

  // Chạy song song các bộ bóc tách từ nhiều kênh nguồn
  const tasks = [
    Promise.resolve().then(() => ({
      source_code: 'PORTAL_PDT',
      channel_type: 'TRAINING_DEPT',
      items: parsePortalHtml(feeds.portalHtml, {
        source_code: 'PORTAL_PDT',
        source_type: 'TRAINING_DEPT',
        channel_name: 'Portal Phòng Đào tạo',
      }),
    })),
    Promise.resolve().then(() => ({
      source_code: 'FACULTY_IT',
      channel_type: 'FACULTY',
      items: parsePortalHtml(feeds.facultyHtml, {
        source_code: 'FACULTY_IT',
        source_type: 'FACULTY',
        channel_name: 'Website Khoa CNTT',
      }),
    })),
    Promise.resolve().then(() => ({
      source_code: 'EMAIL_SV',
      channel_type: 'STUDENT_EMAIL',
      items: (feeds.rawStudentEmails || []).map((raw) => parseStudentEmail(raw)),
    })),
    Promise.resolve().then(() => ({
      source_code: 'CLASS_LMS',
      channel_type: 'CLASS_AND_EXTRA',
      items: (feeds.channelPayloads || []).map((p) => parseWebhookPayload(p)),
    })),
  ];

  const settled = await Promise.allSettled(tasks);
  const classifiedBatch = [];
  const sourceStats = [];

  for (const res of settled) {
    if (res.status === 'fulfilled') {
      const { source_code, channel_type, items } = res.value;
      const classifiedItems = items.map((raw) => classifyNotification(raw, courses));
      classifiedBatch.push(...classifiedItems);
      sourceStats.push({
        source_code,
        channel_type,
        fetched_count: classifiedItems.length,
      });
    }
  }

  // Ghi hàng loạt vào DB bằng Transaction để đạt hiệu năng cao nhất (Task 15)
  const insertResult = dbManager.insertNotificationsBatch(classifiedBatch, batchId);
  const totalDurationMs = Number((performance.now() - startTime).toFixed(2));

  return {
    batch_id: batchId,
    fetched_count: classifiedBatch.length,
    inserted_count: insertResult.insertedCount,
    duplicate_count: insertResult.duplicateCount,
    duration_ms: totalDurationMs,
    sources: sourceStats,
  };
}

module.exports = {
  parsePortalHtml,
  parseStudentEmail,
  parseWebhookPayload,
  getSimulatedMultiSourceFeeds,
  crawlAllSources,
};
