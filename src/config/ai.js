/**
 * Cấu hình AI API Client phục vụ phân tích, tóm tắt và bóc tách bài viết Facebook / văn bản tự do
 * Theo AGENT.md Mục II.3.2.B.
 * Hỗ trợ Google Gemini API khi có GEMINI_API_KEY, kèm Heuristic NLP Fallback khi chạy offline/test.
 */

const https = require('node:https');

class AiService {
  constructor(apiKey = process.env.GEMINI_API_KEY) {
    this.apiKey = apiKey;
  }

  /**
   * Phân tích văn bản bài viết tự do / bài viết Facebook
   * Trả về: { summary, action_required, deadline_at, scope, tags, is_emergency }
   */
  async analyzeArticle(content, title = '') {
    if (this.apiKey) {
      try {
        return await this._callGeminiApi(content, title);
      } catch (err) {
        console.warn('Gemini API call failed, falling back to heuristic summarizer:', err.message);
      }
    }
    return this._heuristicAnalysis(content, title);
  }

  /**
   * Gọi Google Gemini API bằng native node:https
   */
  async _callGeminiApi(content, title) {
    const prompt = `Bạn là hệ thống AI phân loại và tóm tắt thông báo sinh viên Đại học Bách Khoa - ĐH Đà Nẵng (DUT).
Hãy phân tích bài viết dưới đây và trả về DUY NHẤT một JSON hợp lệ (không kèm markdown code block):
{
  "summary": "Tóm tắt ngắn gọn 2-3 câu súc tích bằng tiếng Việt",
  "action_required": "Hành động sinh viên cần thực hiện hoặc null nếu chỉ là tin đọc",
  "deadline_at": "Thời hạn chót chuẩn ISO 8601 (ví dụ: 2026-03-30T17:00:00Z) hoặc null nếu không có",
  "scope": "GLOBAL" | "FACULTY" | "COHORT" | "COURSE" | "PERSONAL",
  "tags": ["hoc_bong", "cuoc_thi", "ctsv", "tu_van", ...],
  "is_emergency": true | false
}

Tiêu đề: ${title}
Nội dung: ${content}`;

    const payload = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.2,
      },
    });

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
    
    return new Promise((resolve, reject) => {
      const req = https.request(
        endpoint,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => { data += chunk; });
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) {
                const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim();
                return resolve(JSON.parse(cleaned));
              }
              reject(new Error('Phản hồi trống từ Gemini API'));
            } catch (e) {
              reject(e);
            }
          });
        }
      );
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }

  /**
   * Heuristic NLP Fallback Engine (khi chạy offline / test không cần gọi mạng)
   */
  _heuristicAnalysis(content, title = '') {
    const fullText = `${title}\n${content}`.toLowerCase();
    
    // 1. Nhận diện tính khẩn cấp
    const isEmergency = /khẩn|nghỉ học đột xuất|hoãn thi|nghỉ bão|buộc thôi học|đình chỉ/i.test(fullText);

    // 2. Nhận diện Deadline (Regex ngày tháng)
    let deadlineAt = null;
    const deadlineRegex = /(?:trước ngày|hạn chót|hạn cuối|đến hết ngày|trước 17h ngày)\s*(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/i;
    const match = fullText.match(deadlineRegex);
    if (match) {
      const day = match[1].padStart(2, '0');
      const month = match[2].padStart(2, '0');
      const year = match[3];
      deadlineAt = new Date(`${year}-${month}-${day}T17:00:00.000Z`).toISOString();
    }

    // 3. Nhận diện Tags
    const tags = [];
    if (/học bổng|scholarship/i.test(fullText)) tags.push('hoc_bong');
    if (/cuộc thi|hội thi|hackathon/i.test(fullText)) tags.push('cuoc_thi');
    if (/công tác sinh viên|ctsv|điểm rèn luyện/i.test(fullText)) tags.push('ctsv');
    if (/tư vấn|hỏi đáp|hướng dẫn/i.test(fullText)) tags.push('tu_van');
    if (/học phí|nộp tiền|ngân hàng/i.test(fullText)) tags.push('hoc_phi');
    if (/nghỉ học|học bù|đổi phòng/i.test(fullText)) tags.push('nghi_hoc');
    if (tags.length === 0) tags.push('thong_bao');

    // 4. Nhận diện Phạm vi (Scope)
    let scope = 'GLOBAL';
    if (/sinh viên lớp|toàn thể sinh viên lớp/i.test(fullText)) scope = 'COURSE';
    else if (/khoa|ngành/i.test(fullText)) scope = 'FACULTY';
    else if (/khóa 20|k20|k21|k22|k23|k24/i.test(fullText)) scope = 'COHORT';
    else if (/cá nhân|nhắc nợ|phúc khảo/i.test(fullText)) scope = 'PERSONAL';

    // 5. Sinh summary & action_required
    const sentences = content.split(/[.\n]+/).map(s => s.trim()).filter(Boolean);
    const summary = sentences.slice(0, 2).join('. ') + (sentences.length > 0 ? '.' : '');
    
    let actionRequired = null;
    if (deadlineAt) {
      actionRequired = `Hoàn thành thủ tục hoặc hồ sơ trước ngày ${new Date(deadlineAt).toLocaleDateString('vi-VN')}.`;
    } else if (/đăng ký|nộp|gửi/i.test(fullText)) {
      actionRequired = 'Kiểm tra thông tin chi tiết và tiến hành đăng ký theo hướng dẫn.';
    }

    return {
      summary: summary || title,
      action_required: actionRequired,
      deadline_at: deadlineAt,
      scope,
      tags,
      is_emergency: isEmergency,
      classified_by: 'AI_API',
    };
  }
}

const defaultAiService = new AiService();

module.exports = {
  AiService,
  aiService: defaultAiService,
};

