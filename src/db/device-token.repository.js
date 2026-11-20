/**
 * Task 6: Lưu Firebase registration target trực tiếp trong PostgreSQL.
 * Không còn cơ chế fallback bộ nhớ (fail-fast khi thiếu cấu hình/kết nối PostgreSQL).
 */

const crypto = require('node:crypto');
const { db: defaultDb, createDbAdapter } = require('../config/db');
const { DatabaseConfigurationError } = require('../utils/errors');

function hashTarget(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function publicDevice(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    student_id: row.student_id,
    target_type: row.target_type,
    platform: row.platform,
    device_id: row.device_id,
    app_version: row.app_version || null,
    is_active: Boolean(row.is_active),
    failure_count: Number(row.failure_count || 0),
    last_seen_at: row.last_seen_at instanceof Date ? row.last_seen_at.toISOString() : row.last_seen_at,
    last_error_code: row.last_error_code || null,
    created_at: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    updated_at: row.updated_at instanceof Date ? row.updated_at.toISOString() : row.updated_at,
  };
}

class DeviceTokenRepository {
  constructor(pgPool = null) {
    if (pgPool === undefined || pgPool === null) {
      this.db = defaultDb;
    } else if (typeof pgPool.query === 'function') {
      this.db = pgPool;
    } else {
      this.db = createDbAdapter(pgPool);
    }
  }

  _requireDb() {
    if (!this.db || typeof this.db.query !== 'function') {
      throw new DatabaseConfigurationError('PostgreSQL Pool is required for DeviceTokenRepository');
    }
    return this.db;
  }

  async registerDevice({ student_id, target, target_type, platform, device_id, app_version }) {
    const runner = this._requireDb();
    const targetHash = hashTarget(target);

    await runner.query(
      `UPDATE device_tokens
       SET is_active = FALSE, last_error_code = 'TOKEN_REASSIGNED', updated_at = NOW()
       WHERE target_hash = $1 AND device_id <> $2 AND is_active = TRUE`,
      [targetHash, device_id]
    );
    const { rows } = await runner.query(
      `INSERT INTO device_tokens (
         student_id, registration_target, target_hash, target_type, platform,
         device_id, app_version, is_active, failure_count, last_seen_at,
         last_error_code, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, 0, NOW(), NULL, NOW())
       ON CONFLICT (device_id) DO UPDATE SET
         student_id = EXCLUDED.student_id,
         registration_target = EXCLUDED.registration_target,
         target_hash = EXCLUDED.target_hash,
         target_type = EXCLUDED.target_type,
         platform = EXCLUDED.platform,
         app_version = EXCLUDED.app_version,
         is_active = TRUE,
         failure_count = 0,
         last_seen_at = NOW(),
         last_error_code = NULL,
         updated_at = NOW()
       RETURNING *, (xmax = 0) AS created`,
      [student_id, target, targetHash, target_type, platform, device_id, app_version || null]
    );
    return { created: Boolean(rows[0].created), device: publicDevice(rows[0]) };
  }

  async getActiveByDevice(deviceId, studentId = null) {
    const runner = this._requireDb();
    if (Array.isArray(studentId)) {
      const { rows } = await runner.query(
        `SELECT * FROM device_tokens
         WHERE device_id = $1 AND is_active = TRUE AND student_id = ANY($2::text[])
         LIMIT 1`,
        [deviceId, studentId]
      );
      return rows[0] ? { ...rows[0], id: Number(rows[0].id) } : null;
    }

    const values = [deviceId];
    const studentFilter = studentId ? 'AND student_id = $2' : '';
    if (studentId) values.push(studentId);
    const { rows } = await runner.query(
      `SELECT * FROM device_tokens
       WHERE device_id = $1 AND is_active = TRUE ${studentFilter}
       LIMIT 1`,
      values
    );
    return rows[0] ? { ...rows[0], id: Number(rows[0].id) } : null;
  }

  async getByIdForDelivery(id) {
    const runner = this._requireDb();
    const { rows } = await runner.query(
      'SELECT * FROM device_tokens WHERE id = $1 AND is_active = TRUE',
      [Number(id)]
    );
    return rows[0] ? { ...rows[0], id: Number(rows[0].id) } : null;
  }

  async listStudentDevices(studentIdentifiers, { activeOnly = true } = {}) {
    const runner = this._requireDb();
    const activeFilter = activeOnly ? 'AND is_active = TRUE' : '';
    if (Array.isArray(studentIdentifiers)) {
      const ids = studentIdentifiers.filter(Boolean).map(String);
      if (ids.length === 0) return [];
      const { rows } = await runner.query(
        `SELECT * FROM device_tokens
         WHERE student_id = ANY($1::text[]) ${activeFilter}
         ORDER BY last_seen_at DESC`,
        [ids]
      );
      return rows.map(publicDevice);
    }

    const { rows } = await runner.query(
      `SELECT * FROM device_tokens
       WHERE student_id = $1 ${activeFilter}
       ORDER BY last_seen_at DESC`,
      [String(studentIdentifiers)]
    );
    return rows.map(publicDevice);
  }

  async unregisterDevice(deviceId, studentId) {
    const runner = this._requireDb();
    if (Array.isArray(studentId)) {
      const result = await runner.query(
        `UPDATE device_tokens
         SET is_active = FALSE, last_error_code = 'UNREGISTERED_BY_CLIENT', updated_at = NOW()
         WHERE device_id = $1 AND student_id = ANY($2::text[]) AND is_active = TRUE`,
        [deviceId, studentId]
      );
      return result.rowCount > 0;
    }
    const result = await runner.query(
      `UPDATE device_tokens
       SET is_active = FALSE, last_error_code = 'UNREGISTERED_BY_CLIENT', updated_at = NOW()
       WHERE device_id = $1 AND student_id = $2 AND is_active = TRUE`,
      [deviceId, String(studentId)]
    );
    return result.rowCount > 0;
  }

  async recordPushSuccess(id) {
    const runner = this._requireDb();
    await runner.query(
      `UPDATE device_tokens
       SET failure_count = 0, last_error_code = NULL, updated_at = NOW()
       WHERE id = $1`,
      [Number(id)]
    );
  }

  async recordPushFailure(id, errorCode, { deactivate = false } = {}) {
    const runner = this._requireDb();
    await runner.query(
      `UPDATE device_tokens
       SET failure_count = failure_count + 1,
           last_error_code = $2,
           is_active = CASE WHEN $3 THEN FALSE ELSE is_active END,
           updated_at = NOW()
       WHERE id = $1`,
      [Number(id), String(errorCode || 'UNKNOWN_PUSH_ERROR'), Boolean(deactivate)]
    );
  }
}

module.exports = {
  DeviceTokenRepository,
  hashTarget,
  publicDevice,
};
