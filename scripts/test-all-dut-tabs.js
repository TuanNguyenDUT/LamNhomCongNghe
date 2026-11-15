const https = require('node:https');

const DUT_TABS = [
  { index: 0, code: 'DUT_GENERAL', name: 'Thông báo chung', eParam: 'CTRTBSV' },
  { index: 1, code: 'DUT_TRAINING', name: 'Phòng Đào tạo', eParam: 'CTRTBSV' },
  { index: 2, code: 'DUT_COURSE_CLASS', name: 'Lớp học phần (Giảng viên)', eParam: 'CTRTBGV' },
  { index: 3, code: 'DUT_STUDENT_AFFAIRS', name: 'Phòng Công tác Sinh viên', eParam: 'CTRTBSV' },
  { index: 4, code: 'DUT_TESTING_QA', name: 'Phòng Khảo thí & ĐBCL', eParam: 'CTRTBSV' },
  { index: 5, code: 'DUT_TUITION_FEE', name: 'Học phí & Kế hoạch Tài chính', eParam: 'CTRTBSV' },
  { index: 6, code: 'DUT_REGULATIONS', name: 'Quy chế & Quy định', eParam: 'CTRTBSV' }
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

function fetchTabHtml(tabIndex, eParam, page = 1) {
  return new Promise((resolve, reject) => {
    const path = `/WebAjax/evLopHP_Load.aspx?E=${eParam}&PAGETB=${page}&COL=1&NAME=&TAB=${tabIndex}`;
    const options = {
      hostname: 'sv.dut.udn.vn',
      path,
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://sv.dut.udn.vn/',
        'Content-Length': 0,
        'X-Requested-With': 'XMLHttpRequest'
      },
      timeout: 10000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve(data));
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout tab ' + tabIndex)); });
    req.end();
  });
}

function parseBox(boxHtml, tabConfig, cutoffDate) {
  // Regex bóc tách Caption và Content
  // Ví dụ: <div class='tbBoxCaption'><b><span ...>13/11/2026:</b></span>&nbsp; <span>TITLE</span></div><div class='tbBoxContent'>...</div>
  const dateMatch = boxHtml.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!dateMatch) return null;

  const day = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const year = parseInt(dateMatch[3], 10);
  const noticeDate = new Date(Date.UTC(year, month - 1, day, 8, 0, 0));

  // Kiểm tra giới hạn 2 tháng (cutoffDate)
  const isOlderThan2Months = noticeDate < cutoffDate;

  // Lấy Caption
  const captionMatch = boxHtml.match(/<div class=['"]tbBoxCaption['"]>([\s\S]*?)<\/div>/i);
  let title = '';
  if (captionMatch) {
    // Xóa thẻ span chứa ngày
    let capContent = captionMatch[1].replace(/<b>[\s\S]*?<\/b>/gi, '').replace(/<span[^>]*>\d{2}\/\d{2}\/\d{4}:?<\/span>/gi, '');
    title = decodeHtmlEntities(capContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  }

  // Lấy Content
  const contentMatch = boxHtml.match(/<div class=['"]tbBoxContent['"]>([\s\S]*?)<\/div>/i);
  let content = '';
  const attachments = [];

  if (contentMatch) {
    const rawContent = contentMatch[1];
    // Tìm các link đính kèm
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
    source_url: `https://sv.dut.udn.vn/#tabs_PubTB-divT${tabConfig.index}`,
    published_at: noticeDate.toISOString(),
    attachments,
    is_older: isOlderThan2Months,
    notice_date: noticeDate
  };
}

async function testAllTabs() {
  const monthsLimit = 2;
  const now = new Date();
  const cutoffDate = new Date(now.getTime() - monthsLimit * 30 * 24 * 60 * 60 * 1000);
  console.log(`Current time: ${now.toISOString()}`);
  console.log(`Cutoff date (2 months ago): ${cutoffDate.toISOString()}\n`);

  let totalValid = 0;
  let totalSkippedOld = 0;

  for (const tab of DUT_TABS) {
    console.log(`--- Fetching ${tab.code} (${tab.name}) ---`);
    try {
      const html = await fetchTabHtml(tab.index, tab.eParam, 1);
      const boxes = html.split("<div class='tbBox'>");
      console.log(`Total boxes in HTML: ${boxes.length - 1}`);

      let tabValid = 0;
      let tabOld = 0;

      for (let i = 1; i < boxes.length; i++) {
        const parsed = parseBox(boxes[i], tab, cutoffDate);
        if (!parsed) continue;

        if (parsed.is_older) {
          tabOld++;
          totalSkippedOld++;
        } else {
          tabValid++;
          totalValid++;
          if (tabValid <= 2) {
            console.log(`  [OK] ${parsed.published_at.slice(0, 10)} | ${parsed.title.slice(0, 60)}...`);
            if (parsed.attachments.length > 0) {
              console.log(`       Attachments: ${JSON.stringify(parsed.attachments)}`);
            }
          }
        }
      }
      console.log(`  -> Valid (within 2 months): ${tabValid}, Older (skipped): ${tabOld}\n`);
    } catch (e) {
      console.error(`  -> Lỗi: ${e.message}\n`);
    }
  }

  console.log(`=================================================`);
  console.log(`SUMMARY: Total within 2 months: ${totalValid}, Skipped old: ${totalSkippedOld}`);
}

testAllTabs();
