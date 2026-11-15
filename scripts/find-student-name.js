const https = require('node:https');
const querystring = require('node:querystring');

function getWithAgent(url, cookie = '') {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        html: data,
        cookies: res.headers['set-cookie'] || [],
      }));
    }).on('error', reject);
  });
}

function postWithAgent(url, postData, cookie = '') {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://sv.dut.udn.vn/PageDangNhap.aspx',
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: res.headers,
        html: data,
        cookies: res.headers['set-cookie'] || [],
      }));
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function findStudentName() {
  const loginPage = await getWithAgent('https://sv.dut.udn.vn/PageDangNhap.aspx');
  const cookie = (loginPage.cookies || []).map(c => c.split(';')[0]).join('; ');
  const vs = loginPage.html.match(/id="__VIEWSTATE"\s+value="([^"]+)"/)[1];
  const vsg = loginPage.html.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/)[1];

  const postData = querystring.stringify({
    '__VIEWSTATE': vs,
    '__VIEWSTATEGENERATOR': vsg,
    '_ctl0:MainContent:DN_txtAcc': '102230026',
    '_ctl0:MainContent:DN_txtPass': 'matkhau',
    '_ctl0:MainContent:QLTH_btnLogin': 'Đăng nhập',
  });

  const loginRes = await postWithAgent('https://sv.dut.udn.vn/PageDangNhap.aspx', postData, cookie);
  console.log('Login status:', loginRes.status, loginRes.headers.location);

  const caNhan = await getWithAgent('https://sv.dut.udn.vn/PageCaNhan.aspx', cookie);
  
  // Tìm thẻ span id="MainContent_CN_txtHoTen" hoặc tương tự
  const matches = [...caNhan.html.matchAll(/id="([^"]+)"[^>]*value="([^"]*)"/gi)];
  console.log('Inputs with values:');
  matches.forEach(m => {
    if (m[2] && m[2].trim()) console.log(`  ${m[1]} = "${m[2]}"`);
  });

  // Tìm các thẻ span
  const spans = [...caNhan.html.matchAll(/<span[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/span>/gi)];
  console.log('\nSpans with text:');
  spans.forEach(s => {
    const text = s[2].replace(/<[^>]+>/g, '').trim();
    if (text) console.log(`  ${s[1]} = "${text}"`);
  });
}

findStudentName().catch(console.error);
