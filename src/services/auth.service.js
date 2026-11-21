const crypto = require('node:crypto');
const { db: defaultDb } = require('../config/db');
const { AuthenticationError } = require('../utils/errors');

const digest = (token) => crypto.createHash('sha256').update(token).digest('hex');

class AuthService {
  constructor(db = defaultDb) { this.db = db; }

  async createSession(studentId) {
    const token = crypto.randomBytes(32).toString('base64url');
    await this.db.query(
      `INSERT INTO auth_sessions (token_hash, student_id, expires_at)
       VALUES ($1, $2::uuid, NOW() + INTERVAL '7 days')`, [digest(token), studentId]
    );
    return token;
  }

  async authenticate(token) {
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) {
      throw new AuthenticationError('Vui lòng đăng nhập lại');
    }
    const { rows } = await this.db.query(
      `SELECT s.id, s.student_code, s.firebase_uid FROM auth_sessions a
       JOIN students s ON s.id = a.student_id
       WHERE a.token_hash = $1 AND a.expires_at > NOW()`, [digest(token)]
    );
    if (!rows[0]) throw new AuthenticationError('Phiên đã hết hạn. Vui lòng đăng nhập lại');
    return rows[0];
  }

  async revoke(token) {
    if (token) await this.db.query('DELETE FROM auth_sessions WHERE token_hash = $1', [digest(token)]);
  }

  async createOAuthState(studentId) {
    const state = crypto.randomBytes(32).toString('base64url');
    await this.db.query(
      `INSERT INTO oauth_states (state_hash, student_id, expires_at)
       VALUES ($1, $2::uuid, NOW() + INTERVAL '10 minutes')`, [digest(state), studentId]
    );
    return state;
  }

  async consumeOAuthState(state) {
    if (!state) throw new AuthenticationError('Thiếu state xác thực Google');
    const { rows } = await this.db.query(
      `DELETE FROM oauth_states WHERE state_hash = $1 AND expires_at > NOW()
       RETURNING student_id`, [digest(String(state))]
    );
    if (!rows[0]) throw new AuthenticationError('Phiên liên kết Google không hợp lệ hoặc đã hết hạn');
    return rows[0].student_id;
  }
}

module.exports = { AuthService };
