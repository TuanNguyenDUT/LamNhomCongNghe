/**
 * HỆ THỐNG PHÂN LOẠI THÔNG BÁO THÔNG MINH (SMART CLASSIFIER & RULES ENGINE)
 * Triển khai theo đặc tả kỹ thuật AGENT.md (Mục II.3.2)
 *
 * Chức năng:
 * 1. Phân loại theo Quy tắc Logic (Rules Engine) cho nguồn có cấu trúc (sv.dut.udn.vn)
 * 2. Phân loại & Tóm tắt bằng AI API (Gemini / Fallback Heuristic) cho bài viết Facebook & văn bản tự do
 * 3. Công thức tính điểm ưu tiên đa trọng số S_total = W_base + W_scope + W_keyword + W_urgency
 * 4. Tự động nhận diện môn học, phòng học, lịch học bù, nghỉ dạy, và hạn chót (deadline)
 */

const { aiService } = require('../config/ai');
const { getDbStore } = require('../config/db');

// Danh mục môn học phục vụ nhận diện và tự động gắn tag
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

// Trọng số cơ sở W_base
const SOURCE_BASE_WEIGHTS = {
  // Chuẩn AGENT.md
  DUT_COURSE_CLASS: 25,
  DUT_TUITION_FEE: 25,
  DUT_TRAINING: 20,
  DUT_TESTING_QA: 20,
  DUT_STUDENT_AFFAIRS: 15,
  DUT_GENERAL: 15,
  FB_CTSV: 10,
  FB_TUVAN_SV: 10,
  DUT_REGULATIONS: 10,

  // Chuẩn legacy Task 11 / Task 13
  TRAINING_DEPT: 30,
  FACULTY: 25,
  CLASS_SECTION: 25,
  STUDENT_EMAIL: 22,
  EXTRACURRICULAR: 10,
};

// Trọng số phạm vi W_scope
const SCOPE_WEIGHTS = {
  PERSONAL: 20,
  CLASS: 12,
  GENERAL: 5,
  // Chuẩn AGENT.md
  COURSE: 25,
  FACULTY: 15,
  COHORT: 15,
  GLOBAL: 5,
};

// Bộ quy tắc từ khóa theo chủ đề
const PRIORITY_RULES = [
  {
    category: 'EMERGENCY',
    tag: '#KhẩnCấp',
    weight: 42,
    is_emergency: true,
    keywords: [
      'khẩn cấp',
      'thông báo khẩn',
      'hỏa tốc',
      'hoãn thi',
      'nghỉ học đột xuất',
      'nghỉ bão',
      'nghỉ dạy',
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
      'thi kết thúc học phần',
      'bảo vệ đồ án',
      'chấm đồ án',
      'vấn đáp',
      'bảo vệ tốt nghiệp',
      'khảo thí',
    ],
  },
  {
    category: 'TUITION',
    tag: '#HọcPhí',
    weight: 28,
    keywords: [
      'học phí',
      'nợ học phí',
      'nhắc nợ học phí',
      'gia hạn học phí',
      'thanh toán học phí',
      'hủy học phần do nợ học phí',
      'hóa đơn học phí',
      'miễn giảm học phí',
      'khóa tài khoản',
      'lệ phí',
    ],
  },
  {
    category: 'SCHEDULE',
    tag: '#LịchHọc',
    weight: 25,
    keywords: [
      'lịch học',
      'đổi phòng học',
      'học bù',
      'nghỉ học',
      'chuyển phòng',
      'thời khóa biểu',
      'thay đổi lịch',
    ],
  },
  {
    category: 'ASSIGNMENT',
    tag: '#BàiTập',
    weight: 22,
    keywords: [
      'bài tập lớn',
      'nộp bài',
      'deadline',
      'hạn chót',
      'báo cáo tiến độ',
      'nộp đồ án',
      'assignment',
      'thực hành',
    ],
  },
  {
    category: 'SCHOLARSHIP',
    tag: '#HọcBổng',
    weight: 14,
    keywords: [
      'học bổng',
      'khuyến khích học tập',
      'tài trợ',
      'doanh nghiệp trao học bổng',
      'khen thưởng',
    ],
  },
  {
    category: 'ACTIVITIES',
    tag: '#NgoạiKhóa',
    weight: -6,
    keywords: [
      'ngoại khóa',
      'clb',
      'câu lạc bộ',
      'giao lưu',
      'minigame',
      'tình nguyện',
      'văn nghệ',
      'đêm nhạc',
      'thể thao',
    ],
  },
];

// Yếu tố thời gian khẩn cấp
const URGENCY_TIME_KEYWORDS = [
  'hôm nay',
  'ngay lập tức',
  'trước 17h',
  'trong vòng 24h',
  'trong ngày',
  'gấp',
  'hạn chót hôm nay',
];

/**
 * 1. Nhận diện môn học & gắn tag chuẩn (Hỗ trợ cả Default Courses và Dynamic Enrolled Courses từ sv.dut.udn.vn)
 */
function detectCourseTag({ title = '', content = '', course_code = null, source_channel = null, source_type = null } = {}) {
  const channel = source_channel || source_type;
  // Các kênh Fanpage và các kênh thông báo chung tuyệt đối không bao giờ là Lớp học phần
  if (
    channel === 'FB_CTSV' ||
    channel === 'FB_TUVAN_SV' ||
    channel === 'DUT_GENERAL' ||
    channel === 'DUT_STUDENT_AFFAIRS' ||
    channel === 'DUT_REGULATIONS' ||
    channel === 'DUT_TUITION_FEE'
  ) {
    return {
      course_code: null,
      course_tag: null,
      course_name: null,
    };
  }

  const fullText = `${title} ${content}`.toLowerCase();

  // 0. Trích xuất nhóm lớp [23.Nh16], [23.Nh99], [24.Nh71D]... từ tiêu đề
  const groupMatch = (title + ' ' + content).match(/\[(\d{2}\.(?:Nh)?[0-9A-Za-z]+)\]/i);
  const rawGroup = groupMatch ? groupMatch[1] : null;
  const notifGroupNorm = rawGroup ? rawGroup.replace(/Nh/i, '').toUpperCase() : null; // "23.16" hoặc "23.99"

  // 1. So khớp mã môn truyền trực tiếp với bộ môn chuẩn
  if (course_code) {
    const matched = DEFAULT_COURSES.find(
      (c) => c.course_code.toLowerCase() === course_code.toLowerCase()
    );
    if (matched) {
      return {
        course_code: matched.course_code,
        course_tag: matched.course_tag,
        course_name: matched.course_name,
      };
    }
  }

  // 2. So khớp từ khóa với bộ môn chuẩn DEFAULT_COURSES
  for (const course of DEFAULT_COURSES) {
    for (const kw of course.keywords) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(fullText)) {
        return {
          course_code: course.course_code,
          course_tag: course.course_tag,
          course_name: course.course_name,
        };
      }
    }
  }

  // 3. So khớp với danh mục môn học động lưu trong Database (cào từ sv.dut.udn.vn)
  try {
    const dbStore = getDbStore();
    if (dbStore && dbStore.courses) {
      for (const c of dbStore.courses.values()) {
        const cCodeLower = (c.course_code || '').toLowerCase();
        const cNameLower = (c.course_name || '').toLowerCase();

        // Ưu tiên 3.1: So khớp mã học phần đầy đủ (VD: 1023910.2610.23.16)
        if (c.course_code && (course_code === c.course_code || fullText.includes(cCodeLower))) {
          return {
            course_code: c.course_code,
            course_tag: `#${c.course_code}`,
            course_name: c.course_name,
          };
        }

        // Ưu tiên 3.2: So khớp theo mã chuẩn DUT <MãHP>.<Kỳ>.<Khóa>.<Lớp> kết hợp Nhóm lớp và Tên môn
        // VD: 1023603.2610.23.99 -> Nhóm "23.99" / "23.Nh99", Tên: "Chuyên đề công nghệ"
        const parts = (c.course_code || '').split('.');
        if (parts.length >= 4) {
          const hpPrefix = `${parts[0]}.${parts[1]}`.toLowerCase(); // 1023603.2610
          const courseGroupNorm = `${parts[2]}.${parts[3]}`.toUpperCase(); // 23.99

          if (notifGroupNorm && notifGroupNorm === courseGroupNorm) {
            if (cNameLower && (fullText.includes(cNameLower) || title.toLowerCase().includes(cNameLower))) {
              return {
                course_code: c.course_code,
                course_tag: `#${c.course_code}`,
                course_name: c.course_name,
              };
            }
          }

          if (fullText.includes(hpPrefix) && (!notifGroupNorm || notifGroupNorm === courseGroupNorm)) {
            return {
              course_code: c.course_code,
              course_tag: `#${c.course_code}`,
              course_name: c.course_name,
            };
          }
        }

        // Ưu tiên 3.3: Nếu không có mã nhóm trong thông báo nhưng tên môn học dài và rất đặc thù
        if (!notifGroupNorm && c.course_name && c.course_name.length > 8) {
          if (fullText.includes(cNameLower)) {
            return {
              course_code: c.course_code,
              course_tag: `#${c.course_code}`,
              course_name: c.course_name,
            };
          }
        }
      }
    }
  } catch {}

  // 4. So khớp Regex mã lớp học phần sv.dut.udn.vn dạng số (VD: 1020503.2610.23.16 hoặc 1020503)
  const dutCodeRegex = /\b(\d{7}(\.\d{4}\.\d{2}\.\w+)?)\b/i;
  const dutMatch = fullText.match(dutCodeRegex);
  if (dutMatch) {
    const rawCode = dutMatch[1];
    return {
      course_code: rawCode,
      course_tag: `#${rawCode}`,
      course_name: null,
    };
  }

  // 5. So khớp mã môn dạng chữ số chuẩn (IT401, CSDL...)
  const codeRegex = /\b([a-z]{2,4}\d{3}[a-z]?)\b/i;
  const match = fullText.match(codeRegex);
  if (match) {
    const rawCode = match[1].toUpperCase();
    return {
      course_code: rawCode,
      course_tag: `#${rawCode}`,
      course_name: null,
    };
  }

  // 6. Nếu có nhóm lớp học phần [24.Nh71D] nhưng chưa có trong DB môn học
  if (rawGroup) {
    const subMatch = title.match(/thông báo đến lớp:\s*([^\[]+)\[/i);
    const subName = subMatch ? subMatch[1].trim() : null;
    return {
      course_code: null,
      course_tag: `#${rawGroup}`,
      course_name: subName,
    };
  }

  return {
    course_code: null,
    course_tag: null,
    course_name: null,
  };
}

/**
 * 2. Phân loại phạm vi thông báo
 */
function detectScopeType(payload = {}, detectedCourse = {}) {
  const title = (payload.title || '').toLowerCase();
  const content = (payload.content || '').toLowerCase();
  const fullText = `${title} ${content}`;
  const sourceType = payload.source_channel || payload.source_type;
  const isFbChannel = sourceType === 'FB_CTSV' || sourceType === 'FB_TUVAN_SV';

  // Cá nhân (PERSONAL)
  if (
    payload.target_student_id ||
    /\b102\d{6}\b/.test(fullText) ||
    /mssv:\s*\d+/i.test(fullText) ||
    /nhắc nợ học phí cá nhân|cảnh báo học vụ|kết quả phúc khảo|hồ sơ cá nhân/i.test(fullText)
  ) {
    return 'PERSONAL';
  }

  // Lớp học phần (CLASS / COURSE) - Tuyệt đối không áp dụng cho Fanpage
  if (
    !isFbChannel &&
    (sourceType === 'DUT_COURSE_CLASS' ||
      sourceType === 'CLASS_SECTION' ||
      detectedCourse.course_code ||
      /lớp học phần|đổi phòng học|học bù|bài tập lớn|nộp báo cáo đồ án|thực hành/i.test(fullText))
  ) {
    return payload.source_channel ? 'COURSE' : 'CLASS';
  }

  // Khoa / Khóa
  if (/toàn khoa|sinh viên khoa/i.test(fullText)) return 'FACULTY';
  if (/khóa 20|k20|k21|k22|k23|k24/i.test(fullText)) return 'COHORT';

  // Thông báo chung
  return payload.source_channel ? 'GLOBAL' : 'GENERAL';
}

/**
 * 3. Trích xuất hạn chót (deadline_at) bằng Regex
 */
function extractDeadline(text = '') {
  const deadlineRegex = /(?:trước ngày|hạn cuối|hạn chót|đến hết ngày|trước 17h ngày|trước 23h59 ngày)\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/i;
  const match = text.match(deadlineRegex);
  if (match) {
    const day = match[1].padStart(2, '0');
    const month = match[2].padStart(2, '0');
    const year = match[3];
    return new Date(`${year}-${month}-${day}T17:00:00.000Z`).toISOString();
  }
  return null;
}

/**
 * 4. Trích xuất chi tiết lịch học bù / đổi phòng bằng Regex
 */
function extractRescheduleDetails(text = '') {
  const roomMatch = text.match(/(?:phòng|chuyển sang phòng)\s*([A-Za-z0-9\-\.]+)/i);
  const dateMatch = text.match(/(?:vào ngày|học bù vào)\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/i);
  const periodMatch = text.match(/(?:tiết|tiết học)\s*(\d+[\s\-\,]+\d+)/i);
  return {
    room: roomMatch ? roomMatch[1].replace(/[.,;:]+$/, '').toUpperCase() : null,
    makeup_date: dateMatch ? dateMatch[1] : null,
    periods: periodMatch ? periodMatch[1] : null,
  };
}

/**
 * 5. Thuật toán tính điểm ưu tiên & gắn nhãn (Hỗ trợ cả legacy & chuẩn AGENT.md)
 */
function classifyNotification(payload = {}) {
  const title = payload.title || '';
  const content = payload.content || '';
  const fullText = `${title} ${content}`.toLowerCase();
  const rawSource = payload.source_channel || payload.source_type || 'DUT_GENERAL';

  // 1. Nhận diện môn học
  const courseInfo = detectCourseTag({
    title,
    content,
    course_code: payload.course_code,
    source_channel: rawSource,
    source_type: rawSource,
  });

  // 2. Nhận diện phạm vi
  const scopeType = detectScopeType(payload, courseInfo);

  // 3. Trọng số cơ sở & phạm vi
  const baseWeight = SOURCE_BASE_WEIGHTS[rawSource] !== undefined ? SOURCE_BASE_WEIGHTS[rawSource] : 15;
  const scopeWeight = SCOPE_WEIGHTS[scopeType] !== undefined ? SCOPE_WEIGHTS[scopeType] : 5;

  let highestRuleWeight = -999;
  let ruleWeightSum = 0;
  const tags = [];
  let isEmergency = false;

  const isFb = rawSource === 'FB_CTSV' || rawSource === 'FB_TUVAN_SV';

  if (courseInfo.course_tag && !isFb) {
    tags.push(courseInfo.course_tag);
  }

  // Quét từ khóa (sử dụng includes tiếng Việt an toàn)
  for (const rule of PRIORITY_RULES) {
    const matched = rule.keywords.some((kw) => fullText.includes(kw.toLowerCase()));
    if (matched) {
      if (rule.weight > highestRuleWeight) highestRuleWeight = rule.weight;
      ruleWeightSum += rule.weight;
      if (!tags.includes(rule.tag)) {
        tags.push(rule.tag);
      }
      if (rule.is_emergency) {
        isEmergency = true;
      }
    }
  }

  // Bonus yếu tố thời gian
  let urgencyBonus = 0;
  const hasUrgentTime = URGENCY_TIME_KEYWORDS.some((kw) => fullText.includes(kw));
  if (hasUrgentTime) {
    urgencyBonus += 12;
    if (!tags.includes('#Gấp')) tags.push('#Gấp');
  }

  // Kiểm tra hạn chót nếu có
  const deadlineAt = payload.deadline_at || extractDeadline(fullText);
  if (deadlineAt) {
    const hoursRemaining = (new Date(deadlineAt).getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursRemaining > 0 && hoursRemaining <= 24) {
      urgencyBonus += 30;
    } else if (hoursRemaining > 0 && hoursRemaining <= 72) {
      urgencyBonus += 20;
    } else if (hoursRemaining > 0 && hoursRemaining <= 168) {
      urgencyBonus += 10;
    }
  }

  // Gắn tag phạm vi
  if (scopeType === 'PERSONAL') {
    if (!tags.includes('#TinRiêng')) tags.push('#TinRiêng');
  } else if ((scopeType === 'CLASS' || scopeType === 'COURSE') && !isFb) {
    if (!tags.includes('#LớpHọcPhần')) tags.push('#LớpHọcPhần');
  } else {
    if (!tags.includes('#ThôngBáoChung')) tags.push('#ThôngBáoChung');
  }

  // Tính điểm ưu tiên: Nếu dùng source_channel mới thì dùng ruleWeightSum, nếu legacy thì dùng highestRuleWeight
  const ruleWeightToUse = payload.source_channel
    ? ruleWeightSum
    : (highestRuleWeight > -999 ? highestRuleWeight : 0);

  let priorityScore = baseWeight + scopeWeight + ruleWeightToUse + urgencyBonus;
  priorityScore = Math.max(10, Math.min(100, Math.round(priorityScore)));

  // Quy đổi nhãn Priority
  let priority = 'LOW';
  if (priorityScore >= 80) {
    priority = 'URGENT';
  } else if (priorityScore >= 60) {
    priority = 'HIGH';
  } else if (priorityScore >= 40) {
    priority = 'MEDIUM';
  } else {
    priority = 'LOW';
  }

  // Trích xuất MSSV nếu có
  let targetStudentId = payload.target_student_id || null;
  if (!targetStudentId) {
    const mssvMatch = fullText.match(/\b(102\d{6})\b/);
    if (mssvMatch) targetStudentId = mssvMatch[1];
  }

  const topics = detectNotificationTopics(payload);

  return {
    course_code: isFb ? null : courseInfo.course_code,
    course_tag: isFb ? null : courseInfo.course_tag,
    course_name: isFb ? null : courseInfo.course_name,
    scope_type: scopeType,
    scope: scopeType,
    priority,
    priority_score: priorityScore,
    tags,
    topics,
    target_student_id: targetStudentId,
    is_emergency: isEmergency,
    deadline_at: deadlineAt,
    classified_by: 'RULE_ENGINE',
    reschedule_details: extractRescheduleDetails(fullText),
  };
}

/**
 * 6. Smart Router: Phối hợp Rules Engine & AI API theo AGENT.md Mục II.3.2
 */
async function classifySmartNotification(payload = {}) {
  const source = payload.source_channel || payload.source_type || 'DUT_GENERAL';
  const isFacebook = source === 'FB_CTSV' || source === 'FB_TUVAN_SV';
  const wordCount = (payload.content || '').split(/\s+/).length;

  if (isFacebook || wordCount > 150) {
    const aiResult = await aiService.analyzeArticle(payload.content || '', payload.title || '');
    const ruleClassification = classifyNotification({
      ...payload,
      scope: aiResult.scope,
      deadline_at: aiResult.deadline_at,
    });

    let mergedTags = Array.from(new Set([
      ...ruleClassification.tags,
      ...(aiResult.tags || []).map(t => `#${t}`)
    ]));

    if (isFacebook) {
      mergedTags = mergedTags.filter(t => !t.includes('LớpHọcPhần') && !t.includes('IT408') && !t.includes('SSH101') && !t.includes('IT302') && !t.includes('IT401'));
    }

    return {
      ...ruleClassification,
      course_code: isFacebook ? null : ruleClassification.course_code,
      course_tag: isFacebook ? null : ruleClassification.course_tag,
      course_name: isFacebook ? null : ruleClassification.course_name,
      summary: aiResult.summary,
      action_required: aiResult.action_required,
      deadline_at: aiResult.deadline_at || ruleClassification.deadline_at,
      tags: mergedTags,
      is_emergency: aiResult.is_emergency || ruleClassification.is_emergency,
      classified_by: 'AI_API',
    };
  }

  const result = classifyNotification(payload);
  const sentences = (payload.content || '').split(/[.\n]+/).filter(Boolean);
  const summary = sentences.slice(0, 2).join('. ') + (sentences.length > 0 ? '.' : '');

  return {
    ...result,
    summary: summary || payload.title,
    action_required: result.is_emergency ? 'Kiểm tra lịch học và cập nhật thời khóa biểu mới.' : null,
    classified_by: 'RULE_ENGINE',
  };
}

/**
 * Nhận diện chủ đề thông báo phục vụ cá nhân hóa & bộ lọc thông báo đẩy (FCM)
 * 1. hoc_vu: Học vụ (Đào tạo, Lớp học phần, Khảo thí & ĐBCL, Quy chế, Lịch thi, ...)
 * 2. hoc_bong: Học bổng (Học bổng khuyến khích, tài trợ, khen thưởng học tập, ...)
 * 3. hoat_dong_sv: Hoạt động sinh viên (Công tác SV, Đoàn - Hội, Điểm rèn luyện, CLB, ...)
 * 4. tuyen_dung: Tuyển dụng / Thực tập (Thực tập tốt nghiệp, cơ hội việc làm, ...)
 */
function detectNotificationTopics(payload = {}) {
  const title = (payload.title || '').toLowerCase();
  const content = (payload.content || payload.content_summary || payload.summary || '').toLowerCase();
  const tags = (payload.tags || []).join(' ').toLowerCase();
  const channel = (payload.source_channel || payload.source_type || '').toUpperCase();
  const full = `${title} ${content} ${tags}`;

  const topics = [];

  // 1. Học vụ (hoc_vu)
  const hocVuChannels = ['DUT_TRAINING', 'DUT_COURSE_CLASS', 'DUT_TESTING_QA', 'DUT_REGULATIONS', 'DUT_TUITION_FEE'];
  const hocVuKeywords = [
    'học vụ', 'đào tạo', 'học phần', 'tín chỉ', 'lịch thi', 'thi học kỳ',
    'hoãn thi', 'phúc khảo', 'điểm thi', 'tốt nghiệp', 'bảng điểm', 'lớp học phần',
    'nghỉ học', 'học bù', 'đổi phòng', 'bài tập', 'đồ án', 'quy chế', 'học phí',
    'thời khóa biểu', 'đăng ký môn', 'chứng chỉ', 'chuẩn đầu ra'
  ];
  if (hocVuChannels.includes(channel) || hocVuKeywords.some((kw) => full.includes(kw))) {
    topics.push('hoc_vu');
  }

  // 2. Học bổng (hoc_bong)
  const hocBongKeywords = [
    'học bổng', 'khuyến khích học tập', 'trợ cấp', 'tài trợ học bổng',
    'khen thưởng', 'scholarship', 'tài trợ', 'doanh nghiệp trao', 'trao học bổng'
  ];
  if (hocBongKeywords.some((kw) => full.includes(kw))) {
    topics.push('hoc_bong');
  }

  // 3. Hoạt động sinh viên (hoat_dong_sv)
  const hoatDongChannels = ['DUT_STUDENT_AFFAIRS', 'FB_CTSV', 'FB_TUVAN_SV'];
  const hoatDongKeywords = [
    'hoạt động', 'phong trào', 'tình nguyện', 'đoàn thanh niên', 'hội sinh viên',
    'điểm rèn luyện', 'câu lạc bộ', 'hội thao', 'hiến máu', 'ngoại khóa',
    'tư vấn', 'khen thưởng rèn luyện', 'sinh viên tiêu biểu', 'tuyên dương',
    'hỗ trợ sinh viên', 'chính sách xã hội'
  ];
  if (hoatDongChannels.includes(channel) || hoatDongKeywords.some((kw) => full.includes(kw))) {
    topics.push('hoat_dong_sv');
  }

  // 4. Tuyển dụng / Thực tập (tuyen_dung)
  const tuyenDungKeywords = [
    'tuyển dụng', 'thực tập', 'việc làm', 'career', 'internship',
    'hội chợ việc làm', 'doanh nghiệp tuyển', 'job fair', 'cơ hội nghề nghiệp',
    'ngày hội việc làm', 'tuyển sinh viên', 'job'
  ];
  if (tuyenDungKeywords.some((kw) => full.includes(kw))) {
    topics.push('tuyen_dung');
  }

  if (topics.length === 0) {
    topics.push('hoc_vu');
  }

  return topics;
}

module.exports = {
  DEFAULT_COURSES,
  SOURCE_BASE_WEIGHTS,
  SCOPE_WEIGHTS,
  PRIORITY_RULES,
  URGENCY_TIME_KEYWORDS,
  detectCourseTag,
  detectScopeType,
  detectNotificationTopics,
  classifyNotification,
  classifySmartNotification,
  extractDeadline,
  extractRescheduleDetails,
};
