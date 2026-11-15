const fs = require('fs');
const html = fs.readFileSync('scripts/home.html', 'utf8');
const fb = html.match(/https?:\/\/[^\s"']*facebook[^\s"']*/gi);
console.log('FB in home.html:', fb);
