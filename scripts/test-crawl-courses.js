const https = require('node:https');
const querystring = require('node:querystring');

function getPage(url, cookieHeader = '') {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://sv.dut.udn.vn/',
      },
    }, (res) => {
      let data = '';
      const newCookies = res.headers['set-cookie'] || [];
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        html: data,
        cookies: newCookies,
      }));
    }).on('error', reject);
  });
}

function postPage(url, postData, cookieHeader = '', referer = '') {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer || url,
      },
    }, (res) => {
      let data = '';
      const newCookies = res.headers['set-cookie'] || [];
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        html: data,
        cookies: newCookies,
      }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  const acc = '102230026';
  const pass = 'matkhau';

  console.log(`[1] Đang tải trang đăng nhập sv.dut.udn.vn...`);
  const loginPageRes = await getPage('https://sv.dut.udn.vn/PageDangNhap.aspx');
  const initialCookie = (loginPageRes.headers['set-cookie'] || []).map((c) => c.split(';')[0]).join('; ');

  const vsMatch = loginPageRes.html.match(/id="__VIEWSTATE"\s+value="([^"]+)"/);
  const vsgMatch = loginPageRes.html.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/);

  const viewstate = vsMatch ? vsMatch[1] : '';
  const viewstateGenerator = vsgMatch ? vsgMatch[1] : '';

  const postData = querystring.stringify({
    '__VIEWSTATE': viewstate,
    '__VIEWSTATEGENERATOR': viewstateGenerator,
    '_ctl0:MainContent:DN_txtAcc': acc,
    '_ctl0:MainContent:DN_txtPass': pass,
    '_ctl0:MainContent:QLTH_btnLogin': 'Đăng nhập',
  });

  console.log(`[2] Gửi POST đăng nhập...`);
  const loginRes = await postPage('https://sv.dut.udn.vn/PageDangNhap.aspx', postData, initialCookie, 'https://sv.dut.udn.vn/PageDangNhap.aspx');
  console.log(`Status đăng nhập:`, loginRes.statusCode, loginRes.headers.location);

  const cookieHeader = initialCookie;

  console.log(`[3] Tải trang PageCaNhan.aspx...`);
  const caNhanRes = await getPage('https://sv.dut.udn.vn/PageCaNhan.aspx', cookieHeader);
  console.log(`PageCaNhan status:`, caNhanRes.statusCode, `HTML length:`, caNhanRes.html.length);

  // Tìm thông tin sinh viên
  const studentInfoMatch = caNhanRes.html.match(/<span[^>]*id="[^"]*(lbl|HoTen|MSSV|Lop|Nganh|Khoa)[^"]*"[^>]*>(.*?)<\/span>/gi);
  if (studentInfoMatch) {
    console.log(`Thông tin sinh viên:`);
    studentInfoMatch.forEach((m) => console.log('  ', m.replace(/<[^>]+>/g, '').trim()));
  }

  // Tìm tất cả các link trên PageCaNhan.aspx
  const links = [...caNhanRes.html.matchAll(/<a[^>]+href=['"]([^'"]+)['"][^>]*>([\s\S]*?)<\/a>/gi)];
  console.log(`\nCác liên kết chức năng tìm thấy trên menu/trang cá nhân:`);
  const relevantLinks = [];
  links.forEach(([_, href, text]) => {
    const cleanText = text.replace(/<[^>]+>/g, '').trim();
    if (href.includes('.aspx') && !href.startsWith('http') && cleanText) {
      console.log(`  - [${cleanText}] -> ${href}`);
      relevantLinks.push({ text: cleanText, href });
    }
  });

  // Thử các trang thường chứa thời khóa biểu / danh sách lớp học phần
  const candidatePages = [
    'PageLichHoc.aspx',
    'PageDSHocPhan.aspx',
    'PageTKB.aspx',
    'G_LopHocPhan.aspx',
    'PageInLichHoc.aspx',
    'PageBangDiem.aspx',
  ];

  for (const page of candidatePages) {
    try {
      const pageRes = await getPage(`https://sv.dut.udn.vn/${page}`, cookieHeader);
      console.log(`\nKiểm tra trang ${page}: status ${pageRes.statusCode}, length: ${pageRes.html.length}`);
      // Kiểm tra có bảng table môn học không
      const tables = pageRes.html.match(/<table[\s\S]*?<\/table>/gi);
      if (tables) {
        console.log(`  -> Tìm thấy ${tables.length} bảng dữ liệu trong ${page}!`);
      }
      // Tìm từ khóa môn học, mã học phần, giảng viên, thứ, tiết
      const foundKeywords = pageRes.html.match(/học phần|mã lớp|tên lớp|giảng viên|thời khóa biểu|số tín chỉ|phòng học/gi);
      if (foundKeywords) {
        console.log(`  -> Từ khóa tìm thấy:`, [...new Set(foundKeywords)]);
      }
    } catch (e) {
      console.log(`  Lỗi trang ${page}:`, e.message);
    }
  }
}

run().catch(console.error);
