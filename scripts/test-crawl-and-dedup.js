const { NotificationService } = require('../src/services/notification.service');
const {
  createTestPool,
  resetDatabase,
  teardownTestPool,
} = require('../tests/helpers/pg-test-harness');

async function testDedup() {
  const pool = await createTestPool();
  try {
    await resetDatabase(pool);
    const service = new NotificationService({ pool });

    const sampleNotice = {
      title: 'TB về Xét công nhận tốt nghiệp đợt 4 năm 2026 (TB số 4)',
      content: '- Danh sách sinh viên dự kiến được xét tốt nghiệp: Tại đây',
      source_channel: 'DUT_GENERAL',
      source_name: 'Thông báo chung',
      source_url: 'https://sv.dut.udn.vn/#tabs_PubTB-divT0',
      published_at: '2026-11-13T08:00:00.000Z',
    };

    console.log('--- LẦN 1: Ingest thông báo mới ---');
    const res1 = await service.ingestNotification(sampleNotice);
    const count1 = await pool.query('SELECT COUNT(*)::int AS cnt FROM notifications');
    console.log('Kết quả 1:', res1.status, res1.message);
    console.log('Số lượng thông báo trong DB:', count1.rows[0].cnt);

    console.log('\n--- LẦN 2: Ingest LẠI thông báo vừa rồi ---');
    const res2 = await service.ingestNotification(sampleNotice);
    const count2 = await pool.query('SELECT COUNT(*)::int AS cnt FROM notifications');
    console.log('Kết quả 2:', res2.status, res2.message);
    console.log('Số lượng thông báo trong DB:', count2.rows[0].cnt);

    if (res2.status === 'DUPLICATE' && count2.rows[0].cnt === 1) {
      console.log('\n✔ TEST CHỐNG TRÙNG LẶP ĐẠT 100%: Thông báo cũ không bị lưu lại!');
    } else {
      console.error('\n❌ LỖI: Chống trùng lặp thất bại!');
      process.exitCode = 1;
    }
  } finally {
    await teardownTestPool(pool);
  }
}

testDedup().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
