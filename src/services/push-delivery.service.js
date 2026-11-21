const { db: defaultDb } = require('../config/db');
const { PushNotificationService } = require('./pushNotificationService');
const { DeviceTokenRepository } = require('../db/device-token.repository');

class PushDeliveryService {
  constructor({ db = defaultDb, pushService = null } = {}) {
    this.db = db;
    this.pushService = pushService || new PushNotificationService({deviceRepository:new DeviceTokenRepository(db)});
  }

  async enqueue({ notificationId, deadlineId = null, studentId, deviceId, stage = 0, title, body, data = {}, dueDate = '' }) {
    const key = `${notificationId}:${deadlineId || 'initial'}:${dueDate}:${deviceId}:${stage}`;
    await this.db.query(
      `INSERT INTO push_deliveries (notification_id, deadline_id, student_id, device_token_id,
         stage, dedupe_key, title, body, data)
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9::jsonb)
       ON CONFLICT (dedupe_key) DO NOTHING`,
      [notificationId, deadlineId, studentId, deviceId, stage, key, title, body, JSON.stringify({...data, due_date:dueDate || undefined})]
    );
  }

  async processDue(limit = 25) {
    await this.db.query(
      `UPDATE push_deliveries SET status='FAILED', error_code='RETRY_EXHAUSTED'
       WHERE status='SENDING' AND locked_until < NOW() AND attempts >= 4`
    );
    for (let i = 0; i < limit; i++) {
      const { rows } = await this.db.query(
        `WITH candidate AS (
           SELECT id FROM push_deliveries
           WHERE (status='PENDING' AND available_at <= NOW())
             OR (status='SENDING' AND locked_until < NOW() AND attempts < 4)
           ORDER BY available_at, id FOR UPDATE SKIP LOCKED LIMIT 1
         ) UPDATE push_deliveries p SET status='SENDING', attempts=attempts+1,
             locked_until=NOW()+INTERVAL '5 minutes'
           FROM candidate c WHERE p.id=c.id RETURNING p.*`
      );
      const job = rows[0];
      if (!job) break;
      try {
        const device = await this.db.query(
          `SELECT 1 FROM device_tokens d JOIN students s ON s.id=$2::uuid
           WHERE d.id=$1 AND d.is_active=TRUE
             AND d.student_id IN (s.id::text,s.student_code,s.firebase_uid)`,
          [job.device_token_id, job.student_id]
        );
        let skip = device.rowCount ? null : 'DEVICE_INACTIVE_OR_REASSIGNED';
        if (job.deadline_id) {
          const result = await this.db.query(
            `SELECT d.*, sn.is_read FROM deadlines d LEFT JOIN student_notifications sn
               ON sn.notification_id=d.notification_id AND sn.student_id=d.student_id
             WHERE d.deadline_id=$1::uuid`, [job.deadline_id]
          );
          const deadline = result.rows[0];
          if (!deadline || deadline.status === 'COMPLETED' || new Date(deadline.due_date) <= new Date()) skip = 'DEADLINE_FINISHED';
          else if (deadline.is_read) skip = 'ALREADY_READ';
          else if (job.data.due_date && new Date(deadline.due_date).toISOString() !== job.data.due_date) skip = 'DEADLINE_CHANGED';
        }
        if (skip) {
          await this.db.query("UPDATE push_deliveries SET status='SKIPPED',error_code=$2,locked_until=NULL WHERE id=$1", [job.id,skip]);
          continue;
        }
        const result = await this.pushService.sendToDevice({deviceTokenId:job.device_token_id,title:job.title,body:job.body,data:job.data});
        await this.db.query(
          "UPDATE push_deliveries SET status='SENT',sent_at=NOW(),provider_message_id=$2,error_code=NULL,locked_until=NULL WHERE id=$1",
          [job.id,result.message_id]
        );
        if (job.deadline_id) {
          await this.db.query('UPDATE deadlines SET reminder_stage_sent=GREATEST(reminder_stage_sent,$2) WHERE deadline_id=$1::uuid', [job.deadline_id,job.stage]);
        }
      } catch (error) {
        const permanent = ['INVALID_DEVICE_TOKEN','ACTIVE_DEVICE_NOT_FOUND'].includes(error.code);
        const unconfigured = error.code === 'FCM_NOT_CONFIGURED';
        const failed = permanent || (!unconfigured && job.attempts >= 4);
        await this.db.query(
          `UPDATE push_deliveries SET status=$2,error_code=$3,locked_until=NULL,
             attempts=CASE WHEN $4 THEN GREATEST(0,attempts-1) ELSE attempts END,
             available_at=NOW()+($5::int * INTERVAL '1 second') WHERE id=$1`,
          [job.id,failed ? 'FAILED' : 'PENDING',error.code || 'PUSH_SEND_FAILED',unconfigured,unconfigured ? 300 : [5,30,120][Math.min(job.attempts-1,2)]]
        );
      }
    }
  }
}

module.exports = { PushDeliveryService };
