/**
 * Task 6: Lưu Firebase registration target trong PostgreSQL.
 * Khi chưa truyền pg Pool, repository dùng bộ nhớ để local/test vẫn chạy.
 */

const crypto = require('node:crypto');

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
    last_seen_at: row.last_seen_at,
    last_error_code: row.last_error_code || null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

class DeviceTokenRepository {
  constructor(pgPool = null) {
    this.pool = pgPool;
    this.memoryDevices = [];
    this.nextId = 1;
  }

  async registerDevice({ student_id, target, target_type, platform, device_id, app_version }) {
    const now = new Date().toISOString();
    const targetHash = hashTarget(target);

    if (!this.pool) {
      for (const item of this.memoryDevices) {
        if (item.target_hash === targetHash && item.device_id !== device_id && item.is_active) {
          item.is_active = false;
          item.last_error_code = 'TOKEN_REASSIGNED';
          item.updated_at = now;
        }
      }

      let row = this.memoryDevices.find((item) => item.device_id === device_id);
      const created = !row;
      if (!row) {
        row = { id: this.nextId++, created_at: now };
        this.memoryDevices.push(row);
      }
      Object.assign(row, {
        student_id,
        registration_target: target,
        target_hash: targetHash,
        target_type,
        platform,
        device_id,
        app_version: app_version || null,
        is_active: true,
        failure_count: 0,
        last_seen_at: now,
        last_error_code: null,
        updated_at: now,
      });
      return { created, device: publicDevice(row) };
    }

    await this.pool.query(
      `UPDATE device_tokens
       SET is_active = FALSE, last_error_code = 'TOKEN_REASSIGNED', updated_at = NOW()
       WHERE target_hash = $1 AND device_id <> $2 AND is_active = TRUE`,
      [targetHash, device_id]
    );
    const { rows } = await this.pool.query(
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
    if (!this.pool) {
      return this.memoryDevices.find(
        (item) =>
          item.device_id === deviceId &&
          item.is_active &&
          (!studentId || item.student_id === studentId)
      ) || null;
    }
    const values = [deviceId];
    const studentFilter = studentId ? 'AND student_id = $2' : '';
    if (studentId) values.push(studentId);
    const { rows } = await this.pool.query(
      `SELECT * FROM device_tokens
       WHERE device_id = $1 AND is_active = TRUE ${studentFilter}
       LIMIT 1`,
      values
    );
    return rows[0] || null;
  }

  async getByIdForDelivery(id) {
    if (!this.pool) {
      return this.memoryDevices.find((item) => item.id === Number(id) && item.is_active) || null;
    }
    const { rows } = await this.pool.query(
      'SELECT * FROM device_tokens WHERE id = $1 AND is_active = TRUE',
      [Number(id)]
    );
    return rows[0] || null;
  }

  async listStudentDevices(studentId, { activeOnly = true } = {}) {
    if (!this.pool) {
      return this.memoryDevices
        .filter((item) => item.student_id === studentId && (!activeOnly || item.is_active))
        .sort((a, b) => String(b.last_seen_at).localeCompare(String(a.last_seen_at)))
        .map(publicDevice);
    }
    const activeFilter = activeOnly ? 'AND is_active = TRUE' : '';
    const { rows } = await this.pool.query(
      `SELECT * FROM device_tokens
       WHERE student_id = $1 ${activeFilter}
       ORDER BY last_seen_at DESC`,
      [studentId]
    );
    return rows.map(publicDevice);
  }

  async unregisterDevice(deviceId, studentId) {
    if (!this.pool) {
      const row = this.memoryDevices.find(
        (item) => item.device_id === deviceId && item.student_id === studentId && item.is_active
      );
      if (!row) return false;
      row.is_active = false;
      row.last_error_code = 'UNREGISTERED_BY_CLIENT';
      row.updated_at = new Date().toISOString();
      return true;
    }
    const result = await this.pool.query(
      `UPDATE device_tokens
       SET is_active = FALSE, last_error_code = 'UNREGISTERED_BY_CLIENT', updated_at = NOW()
       WHERE device_id = $1 AND student_id = $2 AND is_active = TRUE`,
      [deviceId, studentId]
    );
    return result.rowCount > 0;
  }

  async recordPushSuccess(id) {
    if (!this.pool) {
      const row = this.memoryDevices.find((item) => item.id === Number(id));
      if (row) {
        row.failure_count = 0;
        row.last_error_code = null;
        row.updated_at = new Date().toISOString();
      }
      return;
    }
    await this.pool.query(
      `UPDATE device_tokens
       SET failure_count = 0, last_error_code = NULL, updated_at = NOW()
       WHERE id = $1`,
      [Number(id)]
    );
  }

  async recordPushFailure(id, errorCode, { deactivate = false } = {}) {
    if (!this.pool) {
      const row = this.memoryDevices.find((item) => item.id === Number(id));
      if (row) {
        row.failure_count += 1;
        row.last_error_code = String(errorCode || 'UNKNOWN_PUSH_ERROR');
        if (deactivate) row.is_active = false;
        row.updated_at = new Date().toISOString();
      }
      return;
    }
    await this.pool.query(
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
