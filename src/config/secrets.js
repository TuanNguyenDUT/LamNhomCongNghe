const crypto = require('node:crypto');
const { AuthenticationError, DatabaseConfigurationError } = require('../utils/errors');

function encryptionKey() {
  const key = Buffer.from(process.env.DATA_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) {
    throw new DatabaseConfigurationError('Cần cấu hình DATA_ENCRYPTION_KEY dạng base64 của 32 byte');
  }
  return key;
}

function encryptSecret(value) {
  if (!value) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join(':');
}

function decryptSecret(value) {
  if (!value) return null;
  if (!String(value).startsWith('v1:')) {
    throw new AuthenticationError('Thông tin đăng nhập cũ đã hết hiệu lực. Vui lòng đăng nhập/liên kết lại');
  }
  const [, iv, tag, ciphertext] = value.split(':');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    throw new AuthenticationError('Không thể đọc thông tin đăng nhập. Vui lòng đăng nhập/liên kết lại');
  }
}

module.exports = { encryptSecret, decryptSecret, encryptionKey };
