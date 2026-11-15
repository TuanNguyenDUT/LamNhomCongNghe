const fs = require('fs');
const html = fs.readFileSync('scripts/home.html', 'utf8');

console.log('--- SCRIPT TAGS ---');
const scripts = html.match(/<script[\s\S]*?<\/script>/gi) || [];
scripts.forEach((s, idx) => {
  if (s.includes('tabs') || s.includes('divPSTB') || s.includes('ajax') || s.includes('PostBack') || s.includes('load')) {
    console.log(`Script ${idx}:`, s.slice(0, 500));
    console.log('...\n');
  }
});

// Also search for any JS occurrences of divPSTBList
const lines = html.split('\n');
lines.forEach((l, idx) => {
  if (l.includes('divPSTBList') || l.includes('tabs_PubTB')) {
    console.log(`Line ${idx + 1}:`, l.trim());
  }
});
