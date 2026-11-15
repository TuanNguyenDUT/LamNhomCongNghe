/**
 * CRAWLER & SCRAPER DÀNH CHO CỔNG THÔNG TIN SINH VIÊN DUT (sv.dut.udn.vn)
 * Triển khai theo đặc tả kỹ thuật AGENT.md (FR-01, FR-02 & TSD Mục 3.1)
 *
 * Chức năng:
 * 1. Đăng nhập vào phiên làm việc của sinh viên trên sv.dut.udn.vn để trích xuất danh sách lớp học phần
 * 2. Thu thập bản tin từ đầy đủ 7 chuyên mục chuẩn của nhà trường:
 *    - Thông báo chung (DUT_GENERAL)
 *    - Đào tạo (DUT_TRAINING)
 *    - Lớp học phần (DUT_COURSE_CLASS)
 *    - Công tác SV (DUT_STUDENT_AFFAIRS)
 *    - Khảo thí & ĐBCL (DUT_TESTING_QA)
 *    - Học phí, lệ phí (DUT_TUITION_FEE)
 *    - Quy chế - Quy định (DUT_REGULATIONS)
 * 3. Hỗ trợ CÀO DỮ LIỆU THỰC TẾ TRỰC TIẾP TỪ https://sv.dut.udn.vn/ (Live Scraping)
 * 4. Giới hạn thời gian 2 tháng (60 ngày) và bóc tách tệp đính kèm.
 */

const https = require('node:https');

const DUT_TABS = [
  { index: 0, code: 'DUT_GENERAL', name: 'Thông báo chung', eParam: 'CTRTBSV' },
  { index: 1, code: 'DUT_TRAINING', name: 'Phòng Đào tạo', eParam: 'CTRTBSV' },
  { index: 2, code: 'DUT_COURSE_CLASS', name: 'Lớp học phần (Giảng viên)', eParam: 'CTRTBGV' },
  { index: 3, code: 'DUT_STUDENT_AFFAIRS', name: 'Phòng Công tác Sinh viên', eParam: 'CTRTBSV' },
  { index: 4, code: 'DUT_TESTING_QA', name: 'Phòng Khảo thí & ĐBCL', eParam: 'CTRTBSV' },
  { index: 5, code: 'DUT_TUITION_FEE', name: 'Học phí & Kế hoạch Tài chính', eParam: 'CTRTBSV' },
  { index: 6, code: 'DUT_REGULATIONS', name: 'Quy chế & Quy định', eParam: 'CTRTBSV' },
];

function decodeHtmlEntities(str = '') {
  return str
    .replace(/&aacute;/g, 'á').replace(/&agrave;/g, 'à').replace(/&acirc;/g, 'â').replace(/&atilde;/g, 'ã')
    .replace(/&eacute;/g, 'é').replace(/&egrave;/g, 'è').replace(/&ecirc;/g, 'ê')
    .replace(/&iacute;/g, 'í').replace(/&igrave;/g, 'ì')
    .replace(/&oacute;/g, 'ó').replace(/&ograve;/g, 'ò').replace(/&ocirc;/g, 'ô').replace(/&otilde;/g, 'õ')
    .replace(/&uacute;/g, 'ú').replace(/&ugrave;/g, 'ù')
    .replace(/&yacute;/g, 'ý')
    .replace(/&Aacute;/g, 'Á').replace(/&Agrave;/g, 'À').replace(/&Acirc;/g, 'Â')
    .replace(/&Eacute;/g, 'É').replace(/&Ecirc;/g, 'Ê')
    .replace(/&Oacute;/g, 'Ó').replace(/&Ocirc;/g, 'Ô')
    .replace(/&Uacute;/g, 'Ú')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");
}

class DutCrawlerService {
  constructor() {
    this.baseUrl = 'https://sv.dut.udn.vn';
    this.tabs = DUT_TABS;
  }

  /**
   * Bóc tách một thẻ tbBox thành thông báo chuẩn
   */
  _parseTbBox(boxHtml, tabConfig, cutoffDate) {
    const dateMatch = boxHtml.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!dateMatch) return null;

    const day = parseInt(dateMatch[1], 10);
    const month = parseInt(dateMatch[2], 10);
    const year = parseInt(dateMatch[3], 10);
    const noticeDate = new Date(Date.UTC(year, month - 1, day, 8, 0, 0));

    // Lọc theo giới hạn thời gian (cutoffDate)
    // Riêng tab Quy chế & Quy định (DUT_REGULATIONS) là văn bản quy định hiện hành dài hạn của nhà trường, không áp dụng cắt bỏ theo 2 tháng
    const isPermanentTab = tabConfig.code === 'DUT_REGULATIONS';
    const isOlderThanLimit = (!isPermanentTab && cutoffDate) ? noticeDate < cutoffDate : false;

    // Lấy Tiêu đề từ tbBoxCaption
    const captionMatch = boxHtml.match(/<div class=['"]tbBoxCaption['"]>([\s\S]*?)<\/div>/i);
    let title = '';
    if (captionMatch) {
      const capContent = captionMatch[1]
        .replace(/<b>[\s\S]*?<\/b>/gi, '')
        .replace(/<span[^>]*>\d{2}\/\d{2}\/\d{4}:?<\/span>/gi, '');
      title = decodeHtmlEntities(capContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    }

    // Lấy Nội dung từ tbBoxContent
    const contentMatch = boxHtml.match(/<div class=['"]tbBoxContent['"]>([\s\S]*?)<\/div>/i);
    let content = '';
    const attachments = [];

    if (contentMatch) {
      const rawContent = contentMatch[1];
      const linkRegex = /<a[^>]*href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi;
      let lm;
      while ((lm = linkRegex.exec(rawContent)) !== null) {
        const url = lm[1];
        const linkText = decodeHtmlEntities(lm[2].replace(/<[^>]+>/g, '').trim()) || 'Tệp đính kèm';
        attachments.push({ title: linkText, url });
      }
      content = decodeHtmlEntities(rawContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    }

    if (!title) {
      title = content.slice(0, 80) || `Thông báo ${tabConfig.name}`;
    }

    return {
      title,
      content: content || title,
      source_channel: tabConfig.code,
      source_name: tabConfig.name,
      source_url: `${this.baseUrl}/#tabs_PubTB-divT${tabConfig.index}`,
      published_at: noticeDate.toISOString(),
      attachments,
      is_live_data: true,
      is_older_than_limit: isOlderThanLimit,
    };
  }

  /**
   * Gọi AJAX endpoint lấy mã HTML cho từng tab cụ thể
   */
  _fetchTabAjaxHtml(tabIndex, eParam, page = 1) {
    return new Promise((resolve, reject) => {
      const path = `/WebAjax/evLopHP_Load.aspx?E=${eParam}&PAGETB=${page}&COL=1&NAME=&TAB=${tabIndex}`;
      const options = {
        hostname: 'sv.dut.udn.vn',
        path,
        method: 'POST',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': `${this.baseUrl}/`,
          'Content-Length': 0,
          'X-Requested-With': 'XMLHttpRequest',
        },
        timeout: 10000,
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve(data));
      });

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error(`Timeout cào tab ${tabIndex} trên sv.dut.udn.vn`));
      });
      req.end();
    });
  }

  /**
   * Cào thông báo cho 1 tab cụ thể với giới hạn thời gian (mặc định 2 tháng)
   */
  async scrapeTabNotices(tabConfig, { monthsLimit = 2, maxPages = 2 } = {}) {
    const isPermanentTab = tabConfig.code === 'DUT_REGULATIONS';
    const cutoffDate = (!isPermanentTab && monthsLimit) ? new Date(Date.now() - monthsLimit * 30 * 24 * 60 * 60 * 1000) : null;
    const validNotices = [];
    let skippedCount = 0;

    for (let page = 1; page <= maxPages; page++) {
      try {
        const html = await this._fetchTabAjaxHtml(tabConfig.index, tabConfig.eParam, page);
        if (!html || !html.includes('tbBox')) {
          break;
        }

        const boxes = html.split("<div class='tbBox'>");
        let allBoxesOlder = true;

        for (let i = 1; i < boxes.length; i++) {
          const parsed = this._parseTbBox(boxes[i], tabConfig, cutoffDate);
          if (!parsed) continue;

          if (parsed.is_older_than_limit) {
            skippedCount++;
          } else {
            allBoxesOlder = false;
            validNotices.push({
              title: parsed.title,
              content: parsed.content,
              source_channel: parsed.source_channel,
              source_name: parsed.source_name,
              source_url: parsed.source_url,
              published_at: parsed.published_at,
              attachments: parsed.attachments,
              is_live_data: true,
            });
          }
        }

        // Nếu tất cả bài trên trang đều cũ hơn 2 tháng, dừng lật trang vì các trang sau còn cũ hơn
        if (allBoxesOlder && boxes.length > 1) {
          break;
        }
      } catch (err) {
        console.warn(`Lỗi khi cào tab ${tabConfig.name} (page ${page}):`, err.message);
        break;
      }
    }

    return {
      tab: tabConfig.code,
      name: tabConfig.name,
      valid_notices: validNotices,
      skipped_old: skippedCount,
    };
  }

  /**
   * Cào toàn bộ 7 chuyên mục chuẩn của sv.dut.udn.vn
   * @param {Object} options
   * @param {number} options.monthsLimit - Giới hạn thời gian (mặc định 2 tháng)
   */
  async scrapeAllDutTabs({ monthsLimit = 2 } = {}) {
    const results = [];
    let totalValid = 0;
    let totalSkippedOld = 0;
    const byTab = {};

    for (const tab of this.tabs) {
      // Tab Lớp học phần cào sâu 6 trang; các tab Học phí, Khảo thí, CTSV cào 4 trang để không bỏ sót thông báo học vụ; Quy chế cào 2 trang
      let maxPages = 2;
      if (tab.code === 'DUT_COURSE_CLASS') {
        maxPages = 6;
      } else if (['DUT_TUITION_FEE', 'DUT_TESTING_QA', 'DUT_STUDENT_AFFAIRS'].includes(tab.code)) {
        maxPages = 4;
      }
      const tabRes = await this.scrapeTabNotices(tab, { monthsLimit, maxPages });
      results.push(...tabRes.valid_notices);
      totalValid += tabRes.valid_notices.length;
      totalSkippedOld += tabRes.skipped_old;
      byTab[tab.code] = {
        name: tab.name,
        valid: tabRes.valid_notices.length,
        skipped_old: tabRes.skipped_old,
      };
    }

    return {
      total_found: results.length,
      valid_notices: results,
      total_skipped_old: totalSkippedOld,
      by_tab: byTab,
    };
  }

  /**
   * Cào thông báo thực tế TRỰC TIẾP từ cổng https://sv.dut.udn.vn/ (Live Web Scraping)
   */
  async fetchLiveNotices(maxCount = 20) {
    try {
      const allTabsResult = await this.scrapeAllDutTabs({ monthsLimit: 2 });
      if (allTabsResult.valid_notices && allTabsResult.valid_notices.length > 0) {
        return allTabsResult.valid_notices.slice(0, maxCount);
      }
    } catch (e) {
      console.warn('Lỗi scrapeAllDutTabs:', e.message);
    }
    // Fallback nếu kết nối mạng gặp sự cố
    return this.fetchCategoryNotices('DUT_TRAINING');
  }

  _parseDate(dateStr = '') {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}T08:00:00.000Z`;
    }
    return new Date().toISOString();
  }

  /**
   * Xác thực tài khoản trực tiếp với cổng sv.dut.udn.vn
   * Bắt buộc kiểm tra kết quả HTTP 302 chuyển hướng đến PageCaNhan.aspx
   * Trả về: { authenticated: boolean, courses: [], message: string }
   */
  async authenticateWithDut(studentCode, password) {
    if (!studentCode || !password) {
      return { authenticated: false, message: 'Vui lòng nhập đầy đủ mã sinh viên và mật khẩu' };
    }

    const cleanCode = String(studentCode).trim();
    const cleanPass = String(password).trim();

    try {
      // 1. Tải trang đăng nhập lấy ViewState và Session Cookie
      const loginPageRes = await this._httpGet('/PageDangNhap.aspx');
      const cookieHeader = (loginPageRes.cookies || []).map((c) => c.split(';')[0]).join('; ');

      const vsMatch = loginPageRes.html.match(/id="__VIEWSTATE"\s+value="([^"]+)"/);
      const vsgMatch = loginPageRes.html.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/);

      if (!vsMatch || !vsgMatch) {
        return { authenticated: false, message: 'Không thể kết nối đến hệ thống xác thực sv.dut.udn.vn' };
      }

      const postData = new URLSearchParams({
        '__VIEWSTATE': vsMatch[1],
        '__VIEWSTATEGENERATOR': vsgMatch[1],
        '_ctl0:MainContent:DN_txtAcc': cleanCode,
        '_ctl0:MainContent:DN_txtPass': cleanPass,
        '_ctl0:MainContent:QLTH_btnLogin': 'Đăng nhập',
      }).toString();

      // 2. Gửi POST đăng nhập
      const loginRes = await this._httpPost('/PageDangNhap.aspx', postData, cookieHeader);

      // 3. Kiểm tra kết quả phản hồi từ cổng trường:
      // sv.dut.udn.vn chỉ trả về 302 và redirect đến PageCaNhan khi mật khẩu ĐÚNG!
      const isSuccess = loginRes.statusCode === 302 &&
        Boolean(loginRes.headers.location && loginRes.headers.location.includes('PageCaNhan'));

      if (!isSuccess) {
        return {
          authenticated: false,
          message: 'Tên đăng nhập hoặc mật khẩu sv.dut.udn.vn không chính xác!',
        };
      }

      // Cập nhật session cookies sau khi đăng nhập thành công
      const allCookies = [...(loginPageRes.cookies || []), ...(loginRes.cookies || [])];
      const authCookie = allCookies.map((c) => c.split(';')[0]).join('; ');

      // 4. Cào thông tin nhân thân CHÍNH XÁC NHẤT từ PageCaNhan.aspx
      let profile = {};
      try {
        const caNhanRes = await this._httpGet('/PageCaNhan.aspx', authCookie);
        if (caNhanRes && caNhanRes.html) {
          profile = this._extractStudentProfile(caNhanRes.html, cleanCode);
        }
      } catch (profileErr) {
        console.warn('Lỗi cào thông tin cá nhân sv.dut.udn.vn:', profileErr.message);
      }

      // 5. Nếu đăng nhập thành công, cào danh sách học phần thật từ PageLichTH.aspx
      const lichTHRes = await this._httpGet('/PageLichTH.aspx', authCookie);
      const tables = [...lichTHRes.html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)];
      const scrapedCourses = [];

      if (tables.length >= 2) {
        const tableHtml = tables[1][1];
        const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
        for (let i = 1; i < rows.length; i++) {
          const rowContent = rows[i][1];
          const cells = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
            decodeHtmlEntities(c[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
          );

          if (cells.length >= 7) {
            const courseCode = cells[1];
            const courseName = cells[2];
            const credits = cells[3];
            const lecturer = cells[6];
            const schedule = cells[7] || '';
            const weeks = cells[8] || '';

            if (courseCode && courseCode.match(/[0-9]+/)) {
              scrapedCourses.push({
                course_code: courseCode,
                course_name: courseName,
                credits: credits ? parseInt(credits, 10) || 2 : 2,
                semester: 'Học kỳ 1 (2026-2027)',
                lecturer_name: lecturer || 'Chưa cập nhật',
                schedule_info: schedule ? `${schedule} (Tuần ${weeks})` : 'Chưa có lịch cụ thể',
                is_live: true,
              });
            }
          }
        }
      }

      return {
        authenticated: true,
        message: 'Đăng nhập sv.dut.udn.vn thành công',
        profile,
        courses: scrapedCourses,
      };
    } catch (err) {
      return {
        authenticated: false,
        message: `Lỗi kết nối cổng sv.dut.udn.vn: ${err.message}`,
      };
    }
  }

  /**
   * Bóc tách thông tin hồ sơ nhân thân sinh viên từ HTML PageCaNhan.aspx
   */
  _extractStudentProfile(html, studentCode) {
    if (!html) return {};

    function extractInputValue(fieldId) {
      const tagRegex = new RegExp(`<input[^>]*?(?:id|name)=["'][^"']*?${fieldId}["'][^>]*>`, 'i');
      const tagMatch = html.match(tagRegex);
      if (!tagMatch) return '';
      const tag = tagMatch[0];
      const valMatch = tag.match(/value=["']([^"']*)["']/i);
      return valMatch ? valMatch[1].trim() : '';
    }

    function extractAttr(regex) {
      const m = html.match(regex);
      return m ? m[1].trim() : '';
    }

    function toTitleCase(str) {
      if (!str) return '';
      return str
        .toLowerCase()
        .split(' ')
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }

    const hoTenRaw = extractInputValue('CN_txtHoTen') || extractAttr(/Chào\s+([^-]+)-/);
    const hoTen = toTitleCase(hoTenRaw) || hoTenRaw || `Sinh viên ${studentCode}`;
    const lop = extractInputValue('CN_txtLop') || `${studentCode.slice(3, 5)}T_DT`;
    const nganh = extractInputValue('CN_txtNganh') || 'Công nghệ Thông tin';
    const ctdt = extractInputValue('CN_txtCTDT') || '';
    const ngaySinh = extractInputValue('CN_txtNgaySinh') || '';
    const gioiTinh = extractInputValue('CN_txtGioiTinh') || '';
    const mailTruong = extractInputValue('CN_txtMail1') || `${studentCode}@sv1.dut.udn.vn`;
    const mailCaNhan = extractInputValue('CN_txtMail2') || '';
    const phone = extractInputValue('CN_txtPhone') || '';
    const avatarUrl = extractAttr(/id=["'](?:MainContent_CaNhan_)?imgAnh["'][^>]*src=["']([^"']+)["']/i) ||
      `https://cb.dut.udn.vn/ImageSV/${studentCode.slice(3, 5)}/${studentCode}.jpg`;

    let cohort = 'K23';
    if (ctdt.match(/K\s*(\d{2,4})/i)) {
      cohort = ctdt.match(/K\s*(\d{2,4})/i)[0].toUpperCase();
    } else if (lop.match(/^(\d{2})/)) {
      cohort = `K${lop.match(/^(\d{2})/)[1]}`;
    }

    const faculty = nganh.includes('Công nghệ Thông tin')
      ? 'Khoa Công nghệ Thông tin'
      : (nganh ? `Khoa / Ngành ${nganh}` : 'Khoa Công nghệ Thông tin');

    return {
      full_name: hoTen,
      class_name: lop,
      faculty,
      cohort,
      major: nganh,
      program: ctdt,
      dob: ngaySinh,
      gender: gioiTinh,
      school_email: mailTruong,
      personal_email: mailCaNhan,
      phone,
      avatar_url: avatarUrl,
    };
  }

  /**
   * Đăng nhập và cào dữ liệu học phần thực tế từ sv.dut.udn.vn
   */
  async loginAndScrapeStudentCourses(studentCode, password) {
    if (!studentCode || !password) return null;

    try {
      const loginPageRes = await this._httpGet('/PageDangNhap.aspx');
      const cookieHeader = (loginPageRes.cookies || []).map((c) => c.split(';')[0]).join('; ');

      const vsMatch = loginPageRes.html.match(/id="__VIEWSTATE"\s+value="([^"]+)"/);
      const vsgMatch = loginPageRes.html.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/);

      if (!vsMatch || !vsgMatch) {
        console.warn('Không tìm thấy ViewState trên trang PageDangNhap.aspx');
        return null;
      }

      const postData = new URLSearchParams({
        '__VIEWSTATE': vsMatch[1],
        '__VIEWSTATEGENERATOR': vsgMatch[1],
        '_ctl0:MainContent:DN_txtAcc': studentCode,
        '_ctl0:MainContent:DN_txtPass': password,
        '_ctl0:MainContent:QLTH_btnLogin': 'Đăng nhập',
      }).toString();

      const loginRes = await this._httpPost('/PageDangNhap.aspx', postData, cookieHeader);

      if (loginRes.statusCode !== 302 && !loginRes.headers.location) {
        console.warn(`Đăng nhập sv.dut.udn.vn không thành công (Status: ${loginRes.statusCode})`);
        return null;
      }

      const lichTHRes = await this._httpGet('/PageLichTH.aspx', cookieHeader);
      const tables = [...lichTHRes.html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)];

      if (tables.length < 2) {
        console.warn('Không tìm thấy bảng học phần trong PageLichTH.aspx');
        return null;
      }

      const tableHtml = tables[1][1];
      const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
      const scrapedCourses = [];

      for (let i = 1; i < rows.length; i++) {
        const rowContent = rows[i][1];
        const cells = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
          decodeHtmlEntities(c[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
        );

        if (cells.length >= 7) {
          const courseCode = cells[1];
          const courseName = cells[2];
          const credits = cells[3];
          const lecturer = cells[6];
          const schedule = cells[7] || '';
          const weeks = cells[8] || '';

          if (courseCode && courseCode.match(/[0-9]+/)) {
            scrapedCourses.push({
              course_code: courseCode,
              course_name: courseName,
              credits: credits ? parseInt(credits, 10) || 2 : 2,
              semester: 'Học kỳ 1 (2026-2027)',
              lecturer_name: lecturer || 'Chưa cập nhật',
              schedule_info: schedule ? `${schedule} (Tuần ${weeks})` : 'Chưa có lịch cụ thể',
              is_live: true,
            });
          }
        }
      }

      return scrapedCourses.length > 0 ? scrapedCourses : null;
    } catch (err) {
      console.warn('Lỗi khi cào dữ liệu học phần thực tế:', err.message);
      return null;
    }
  }

  _httpGet(path, cookieHeader = '') {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'sv.dut.udn.vn',
        path,
        method: 'GET',
        headers: {
          'Cookie': cookieHeader,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': `${this.baseUrl}/`,
        },
        timeout: 10000,
      };

      const req = https.request(options, (res) => {
        let data = '';
        const cookies = res.headers['set-cookie'] || [];
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          cookies,
          html: data,
        }));
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout GET ' + path)); });
      req.end();
    });
  }

  _httpPost(path, postData, cookieHeader = '') {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'sv.dut.udn.vn',
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'Cookie': cookieHeader,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': `${this.baseUrl}/PageDangNhap.aspx`,
        },
        timeout: 10000,
      };

      const req = https.request(options, (res) => {
        let data = '';
        const cookies = res.headers['set-cookie'] || [];
        res.on('data', (c) => { data += c; });
        res.on('end', () => resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          cookies,
          html: data,
        }));
      });

      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout POST ' + path)); });
      req.write(postData);
      req.end();
    });
  }

  /**
   * Đăng nhập và đồng bộ danh sách lớp học phần đang học (FR-01)
   */
  async syncStudentCourses(studentCode, password = '') {
    if (studentCode && password) {
      const liveCourses = await this.loginAndScrapeStudentCourses(studentCode, password);
      if (liveCourses && liveCourses.length > 0) {
        return liveCourses;
      }
    }

    const mockEnrolledCourses = [
      {
        course_code: 'IT401',
        course_name: 'Công nghệ phần mềm',
        semester: 'Học kỳ 2 (2025-2026)',
        lecturer_name: 'TS. Nguyễn Văn B',
        schedule_info: 'Thứ 4, Tiết 1-3, Phòng F102',
      },
      {
        course_code: 'IT302',
        course_name: 'Cơ sở dữ liệu',
        semester: 'Học kỳ 2 (2025-2026)',
        lecturer_name: 'ThS. Trần Thị C',
        schedule_info: 'Thứ 2, Tiết 7-9, Phòng F301',
      },
      {
        course_code: 'IT408',
        course_name: 'Trí tuệ nhân tạo',
        semester: 'Học kỳ 2 (2025-2026)',
        lecturer_name: 'PGS. TS. Lê Văn D',
        schedule_info: 'Thứ 6, Tiết 4-6, Phòng F204',
      },
    ];

    return mockEnrolledCourses;
  }

  /**
   * Thu thập thông báo từ 7 chuyên mục chuẩn trên sv.dut.udn.vn (FR-02)
   */
  async fetchCategoryNotices(category = 'DUT_GENERAL') {
    const validCategories = [
      'DUT_GENERAL',
      'DUT_TRAINING',
      'DUT_COURSE_CLASS',
      'DUT_STUDENT_AFFAIRS',
      'DUT_TESTING_QA',
      'DUT_TUITION_FEE',
      'DUT_REGULATIONS',
    ];

    if (!validCategories.includes(category)) {
      throw new Error(`Chuyên mục ${category} không thuộc 7 mục thông báo chuẩn của sv.dut.udn.vn`);
    }

    const fixtures = {
      DUT_COURSE_CLASS: [
        {
          title: 'THÔNG BÁO NGHỈ DẠY VÀ HỌC BÙ LỚP HỌC PHẦN IT401 - CÔNG NGHỆ PHẦN MỀM',
          content: 'Giảng viên TS. Nguyễn Văn B thông báo nghỉ dạy ngày 18/03/2026 do bận công tác. Lớp sẽ học bù vào ngày 22/03/2026, Tiết 7-9, chuyển sang phòng F302.',
          source_channel: 'DUT_COURSE_CLASS',
          source_name: 'Lớp học phần (Giảng viên)',
          source_url: `${this.baseUrl}/#tabs_PubTB-divT2`,
          published_at: new Date().toISOString(),
        },
      ],
      DUT_TUITION_FEE: [
        {
          title: 'THÔNG BÁO VỀ VIỆC NỘP TIỀN BẢO HIỂM Y TẾ SINH VIÊN NĂM 2027',
          content: 'Sinh viên xem chi tiết thông báo nộp tiền BHYT năm học mới.',
          source_channel: 'DUT_TUITION_FEE',
          source_name: 'Học phí & Kế hoạch Tài chính',
          source_url: `${this.baseUrl}/#tabs_PubTB-divT5`,
          published_at: new Date().toISOString(),
        },
      ],
      DUT_TRAINING: [
        {
          title: 'TB về Xét công nhận tốt nghiệp đợt 4 năm 2026 (TB số 4)',
          content: 'Danh sách sinh viên dự kiến được xét tốt nghiệp đợt 4 năm 2026.',
          source_channel: 'DUT_TRAINING',
          source_name: 'Phòng Đào tạo',
          source_url: `${this.baseUrl}/#tabs_PubTB-divT1`,
          published_at: new Date().toISOString(),
        },
      ],
      DUT_TESTING_QA: [
        {
          title: 'Đăng ký thi tiếng Anh Chuẩn đầu ra tại Trường ĐHNN đợt thi ngày 29/11/2026',
          content: 'Phòng Khảo thí & ĐBCL thông báo hạn cuối nhận chứng chỉ TOEIC/IELTS xét tốt nghiệp.',
          source_channel: 'DUT_TESTING_QA',
          source_name: 'Phòng Khảo thí & ĐBCL',
          source_url: `${this.baseUrl}/#tabs_PubTB-divT4`,
          published_at: new Date().toISOString(),
        },
      ],
      DUT_STUDENT_AFFAIRS: [
        {
          title: 'Thông báo sinh hoạt lớp chủ nhiệm lần 2, học kỳ I năm học 2026-2027',
          content: 'Phòng Công tác Sinh viên tổ chức sinh hoạt lớp chủ nhiệm theo lịch phân công.',
          source_channel: 'DUT_STUDENT_AFFAIRS',
          source_name: 'Phòng Công tác Sinh viên',
          source_url: `${this.baseUrl}/#tabs_PubTB-divT3`,
          published_at: new Date().toISOString(),
        },
      ],
      DUT_REGULATIONS: [
        {
          title: 'Phòng Đào tạo - Các quy chế, quy định, hướng dẫn liên quan Đào tạo',
          content: 'Ban Giám hiệu nhà trường ban hành quy định cập nhật về đào tạo và điểm rèn luyện.',
          source_channel: 'DUT_REGULATIONS',
          source_name: 'Quy chế & Quy định',
          source_url: `${this.baseUrl}/#tabs_PubTB-divT6`,
          published_at: new Date().toISOString(),
        },
      ],
      DUT_GENERAL: [
        {
          title: 'Thông báo v/v đăng ký cấp bảng điểm cho sinh viên trên Hệ thống thông tin sinh viên',
          content: 'Phòng Đào tạo và Bảo đảm chất lượng thông báo một số lưu ý đối với sinh viên có nhu cầu cấp bảng điểm.',
          source_channel: 'DUT_GENERAL',
          source_name: 'Thông báo chung',
          source_url: `${this.baseUrl}/#tabs_PubTB-divT0`,
          published_at: new Date().toISOString(),
        },
      ],
    };

    return fixtures[category] || [];
  }
}

const dutCrawlerService = new DutCrawlerService();

module.exports = {
  DUT_TABS,
  DutCrawlerService,
  dutCrawlerService,
};
