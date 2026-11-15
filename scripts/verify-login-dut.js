const https = require('node:https');
const querystring = require('node:querystring');

function getWithAgent(url, cookie = '') {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'Cookie': cookie,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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

async function verifyDutLogin(acc, pass) {
  try {
    const loginPage = await getWithAgent('https://sv.dut.udn.vn/PageDangNhap.aspx');
    const cookie = (loginPage.cookies || []).map(c => c.split(';')[0]).join('; ');
    const vs = loginPage.html.match(/id="__VIEWSTATE"\s+value="([^"]+)"/)[1];
    const vsg = loginPage.html.match(/id="__VIEWSTATEGENERATOR"\s+value="([^"]+)"/)[1];

    const postData = querystring.stringify({
      '__VIEWSTATE': vs,
      '__VIEWSTATEGENERATOR': vsg,
      '_ctl0:MainContent:DN_txtAcc': acc,
      '_ctl0:MainContent:DN_txtPass': pass,
      '_ctl0:MainContent:QLTH_btnLogin': 'Đăng nhập',
    });

    const loginRes = await postWithAgent('https://sv.dut.udn.vn/PageDangNhap.aspx', postData, cookie);

    // Kiểm tra đăng nhập thành công: Server trường redirect (302) tới PageCaNhan.aspx
    const isSuccess = loginRes.status === 302 && (loginRes.headers.location || '').includes('PageCaNhan');
    
    // Tìm thông báo lỗi nếu có
    let errorMessage = null;
    const alertMatch = loginRes.html.match(/alert\((['"])(.*?)\1\)/);
    if (alertMatch) errorMessage = alertMatch[2];
    const spanError = loginRes.html.match(/<span[^>]*id="[^"]*lblError[^"]*"[^>]*>(.*?)<\/span>/i);
    if (spanError) errorMessage = spanError[1].replace(/<[^>]+>/g, '').trim();

    return {
      success: isSuccess,
      status: loginRes.status,
      location: loginRes.headers.location,
      errorMessage: errorMessage || (!isSuccess ? 'Tên đăng nhập hoặc mật khẩu không đúng' : null),
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
    };
  }
}

async function main() {
  console.log('--- TEST 1: Tài khoản đúng (102230026 / matkhau) ---');
  const res1 = await verifyDutLogin('102230026', 'matkhau');
  console.log(res1);

  console.log('\n--- TEST 2: Mật khẩu sai (102230026 / sai_pass_xyz) ---');
  const res2 = await verifyDutLogin('102230026', 'sai_pass_xyz');
  console.log(res2);

  console.log('\n--- TEST 3: Tài khoản bừa (999999999 / linh_tinh) ---');
  const res3 = await verifyDutLogin('999999999', 'linh_tinh');
  console.log(res3);
}

main();
