const { test, before, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createTestPool, resetDatabase, seedStudent, seedNotification, teardownTestPool } = require('./helpers/pg-test-harness');
const { createServer } = require('../src/server');
const { AuthService } = require('../src/services/auth.service');
const { encryptSecret, decryptSecret } = require('../src/config/secrets');
const { isNoticeForStudent } = require('../src/services/notification.service');
const { PushDeliveryService } = require('../src/services/push-delivery.service');
const { DeviceTokenRepository } = require('../src/db/device-token.repository');

let pool, a, b, notice;
before(async () => { pool = await createTestPool(); });
beforeEach(async () => {
  await resetDatabase(pool);
  a = await seedStudent(pool, {student_code:'102230001'});
  b = await seedStudent(pool, {student_code:'102230002'});
  notice = await seedNotification(pool);
});
after(async () => { await teardownTestPool(pool); });

test('Secrets use authenticated encryption, reject tampering and legacy base64', () => {
  const plaintext = 'test-dut-password';
  const encrypted = encryptSecret(plaintext);
  assert.notEqual(encrypted, encryptSecret(plaintext));
  assert.equal(decryptSecret(encrypted), plaintext);
  assert.ok(!encrypted.includes(plaintext));
  const parts = encrypted.split(':');
  parts[3] = Buffer.from('tampered-ciphertext').toString('base64');
  assert.throws(() => decryptSecret(parts.join(':')));
  assert.throws(() => decryptSecret(Buffer.from(plaintext).toString('base64')));
});

test('PERSONAL scope takes precedence over common source channels', () => {
  const item = {scope:'PERSONAL',source_channel:'DUT_TRAINING',target_student_id:a.id,content:b.student_code};
  assert.equal(isNoticeForStudent(item,a,[]),true);
  assert.equal(isNoticeForStudent(item,b,[]),false);
});

test('Real HTTP boundary rejects unauthenticated calls and scopes identities to the session', async () => {
  const app = createServer(pool);
  await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve));
  const root = `http://127.0.0.1:${app.server.address().port}`;
  const token = await app.authService.createSession(a.id);
  const call = (path, method='GET', body) => fetch(root+path, {
    method, headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:body ? JSON.stringify(body) : undefined,
  });
  try {
    assert.equal((await fetch(root+'/api/v1/auth/me?student_id='+a.student_code)).status,401);
    const me = await call('/api/v1/auth/me?student_id='+b.id);
    assert.equal(me.status,200);
    assert.equal((await me.json()).data.student.id,a.id);
    const pref = await call('/api/v1/students/preferences','PUT',{student_id:b.id,interested_topics:['CAREER']});
    assert.equal(pref.status,200);
    const rows = await pool.query('SELECT interested_topics FROM students WHERE id=$1::uuid',[b.id]);
    assert.notDeepEqual(rows.rows[0].interested_topics,['CAREER']);
    const privateNotice = await seedNotification(pool,{scope:'PERSONAL',target_student_id:b.id});
    // Explicitly set recipient because older seed helpers omit target_student_id.
    await pool.query("UPDATE notifications SET scope='PERSONAL',target_student_id=$2::uuid WHERE id=$1::uuid",[privateNotice.id,b.id]);
    assert.equal((await call('/api/v1/notifications/'+privateNotice.id)).status,403);
    const deadline = await app.services.deadlineSvc.createDeadline({student_id:b.id,notification_id:notice.id,title:'B only',due_date:new Date(Date.now()+86400000).toISOString()});
    assert.equal((await call('/api/v1/deadlines/'+deadline.deadline_id,'PUT',{student_id:b.id,status:'COMPLETED'})).status,403);
    assert.equal((await call('/api/v1/deadlines/'+deadline.deadline_id,'DELETE')).status,403);
    assert.equal((await call('/api/v1/notifications/ingest','POST',{title:'unauthorized',content:'x'})).status,403);
    assert.equal((await call('/api/v1/auth/logout','POST',{})).status,200);
    assert.equal((await call('/api/v1/auth/me')).status,401);
  } finally { await new Promise(resolve => app.server.close(resolve)); }
});

test('HTTP login issues a usable session and stores only encrypted DUT credentials', async () => {
  const app = createServer(pool);
  app.services.courseSvc.crawler = {
    authenticateWithDut: async (code, password) => ({
      authenticated: code === a.student_code && password === 'test-password',
      courses: [], profile: {},
    }),
  };
  await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve));
  const root = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const login = password => fetch(root+'/api/v1/auth/login', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({student_code:a.student_code,password}),
    });
    assert.equal((await login('wrong-password')).status,401);
    const response = await login('test-password');
    assert.equal(response.status,200);
    const {data} = await response.json();
    assert.equal((await app.authService.authenticate(data.token)).id,a.id);
    const stored = (await pool.query('SELECT dut_session_encrypted FROM students WHERE id=$1::uuid',[a.id])).rows[0].dut_session_encrypted;
    assert.ok(stored.startsWith('v1:'));
    assert.equal(decryptSecret(stored),'test-password');
  } finally { await new Promise(resolve => app.server.close(resolve)); }
});

test('Session tokens are hashed, expire and OAuth state can only be consumed once', async () => {
  const auth = new AuthService(pool);
  const token = await auth.createSession(a.id);
  const record = await pool.query('SELECT token_hash FROM auth_sessions');
  assert.notEqual(record.rows[0].token_hash,token);
  assert.equal((await auth.authenticate(token)).id,a.id);
  await pool.query("UPDATE auth_sessions SET expires_at=NOW()-INTERVAL '1 minute'");
  await assert.rejects(auth.authenticate(token),e=>e.httpStatus===401);
  const state = await auth.createOAuthState(a.id);
  assert.notEqual(state,a.id);
  assert.equal(await auth.consumeOAuthState(state),a.id);
  await assert.rejects(auth.consumeOAuthState(state),e=>e.httpStatus===401);
});

async function registerDevice() {
  return (await new DeviceTokenRepository(pool).registerDevice({student_id:a.id,target:'fake-fid',target_type:'FID',platform:'ANDROID',device_id:crypto.randomUUID()})).device;
}

test('Durable jobs deduplicate, retry temporary errors and survive expired leases', async () => {
  const device = await registerDevice();
  let calls = 0;
  const service = new PushDeliveryService({db:pool,pushService:{sendToDevice:async()=>{
    calls++;
    if(calls===1) throw Object.assign(new Error('temporary'),{code:'PUSH_SEND_FAILED'});
    return {message_id:'provider-001'};
  }}});
  const payload={notificationId:notice.id,studentId:a.id,deviceId:device.id,title:'test',body:'body'};
  await service.enqueue(payload);
  await service.enqueue(payload);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM push_deliveries')).rows[0].n,1);
  await service.processDue();
  let job=(await pool.query('SELECT * FROM push_deliveries')).rows[0];
  assert.equal(job.status,'PENDING');
  assert.equal(job.attempts,1);
  await pool.query("UPDATE push_deliveries SET status='SENDING',locked_until=NOW()-INTERVAL '1 minute'");
  await Promise.all([service.processDue(),service.processDue()]);
  job=(await pool.query('SELECT * FROM push_deliveries')).rows[0];
  assert.equal(job.status,'SENT');
  assert.equal(job.provider_message_id,'provider-001');
  assert.equal(calls,2);
});

test('Reminder scheduling creates jobs once and does not mark sent before successful delivery', async () => {
  const app=createServer(pool);
  await registerDevice();
  const deadline=await app.services.deadlineSvc.createDeadline({student_id:a.id,notification_id:notice.id,title:'deadline',due_date:new Date(Date.now()+20*3600000).toISOString()});
  await app.services.deadlineSvc.processEscalationReminders();
  await app.services.deadlineSvc.processEscalationReminders();
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM push_deliveries')).rows[0].n,1);
  assert.equal((await app.services.deadlineSvc.getDeadlineById(deadline.deadline_id)).reminder_stage_sent,0);
  await app.repository.setReadStatus(notice.id,a.id,true);
  let calls=0;
  await new PushDeliveryService({db:pool,pushService:{sendToDevice:async()=>{calls++;return {message_id:'x'};}}}).processDue();
  assert.equal(calls,0);
  assert.equal((await pool.query('SELECT error_code FROM push_deliveries')).rows[0].error_code,'ALREADY_READ');
});

test('Pending notifications are not delivered to a device reassigned to another student', async () => {
  const device=await registerDevice();
  let calls=0;
  const service=new PushDeliveryService({db:pool,pushService:{sendToDevice:async()=>{calls++;return {};}}});
  await service.enqueue({notificationId:notice.id,studentId:a.id,deviceId:device.id,title:'test',body:'body'});
  await pool.query('UPDATE device_tokens SET student_id=$2 WHERE id=$1',[device.id,b.id]);
  await service.processDue();
  assert.equal(calls,0);
  assert.equal((await pool.query('SELECT status FROM push_deliveries')).rows[0].status,'SKIPPED');
});

test('Notification and delivery jobs commit atomically, and duplicate ingest does not create extra jobs', async () => {
  const app=createServer(pool);
  await registerDevice();
  const service=app.services.notificationSvc;
  const originalDb=service.db;
  const payload={title:'Khẩn cấp: nghỉ học đột xuất hôm nay',content:'Nhà trường thông báo nghỉ học đột xuất.',source_channel:'DUT_TRAINING'};
  service.db={...originalDb,withTransaction:fn=>originalDb.withTransaction(tx=>fn({
    query:async(sql,params)=>{
      if(sql.includes('INSERT INTO push_deliveries')) throw new Error('Simulated queue insert failure');
      return tx.query(sql,params);
    },
  }))};
  await assert.rejects(service.ingestNotification(payload),/queue insert failure/);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM notifications WHERE title=$1',[payload.title])).rows[0].n,0);
  service.db=originalDb;
  await service.ingestNotification(payload);
  await service.ingestNotification(payload);
  assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM push_deliveries')).rows[0].n,1);
});

test('Delivery retries have a finite limit and permanent failures are not retried', async () => {
  const device=await registerDevice();
  let calls=0;
  const service=new PushDeliveryService({db:pool,pushService:{sendToDevice:async()=>{
    calls++;throw Object.assign(new Error('network unavailable'),{code:'PUSH_SEND_FAILED'});
  }}});
  await service.enqueue({notificationId:notice.id,studentId:a.id,deviceId:device.id,title:'test',body:'body'});
  for(let i=0;i<5;i++) {
    await pool.query('UPDATE push_deliveries SET available_at=NOW()');
    await service.processDue();
  }
  assert.equal(calls,4);
  assert.equal((await pool.query('SELECT status FROM push_deliveries')).rows[0].status,'FAILED');
});

test('Calendar sync is idempotent and enforces deadline ownership', async () => {
  const app=createServer(pool);
  const service=app.services.calendarSvc;
  service.hasGoogleCredentials=()=>true;
  service.refreshAccessToken=async()=> 'fake-access';
  const events=new Map();
  service._postHttps=async(_host,path,payload,_headers,method='POST')=>{
    const body=JSON.parse(payload);
    const id=method==='POST' ? body.id : path.split('/').pop();
    if(method==='POST' && events.has(id)) throw Object.assign(new Error('Conflict'),{httpStatus:409});
    events.set(id,body);
    return {id};
  };
  await service.connectGoogleAccount(a.id,{refresh_token:'fake-refresh'});
  const raw=(await pool.query('SELECT google_refresh_token FROM students WHERE id=$1::uuid',[a.id])).rows[0].google_refresh_token;
  assert.ok(raw.startsWith('v1:'));
  const deadline=await app.services.deadlineSvc.createDeadline({student_id:a.id,notification_id:notice.id,item_type:'REMINDER',title:'mine',due_date:new Date(Date.now()+3600000).toISOString()});
  assert.equal((await service.syncDeadlinesToCalendar(a.id,deadline.deadline_id)).synced_count,1);
  assert.equal((await service.syncDeadlinesToCalendar(a.id,deadline.deadline_id)).synced_count,1);
  assert.equal(events.size,1);
  await assert.rejects(service.syncDeadlinesToCalendar(b.id,deadline.deadline_id),e=>e.httpStatus===403);
  await assert.rejects(service.deleteEventFromCalendar(b.id,deadline.deadline_id),e=>e.httpStatus===403);
  service._deleteHttps=async()=>{throw new Error('provider unavailable')};
  await assert.rejects(service.deleteEventFromCalendar(a.id,deadline.deadline_id));
  await assert.rejects(app.controller.deleteDeadline(deadline.deadline_id,a.id),e=>e.code==='GOOGLE_DELETE_FAILED');
  await assert.rejects(app.controller.updateDeadline(deadline.deadline_id,{student_id:a.id,status:'COMPLETED'}),e=>e.code==='GOOGLE_DELETE_FAILED');
  assert.notEqual((await app.services.deadlineSvc.getDeadlineById(deadline.deadline_id)).status,'COMPLETED');
  assert.ok((await app.services.deadlineSvc.getDeadlineById(deadline.deadline_id)).google_event_id);
});
