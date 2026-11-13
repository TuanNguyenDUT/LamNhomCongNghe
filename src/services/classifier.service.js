/**
 * TASK 13: Phát triển bộ lọc phân loại tin tức & thuật toán gắn nhãn độ ưu tiên
 * Phụ trách: Nguyễn Hữu Tuấn
 *
 * Chức năng:
 * 1. Tự động gắn tag môn học (course_code, course_tag, tên môn học)
 * 2. Phân loại phạm vi thông báo: GENERAL (Chung), CLASS (Lớp học phần), PERSONAL (Riêng cá nhân)
 * 3. Thuật toán chấm điểm ưu tiên đa trọng số (0 - 100) và gắn nhãn (URGENT, HIGH, MEDIUM, LOW)
 * 4. Tự động sinh danh sách tags định dạng chuẩn (#IT401-CNPM, #LịchThi, #KhẩnCấp, #TinRiêng...)
 */

// Danh mục môn học mặc định tại trường (phục vụ đối soát và tự động gắn tag)
const DEFAULT_COURSES = [
  {
    course_code: 'IT401',
    course_name: 'Công nghệ phần mềm',
    course_tag: '#IT401-CNPM',
    faculty_code: 'FAST_IT',
    keywords: ['it401', 'công nghệ phần mềm', 'cnpm', 'software engineering', 'scrum', 'mvp', 'sprint'],
  },
  {
    course_code: 'IT302',
    course_name: 'Cơ sở dữ liệu',
    course_tag: '#IT302-CSDL',
    faculty_code: 'FAST_IT',
    keywords: ['it302', 'cơ sở dữ liệu', 'csdl', 'database', 'sql', 'postgresql', 'erd'],
  },
  {
    course_code: 'IT408',
    course_name: 'Trí tuệ nhân tạo',
    course_tag: '#IT408-AI',
    faculty_code: 'FAST_IT',
    keywords: ['it408', 'trí tuệ nhân tạo', 'artificial intelligence', 'machine learning', 'nhập môn ai'],
  },
  {
    course_code: 'IT205',
    course_name: 'Mạng máy tính',
    course_tag: '#IT205-MMT',
    faculty_code: 'FAST_IT',
    keywords: ['it205', 'mạng máy tính', 'computer networks', 'tcp/ip', 'routing', 'cisco'],
  },
  {
    course_code: 'IT305',
    course_name: 'Lập trình ứng dụng di động',
    course_tag: '#IT305-Mobile',
    faculty_code: 'FAST_IT',
    keywords: ['it305', 'ứng dụng di động', 'mobile app', 'flutter', 'android', 'ios'],
  },
  {
    course_code: 'MAT101',
    course_name: 'Giải tích & Đại số tuyến tính',
    course_tag: '#MAT101-Toan',
    faculty_code: 'SCIENCE',
    keywords: ['mat101', 'giải tích', 'đại số tuyến tính', 'toán cao cấp'],
  },
  {
    course_code: 'SSH101',
    course_name: 'Kỹ năng mềm & Khởi nghiệp',
    course_tag: '#SSH101-KNM',
    faculty_code: 'SKILLS',
    keywords: ['ssh101', 'kỹ năng mềm', 'khởi nghiệp', 'thuyết trình nhóm'],
  },
];

// Trọng số cơ sở theo kênh nguồn
const SOURCE_BASE_WEIGHTS = {
  TRAINING_DEPT: 30,   // Phòng Đào tạo
  FACULTY: 25,         // Khoa chuyên môn
  CLASS_SECTION: 25,   // Lớp học phần / Giảng viên
  STUDENT_EMAIL: 22,   // Email sinh viên
  EXTRACURRICULAR: 10, // Ngoại khóa / CLB
};

// Trọng số theo phạm vi gửi tin
const SCOPE_WEIGHTS = {
  PERSONAL: 20, // Tin riêng cá nhân sinh viên
  CLASS: 12,    // Tin lớp học phần
  GENERAL: 5,   // Thông báo chung toàn trường / khoa
};

// Bộ quy tắc từ khóa theo chủ đề để tính điểm ưu tiên và phân loại danh mục
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
      'phạt cảnh cáo',
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
      'danh sách phòng thi',
      'bảo vệ đồ án',
      'chấm đồ án',
      'vấn đáp',
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
      'hủy học phần do nợ học phí',
      'hóa đơn học phí',
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
      'rút học phần',
    ],
  },
  {
    category: 'ASSIGNMENT',
    tag: '#BàiTập',
    weight: 22,
    keywords: [
      'hạn chót',
      'deadline',
      'nộp bài',
      'nộp bài tập',
      'bài tập lớn',
      'nộp báo cáo',
      'báo cáo tiến độ',
      'quiz',
      'kiểm tra nhanh',
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
      'ngày hội việc làm',
    ],
  },
  {
    category: 'EXTRACURRICULAR',
    tag: '#NgoạiKhóa',
    weight: -6,
    keywords: [
      'câu lạc bộ',
      'clb',
      'văn nghệ',
      'tình nguyện',
      'mùa hè xanh',
      'giao lưu',
      'minigame',
      'workshop ngoại khóa',
      'sinh hoạt đoàn',
    ],
  },
];

// Từ khóa thể hiện tính cấp bách về mặt thời gian
const URGENCY_TIME_KEYWORDS = [
  'hôm nay',
  'ngay lập tức',
  'trong vòng 24h',
  'trước 17h',
  'trước 23h59',
  'sáng mai',
  'chiều nay',
  'gấp',
  'khẩn',
  'hạn chót hôm nay',
];

function normalizeText(text = '') {
  return String(text).toLowerCase().trim();
}

/**
 * 1. Tự động nhận diện môn học và gắn tag môn học
 * @param {Object} rawNotification - { title, content, course_code }
 * @param {Array} customCourses - Danh sách môn học tùy chọn
 * @returns {Object} { course_code, course_tag, course_name }
 */
function detectCourseTag(rawNotification = {}, customCourses = DEFAULT_COURSES) {
  const combined = normalizeText(
    `${rawNotification.title || ''} ${rawNotification.content || ''} ${rawNotification.course_code || ''}`
  );

  // Nếu đầu vào đã chỉ định sẵn course_code
  if (rawNotification.course_code) {
    const codeUpper = String(rawNotification.course_code).toUpperCase().trim();
    const matched = customCourses.find((c) => c.course_code.toUpperCase() === codeUpper);
    if (matched) {
      return {
        course_code: matched.course_code,
        course_tag: matched.course_tag,
        course_name: matched.course_name,
      };
    }
  }

  // Tra khớp qua danh mục môn học
  for (const course of customCourses) {
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

  // Quét nhận diện mã môn học bằng Regex (Ví dụ: IT401, IT302, MAT101...)
  const codeRegexMatch = combined.match(/\b([a-z]{2,4}\d{3}[a-z]?)\b/i);
  if (codeRegexMatch) {
    const detectedCode = codeRegexMatch[1].toUpperCase();
    return {
      course_code: detectedCode,
      course_tag: `#${detectedCode}`,
      course_name: `Môn học ${detectedCode}`,
    };
  }

  return {
    course_code: null,
    course_tag: null,
    course_name: null,
  };
}

/**
 * 2. Phân loại phạm vi thông báo: GENERAL (Chung), CLASS (Lớp học phần), PERSONAL (Riêng cá nhân)
 * @param {Object} rawNotification
 * @param {Object} detectedCourse
 * @returns {string} 'PERSONAL' | 'CLASS' | 'GENERAL'
 */
function detectScopeType(rawNotification = {}, detectedCourse = {}) {
  // Nếu payload đã truyền sẵn scope_type hợp lệ
  if (
    rawNotification.scope_type &&
    ['GENERAL', 'CLASS', 'PERSONAL'].includes(rawNotification.scope_type)
  ) {
    return rawNotification.scope_type;
  }

  const combined = normalizeText(`${rawNotification.title || ''} ${rawNotification.content || ''}`);

  // Dấu hiệu nhận diện thông báo riêng cho cá nhân sinh viên
  const personalIndicators = [
    'mssv',
    'mã số sinh viên',
    'cá nhân sinh viên',
    'của riêng bạn',
    'nhắc nợ học phí cá nhân',
    'cảnh báo học vụ đối với sinh viên',
    'kết quả phúc khảo của sinh viên',
    'hồ sơ cá nhân',
    'khen thưởng cá nhân',
  ];

  const hasStudentId =
    rawNotification.target_student_id ||
    rawNotification.recipient_student_id ||
    /\b(102\d{6,7})\b/.test(combined);

  if (hasStudentId || personalIndicators.some((kw) => combined.includes(kw))) {
    return 'PERSONAL';
  }

  // Dấu hiệu nhận diện thông báo theo lớp học phần
  const classIndicators = [
    'lớp học phần',
    'nhóm học phần',
    'đổi phòng học',
    'lịch học bù',
    'nộp bài tập lớn',
    'báo cáo đồ án',
    'buổi thực hành',
    'sprint',
    'bảo vệ đồ án',
  ];

  if (
    rawNotification.source_type === 'CLASS_SECTION' ||
    rawNotification.section_id ||
    detectedCourse.course_code ||
    classIndicators.some((kw) => combined.includes(kw))
  ) {
    return 'CLASS';
  }

  return 'GENERAL';
}

/**
 * 3. Thuật toán tính điểm ưu tiên đa trọng số (0 - 100) & gắn nhãn độ quan trọng
 * @param {Object} rawNotification
 * @param {Array} customCourses
 * @returns {Object} Thông tin phân loại hoàn chỉnh
 */
function classifyNotification(rawNotification = {}, customCourses = DEFAULT_COURSES) {
  const sourceType = rawNotification.source_type || 'TRAINING_DEPT';
  const title = String(rawNotification.title || '').trim();
  const content = String(rawNotification.content || '').trim();
  const combined = normalizeText(`${title} ${content}`);

  // Bước 1: Nhận diện môn học & gắn tag môn học
  const courseInfo = detectCourseTag(rawNotification, customCourses);

  // Bước 2: Phân loại thông báo chung / lớp / riêng
  const scopeType = detectScopeType(rawNotification, courseInfo);

  // Bước 3: Điểm cơ sở = Trọng số kênh nguồn + Trọng số phạm vi
  let score = (SOURCE_BASE_WEIGHTS[sourceType] || 20) + (SCOPE_WEIGHTS[scopeType] || 5);

  const matchedTags = new Set();
  let primaryCategory = 'GENERAL_NEWS';
  let highestRuleWeight = -999;

  // Gắn tag môn học vào danh sách tags
  if (courseInfo.course_tag) {
    matchedTags.add(courseInfo.course_tag);
  }

  // Bước 4: Áp dụng các bộ quy tắc từ khóa (Rules)
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

  // Bước 5: Yếu tố thúc giục thời gian gấp rút
  const hasUrgentTime = URGENCY_TIME_KEYWORDS.some((kw) => combined.includes(kw));
  if (hasUrgentTime) {
    score += 12;
    matchedTags.add('#Gấp');
  }

  // Bước 6: Gắn nhãn phạm vi
  if (scopeType === 'PERSONAL') {
    matchedTags.add('#TinRiêng');
  } else if (scopeType === 'CLASS') {
    matchedTags.add('#LớpHọcPhần');
  } else {
    matchedTags.add('#ThôngBáoChung');
  }

  // Giới hạn điểm chuẩn hóa trong khoảng [10, 100]
  const finalScore = Math.max(10, Math.min(100, Math.round(score)));

  // Bước 7: Quy đổi sang nhãn cấp độ ưu tiên (URGENT, HIGH, MEDIUM, LOW)
  let priority = 'LOW';
  if (finalScore >= 80) {
    priority = 'URGENT';
  } else if (finalScore >= 60) {
    priority = 'HIGH';
  } else if (finalScore >= 40) {
    priority = 'MEDIUM';
  }

  // Tóm tắt ngắn gọn nếu chưa có
  const summary =
    rawNotification.summary ||
    (content.length > 160 ? `${content.slice(0, 157).trim()}...` : content);

  // Trích xuất MSSV sinh viên cá nhân nếu có
  const mssvMatch = combined.match(/\b(102\d{6,7})\b/);
  const targetStudentId =
    rawNotification.target_student_id ||
    rawNotification.recipient_student_id ||
    (mssvMatch ? mssvMatch[1] : null);

  const tagsArray = Array.from(matchedTags);

  return {
    source_type: sourceType,
    title,
    content,
    summary,
    course_code: courseInfo.course_code,
    course_tag: courseInfo.course_tag,
    course_name: courseInfo.course_name,
    scope_type: scopeType,
    category: primaryCategory,
    priority,
    priority_score: finalScore,
    target_student_id: targetStudentId,
    tags: tagsArray,
    scoring_breakdown: {
      source_base_weight: SOURCE_BASE_WEIGHTS[sourceType] || 20,
      scope_weight: SCOPE_WEIGHTS[scopeType] || 5,
      matched_category: primaryCategory,
      rule_weight: highestRuleWeight > -999 ? highestRuleWeight : 0,
      time_urgency_bonus: hasUrgentTime ? 12 : 0,
      final_score: finalScore,
    },
  };
}

module.exports = {
  DEFAULT_COURSES,
  SOURCE_BASE_WEIGHTS,
  SCOPE_WEIGHTS,
  PRIORITY_RULES,
  URGENCY_TIME_KEYWORDS,
  detectCourseTag,
  detectScopeType,
  classifyNotification,
};
