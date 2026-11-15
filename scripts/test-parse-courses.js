const https = require('node:https');
const querystring = require('node:querystring');

function getPage(url, cookieHeader = '') {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://sv.dut.udn.vn/PageCaNhan.aspx',
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        html: data,
      }));
    }).on('error', reject);
  });
}

function postPage(url, postData, cookieHeader = '') {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://sv.dut.udn.vn/PageDangNhap.aspx',
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        html: data,
      }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

function decodeHtmlEntities(str = '') {
  return str
    .replace(/&#224;/g, 'à')
    .replace(/&#225;/g, 'á')
    .replace(/&#226;/g, 'â')
    .replace(/&#227;/g, 'ã')
    .replace(/&#232;/g, 'è')
    .replace(/&#233;/g, 'é')
    .replace(/&#234;/g, 'ê')
    .replace(/&#236;/g, 'ì')
    .replace(/&#237;/g, 'í')
    .replace(/&#242;/g, 'ò')
    .replace(/&#243;/g, 'ó')
    .replace(/&#244;/g, 'ô')
    .replace(/&#245;/g, 'õ')
    .replace(/&#249;/g, 'ù')
    .replace(/&#250;/g, 'ú')
    .replace(/&#253;/g, 'ý')
    .replace(/&#273;/g, 'đ')
    .replace(/&#272;/g, 'Đ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

async function parseAllCourses() {
  const acc = '102230026';
  const pass = 'matkhau';

  const loginPageRes = await getPage('https://sv.dut.udn.vn/PageDangNhap.aspx');
  const cookieHeader = (loginPageRes.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');

  const vsMatch = loginPageRes.html.match(/id="__VIEWSTATE"\s+value="([^"]+)"/);
  const vsgMatch = loginPageRes.html.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/);

  const postData = querystring.stringify({
    '__VIEWSTATE': vsMatch ? vsMatch[1] : '',
    '__VIEWSTATEGENERATOR': vsgMatch ? vsgMatch[1] : '',
    '_ctl0:MainContent:DN_txtAcc': acc,
    '_ctl0:MainContent:DN_txtPass': pass,
    '_ctl0:MainContent:QLTH_btnLogin': 'Đăng nhập',
  });

  await postPage('https://sv.dut.udn.vn/PageDangNhap.aspx', postData, cookieHeader);

  // Lấy thông tin sinh viên từ PageCaNhan
  const caNhanRes = await getPage('https://sv.dut.udn.vn/PageCaNhan.aspx', cookieHeader);
  // Trích xuất tên sinh viên
  let studentName = '';
  let studentClass = '';
  const hoTenMatch = caNhanRes.html.match(/<span[^>]*id="[^"]*lblHoTen[^"]*"[^>]*>(.*?)<\/span>/i)
    || caNhanRes.html.match(/Họ và tên[^<]*<\/td>[\s\S]*?<td[^>]*><b>(.*?)<\/b>/i);
  if (hoTenMatch) studentName = hoTenMatch[1].replace(/<[^>]+>/g, '').trim();

  const lopMatch = caNhanRes.html.match(/Lớp[^<]*<\/td>[\s\S]*?<td[^>]*><b>(.*?)<\/b>/i);
  if (lopMatch) studentClass = lopMatch[1].replace(/<[^>]+>/g, '').trim();

  // Lấy danh sách lớp học phần từ PageLichTH
  const lichTHRes = await getPage('https://sv.dut.udn.vn/PageLichTH.aspx', cookieHeader);

  // Tìm bảng Table 2 (bảng chứa danh sách môn học)
  const tables = [...lichTHRes.html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)];
  if (tables.length < 2) {
    console.error('Không tìm thấy bảng học phần trong PageLichTH.aspx');
    return;
  }

  const tableHtml = tables[1][1];
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

  const courses = [];

  for (let i = 1; i < rows.length; i++) {
    const rowContent = rows[i][1];
    const cells = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
      decodeHtmlEntities(c[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    );

    if (cells.length >= 7) {
      const stt = cells[0];
      const courseCode = cells[1];
      const courseName = cells[2];
      const credits = cells[3];
      const lecturer = cells[6];
      const schedule = cells[7] || '';
      const weeks = cells[8] || '';

      if (courseCode && courseCode.match(/[0-9]+/)) {
        courses.push({
          stt,
          course_code: courseCode,
          course_name: courseName,
          credits,
          lecturer_name: lecturer,
          schedule_info: schedule,
          weeks_info: weeks,
        });
      }
    }
  }

  console.log(JSON.stringify({
    success: true,
    student_code: acc,
    student_name: studentName,
    class_name: studentClass,
    total_courses: courses.length,
    courses,
  }, null, 2));
}

parseAllCourses().catch(console.error);
