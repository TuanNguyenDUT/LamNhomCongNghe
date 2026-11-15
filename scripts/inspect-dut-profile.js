const https = require('node:https');
const fs = require('node:fs');

function httpGet(path, cookieHeader = '') {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'sv.dut.udn.vn',
        port: 443,
        path: path,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () =>
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            html: data,
            cookies: res.headers['set-cookie'] || [],
          })
        );
      }
    );
    req.on('error', reject);
    req.end();
  });
}

function httpPost(path, postData, cookieHeader = '') {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'sv.dut.udn.vn',
        port: 443,
        path: path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () =>
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            html: data,
            cookies: res.headers['set-cookie'] || [],
          })
        );
      }
    );
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function run() {
  const loginPageRes = await httpGet('/PageDangNhap.aspx');
  const cookieHeader = (loginPageRes.cookies || []).map((c) => c.split(';')[0]).join('; ');

  const vsMatch = loginPageRes.html.match(/id="__VIEWSTATE"\s+value="([^"]+)"/);
  const vsgMatch = loginPageRes.html.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/);

  const postData = new URLSearchParams({
    __VIEWSTATE: vsMatch[1],
    __VIEWSTATEGENERATOR: vsgMatch[1],
    '_ctl0:MainContent:DN_txtAcc': '102230026',
    '_ctl0:MainContent:DN_txtPass': 'matkhau',
    '_ctl0:MainContent:QLTH_btnLogin': 'Đăng nhập',
  }).toString();

  const loginRes = await httpPost('/PageDangNhap.aspx', postData, cookieHeader);
  console.log('Login Status:', loginRes.statusCode, 'Location:', loginRes.headers.location);

  const newCookies = [...(loginPageRes.cookies || []), ...(loginRes.cookies || [])];
  const authCookie = newCookies.map((c) => c.split(';')[0]).join('; ');

  // 1. Fetch PageCaNhan.aspx
  const caNhanRes = await httpGet('/PageCaNhan.aspx', authCookie);
  console.log('PageCaNhan Status:', caNhanRes.statusCode, 'HTML length:', caNhanRes.html.length);
  fs.writeFileSync('scripts/ca_nhan.html', caNhanRes.html, 'utf8');

  // Let's inspect PageCaNhan.aspx text or elements
  // Let's check for student name, class, faculty
  const lines = caNhanRes.html.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      line.includes('Họ và tên') ||
      line.includes('Lớp') ||
      line.includes('Khoa') ||
      line.includes('Khóa') ||
      line.includes('CN_txt') ||
      line.includes('lbl') ||
      line.includes('txt') ||
      line.includes('102230026')
    ) {
      console.log(`Line ${i}:`, line.trim());
    }
  }
}

run().catch(console.error);
