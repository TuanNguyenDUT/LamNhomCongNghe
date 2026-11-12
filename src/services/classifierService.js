/**
 * TASK 13: Phát triển bộ lọc phân loại tin tức & thuật toán gắn nhãn độ ưu tiên
 * Phụ trách: Nguyễn Hữu Tuấn
 *
 * Chức năng chính:
 * 1. Tự động nhận diện và gắn Tag môn học (course_code, course_tag)
 * 2. Phân loại phạm vi thông báo: Thông báo chung (GENERAL), Lớp học phần (CLASS), Cá nhân (PERSONAL)
 * 3. Phân loại danh mục tin tức (EXAM, TUITION, SCHEDULE, ASSIGNMENT, EXTRACURRICULAR, GENERAL_NEWS)
 * 4. Thuật toán chấm điểm ưu tiên đa trọng số (0 - 100) và gắn nhãn (URGENT, HIGH, MEDIUM, LOW)
 */

const crypto = require('node:crypto');

// Danh mục môn học mặc định dùng cho bộ quy tắc gắn tag tự động
const DEFAULT_COURSES = [
  {
    course_code: 'IT401',
    course_name: 'Công nghệ phần mềm',
    course_tag: '#IT401-CNPM',
    faculty: 'Khoa Công nghệ Thông tin',
    keywords: ['it401', 'công nghệ phần mềm', 'cnpm', 'software engineering', 'scrum', 'mvp'],
  },
  {
    course_code: 'IT302',
    course_name: 'Cơ sở dữ liệu',
    course_tag: '#IT302-CSDL',
    faculty: 'Khoa Công nghệ Thông tin',
    keywords: ['it302', 'cơ sở dữ liệu', 'csdl', 'database', 'sql', 'erd'],
  },
  {
    course_code: 'IT408',
    course_name: 'Trí tuệ nhân tạo',
    course_tag: '#IT408-AI',
    faculty: 'Khoa Công nghệ Thông tin',
    keywords: ['it408', 'trí tuệ nhân tạo', 'artificial intelligence', 'machine learning', 'nhập môn ai'],
  },
  {
    course_code: 'IT205',
    course_name: 'Mạng máy tính',
    course_tag: '#IT205-MMT',
    faculty: 'Khoa Công nghệ Thông tin',
    keywords: ['it205', 'mạng máy tính', 'computer networks', 'tcp/ip', 'routing'],
  },
  {
    course_code: 'MAT101',
    course_name: 'Giải tích & Đại số tuyến tính',
    course_tag: '#MAT101-Toan',
    faculty: 'Khoa Khoa học Cơ bản',
    keywords: ['mat101', 'giải tích', 'đại số tuyến tính', 'toán cao cấp'],
  },
  {
    course_code: 'SSH101',
    course_name: 'Kỹ năng mềm & Khởi nghiệp',
    course_tag: '#SSH101-KNM',
    faculty: 'Trung tâm Đào tạo Kỹ năng',
    keywords: ['ssh101', 'kỹ năng mềm', 'khởi nghiệp', 'thuyết trình nhóm'],
  },
];

// Trọng số cơ sở theo nguồn gửi
const SOURCE_BASE_WEIGHTS = {
  TRAINING_DEPT: 30,   // Phòng Đào tạo
  FACULTY: 24,         // Khoa quản lý
  CLASS: 25,           // Giảng viên / Lớp học phần
  STUDENT_EMAIL: 22,   // Email sinh viên
  EXTRACURRICULAR: 10, // Kênh ngoại khóa / CLB / Đoàn - Hội
};

// Trọng số theo phạm vi thông báo (Chung / Lớp / Riêng)
const SCOPE_WEIGHTS = {
  PERSONAL: 18,
  CLASS: 12,
  GENERAL: 5,
};

// Bộ quy tắc từ khóa tính điểm ưu tiên và gắn tag chủ đề
const PRIORITY_RULES = [
  {
    category: 'EMERGENCY',
    tag: '#KhẩnCấp',
    weight: 42,
    keywords: [
      'khẩn cấp',
      'thông báo khẩn',
      'hỏa tốc',
      'hoãn thi',
      'nghỉ học đột xuất',
      'nghỉ bão',
      'cảnh báo học vụ',
      'buộc thôi học',
      'đình chỉ thi',
    ],
  },
  {
    category: 'EXAM',
    tag: '#LịchThi',
    weight: 30,
    keywords: [
      'lịch thi',
      'thi cuối kỳ',
      'thi giữa kỳ',
      'phòng thi',
      'danh sách thi',
      'bảo vệ đồ án',
      'chấm đồ án',
    ],
  },
  {
    category: 'TUITION',
    tag: '#HọcPhí',
    weight: 28,
    keywords: [
      'học phí',
      'nợ học phí',
      'gia hạn học phí',
      'thanh toán học phí',
      'hủy học phần do nợ',
    ],
  },
  {
    category: 'SCHEDULE',
    tag: '#LịchHọc',
    weight: 25,
    keywords: [
      'đổi phòng học',
      'thay đổi lịch học',
      'học bù',
      'lịch học bù',
      'chuyển ca học',
      'đăng ký tín chỉ',
      'đăng ký học phần',
    ],
  },
  {
    category: 'ASSIGNMENT',
    tag: '#BàiTập',
    weight: 22,
    keywords: [
      'hạn chót',
      'deadline',
      'nộp bài tập',
      'bài tập lớn',
      'nộp báo cáo',
      'kiểm tra nhanh',
      'quiz',
    ],
  },
  {
    category: 'SCHOLARSHIP',
    tag: '#HọcBổng',
    weight: 14,
    keywords: [
      'học bổng',
      'khuyến khích học tập',
      'điểm rèn luyện',
      'xét tốt nghiệp',
      'thực tập doanh nghiệp',
    ],
  },
  {
    category: 'EXTRACURRICULAR',
    tag: '#NgoạiKhóa',
    weight: -4,
    keywords: [
      'câu lạc bộ',
      'clb',
      'văn nghệ',
      'tình nguyện',
      'mùa hè xanh',
      'giao lưu',
      'minigame',
      'workshop ngoại khóa',
    ],
  },
];

// Từ khóa thúc giục về thời gian
const URGENCY_TIME_KEYWORDS = [
  'hôm nay',
  'ngay lập tức',
  'trong vòng 24h',
  'trước 17h',
  'sáng mai',
  'chiều nay',
  'gấp',
];

/**
 * Chuẩn hóa văn bản để so khớp từ khóa không phân biệt hoa thường
 */
function normalizeText(input = '') {
  return String(input).toLowerCase().trim();
}

/**
 * 1. Nhận diện môn học từ tiêu đề và nội dung
 */
function detectCourseTag(rawNotification, courses = DEFAULT_COURSES) {
  const combined = normalizeText(
    `${rawNotification.title || ''} ${rawNotification.content || ''} ${rawNotification.course_code || ''}`
  );

  // Nếu dữ liệu đầu vào đã chỉ định sẵn course_code hợp lệ
  if (rawNotification.course_code) {
    const codeUpper = String(rawNotification.course_code).toUpperCase().trim();
    const matched = courses.find((c) => c.course_code.toUpperCase() === codeUpper);
    if (matched) {
      return {
        course_code: matched.course_code,
        course_tag: matched.course_tag,
        course_name: matched.course_name,
      };
    }
  }

  for (const course of courses) {
    const keywords = Array.isArray(course.keywords)
      ? course.keywords
      : String(course.keywords).split(',').map((k) => k.trim());

    for (const kw of keywords) {
      if (kw && combined.includes(kw.toLowerCase())) {
        return {
          course_code: course.course_code,
          course_tag: course.course_tag,
          course_name: course.course_name,
        };
      }
    }
  }

  return {
    course_code: null,
    course_tag: null,
    course_name: null,
  };
}

/**
 * 2. Phân loại phạm vi thông báo: PERSONAL (Riêng), CLASS (Lớp học phần), GENERAL (Chung)
 */
function detectScopeType(rawNotification, detectedCourse) {
  if (rawNotification.scope_type && ['GENERAL', 'CLASS', 'PERSONAL'].includes(rawNotification.scope_type)) {
    return rawNotification.scope_type;
  }

  const combined = normalizeText(`${rawNotification.title || ''} ${rawNotification.content || ''}`);

  const personalIndicators = [
    'mssv',
    'mã số sinh viên',
    'cá nhân sinh viên',
    'của riêng bạn',
    'nhắc nợ học phí cá nhân',
    'cảnh báo học vụ đối với sinh viên',
    'kết quả phúc khảo của sinh viên',
    'hồ sơ cá nhân',
  ];

  if (
    rawNotification.recipient_student_id ||
    personalIndicators.some((kw) => combined.includes(kw))
  ) {
    return 'PERSONAL';
  }

  const classIndicators = [
    'lớp học phần',
    'nhóm học phần',
    'đổi phòng học',
    'lịch học bù',
    'nộp bài tập',
    'báo cáo đồ án',
  ];

  if (
    rawNotification.source_type === 'CLASS' ||
    detectedCourse.course_code ||
    classIndicators.some((kw) => combined.includes(kw))
  ) {
    return 'CLASS';
  }

  return 'GENERAL';
}

/**
 * 3. Thuật toán tính điểm ưu tiên (0 - 100) và gắn nhãn độ quan trọng
 */
function classifyNotification(rawNotification, courses = DEFAULT_COURSES) {
  const sourceType = rawNotification.source_type || 'TRAINING_DEPT';
  const title = String(rawNotification.title || '').trim();
  const content = String(rawNotification.content || '').trim();
  const combined = normalizeText(`${title} ${content}`);

  // Bước 1: Nhận diện môn học
  const courseInfo = detectCourseTag(rawNotification, courses);

  // Bước 2: Phân loại thông báo chung / lớp / riêng
  const scopeType = detectScopeType(rawNotification, courseInfo);

  // Bước 3: Tính điểm ưu tiên cơ sở từ kênh nguồn + phạm vi
  let score = (SOURCE_BASE_WEIGHTS[sourceType] || 15) + (SCOPE_WEIGHTS[scopeType] || 5);
  const matchedTags = new Set();
  let primaryCategory = 'GENERAL_NEWS';
  let highestRuleWeight = -999;

  if (courseInfo.course_tag) {
    matchedTags.add(courseInfo.course_tag);
  }

  // Bước 4: Quét bộ quy tắc từ khóa
  for (const rule of PRIORITY_RULES) {
    const isMatched = rule.keywords.some((kw) => combined.includes(kw));
    if (isMatched) {
      score += rule.weight;
      matchedTags.add(rule.tag);
      if (rule.weight > highestRuleWeight) {
        highestRuleWeight = rule.weight;
        primaryCategory = rule.category;
      }
    }
  }

  // Bước 5: Cộng điểm nếu có yếu tố thời gian gấp rút
  const hasUrgentTime = URGENCY_TIME_KEYWORDS.some((kw) => combined.includes(kw));
  if (hasUrgentTime) {
    score += 12;
    matchedTags.add('#Gấp');
  }

  // Bước 6: Gắn tag phạm vi
  if (scopeType === 'PERSONAL') {
    matchedTags.add('#TinRiêng');
  } else if (scopeType === 'CLASS') {
    matchedTags.add('#LớpHọcPhần');
  } else {
    matchedTags.add('#ThôngBáoChung');
  }

  // Giới hạn điểm trong khoảng [10, 100]
  const finalScore = Math.max(10, Math.min(100, Math.round(score)));

  // Quy đổi sang nhãn độ ưu tiên
  let priority = 'LOW';
  if (finalScore >= 80) {
    priority = 'URGENT';
  } else if (finalScore >= 60) {
    priority = 'HIGH';
  } else if (finalScore >= 40) {
    priority = 'MEDIUM';
  }

  // Tự động ghim (pin) nếu là tin URGENT từ Phòng Đào tạo / Khoa / Lớp
  const isPinned = priority === 'URGENT' && sourceType !== 'EXTRACURRICULAR' ? 1 : 0;

  // Tạo bản tóm tắt ngắn gọn phục vụ hiển thị Feed
  const summary =
    rawNotification.summary ||
    (content.length > 165 ? `${content.slice(0, 162).trim()}...` : content);

  // Tạo mã băm chống trùng lặp (Task 12 & Task 15)
  const publishedAt = rawNotification.published_at || new Date().toISOString();
  const hashSeed = `${sourceType}|${normalizeText(title)}|${String(publishedAt).slice(0, 10)}`;
  const contentHash = crypto.createHash('sha256').update(hashSeed).digest('hex');

  return {
    external_id: rawNotification.external_id || null,
    source_code: rawNotification.source_code || 'PORTAL_PDT',
    source_type: sourceType,
    channel_name: rawNotification.channel_name || 'Cổng thông tin Đào tạo',
    title,
    content,
    summary,
    sender_name: rawNotification.sender_name || 'Hệ thống Thông báo',
    sender_email: rawNotification.sender_email || null,
    recipient_student_id: rawNotification.recipient_student_id || null,
    course_code: courseInfo.course_code,
    course_tag: courseInfo.course_tag,
    scope_type: scopeType,
    category: primaryCategory,
    priority,
    priority_score: finalScore,
    tags: Array.from(matchedTags),
    tags_json: JSON.stringify(Array.from(matchedTags)),
    source_url: rawNotification.source_url || null,
    is_read: rawNotification.is_read ? 1 : 0,
    is_pinned: rawNotification.is_pinned !== undefined ? Number(Boolean(rawNotification.is_pinned)) : isPinned,
    content_hash: contentHash,
    published_at: publishedAt,
  };
}

module.exports = {
  DEFAULT_COURSES,
  detectCourseTag,
  detectScopeType,
  classifyNotification,
};
