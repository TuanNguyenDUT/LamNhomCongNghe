const https = require('node:https');

function testFetchFb(url) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      timeout: 6000
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, headers: res.headers, length: data.length, snippet: data.slice(0, 300) });
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'Timeout' }); });
  });
}

async function run() {
  console.log('Testing Facebook fetch:');
  const res1 = await testFetchFb('https://www.facebook.com/ctsvdhbkdhdn');
  console.log('FB 1:', res1);
  const res2 = await testFetchFb('https://m.facebook.com/ctsvdhbkdhdn');
  console.log('FB 2 (mobile):', res2);
}

run();
