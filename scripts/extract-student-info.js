const https = require('node:https');
const querystring = require('node:querystring');
const fs = require('node:fs');

function getPage(url, cookieHeader = '') {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://sv.dut.udn.vn/PageCaNhan.aspx',
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        html: data,
        cookies: res.headers['set-cookie'] || [],
      }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout ' + url)); });
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
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://sv.dut.udn.vn/PageDangNhap.aspx',
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        html: data,
        cookies: res.headers['set-cookie'] || [],
      }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout POST ' + url)); });
    req.write(postData);
    req.end();
  });
}

async function run() {
  const loginRes = await getPage('https://sv.dut.udn.vn/PageDangNhap.aspx');
  const cookieHeader = (loginRes.cookies || []).map((c) => c.split(';')[0]).join('; ');
  const vsMatch = loginRes.html.match(/id="__VIEWSTATE"\s+value="([^"]+)"/);
  const vsgMatch = loginRes.html.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/);

  const postData = querystring.stringify({
    '__VIEWSTATE': vsMatch ? vsMatch[1] : '',
    '__VIEWSTATEGENERATOR': vsgMatch ? vsgMatch[1] : '',
    '_ctl0:MainContent:DN_txtAcc': '102230026',
    '_ctl0:MainContent:DN_txtPass': 'matkhau',
    '_ctl0:MainContent:QLTH_btnLogin': 'Đăng nhập',
  });

  await postPage('https://sv.dut.udn.vn/PageDangNhap.aspx', postData, cookieHeader);

  // 1. Tải PageCaNhan
  const caNhan = await getPage('https://sv.dut.udn.vn/PageCaNhan.aspx', cookieHeader);
  fs.writeFileSync('scripts/canhan.html', caNhan.html, 'utf8');

  // 2. Tải Default.aspx sau đăng nhập
  const home = await getPage('https://sv.dut.udn.vn/Default.aspx', cookieHeader);
  fs.writeFileSync('scripts/home.html', home.html, 'utf8');

  console.log('Done downloading. Check keywords:');
  const lines = caNhan.html.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('102230026') || line.includes('Họ và tên') || line.includes('Lớp') || line.includes('Khoa')) {
      console.log(`Line ${idx}: ${line.trim()}`);
    }
  });

  const homeLines = home.html.split('\n');
  homeLines.forEach((line, idx) => {
    if (line.includes('102230026') || line.includes('Xin chào') || line.includes('Chào') || line.includes('Thoát') || line.includes('Đăng xuất')) {
      console.log(`Home Line ${idx}: ${line.trim()}`);
    }
  });
}

run().catch(console.error);
