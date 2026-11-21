/**
 * Runtime .env loader (khong dung trong NODE_ENV=test hay khi TEST_DATABASE_URL duoc set).
 * Khong ghi de cac bien moi truong da duoc truyen tu shell / Docker.
 */

const fs = require('node:fs');
const path = require('node:path');

function loadRuntimeEnv(envFilePath = path.join(__dirname, '../../.env')) {
  if (process.env.NODE_ENV === 'test' || process.env.TEST_DATABASE_URL) {
    return;
  }
  if (!fs.existsSync(envFilePath)) {
    return;
  }
  const content = fs.readFileSync(envFilePath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

module.exports = {
  loadRuntimeEnv,
};
