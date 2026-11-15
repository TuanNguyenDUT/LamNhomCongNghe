const { NotificationService } = require('../src/services/notification.service');
const { InMemoryDbStore } = require('../src/config/db');

async function testDedup() {
  const store = new InMemoryDbStore();
  const service = new NotificationService(store);

  const sampleNotice = {
    title: 'TB về Xét công nhận tốt nghiệp đợt 4 năm 2026 (TB số 4)',
    content: '- Danh sách sinh viên dự kiến được xét tốt nghiệp: Tại đây',
    source_channel: 'DUT_GENERAL',
    source_name: 'Thông báo chung',
    source_url: 'https://sv.dut.udn.vn/#tabs_PubTB-divT0',
    published_at: '2026-11-13T08:00:00.000Z'
  };

  console.log('--- LẦN 1: Ingest thông báo mới ---');
  const res1 = await service.ingestNotification(sampleNotice);
  console.log('Kết quả 1:', res1.status, res1.message);
  console.log('Số lượng thông báo trong DB:', store.notifications.size);

  console.log('\n--- LẦN 2: Ingest LẠI thông báo vừa rồi ---');
  const res2 = await service.ingestNotification(sampleNotice);
  console.log('Kết quả 2:', res2.status, res2.message);
  console.log('Số lượng thông báo trong DB:', store.notifications.size);

  if (res2.status === 'DUPLICATE' && store.notifications.size === 1) {
    console.log('\n✔ TEST CHỐNG TRÙNG LẶP ĐẠT 100%: Thông báo cũ không bị lưu lại!');
  } else {
    console.error('\n❌ LỖI: Chống trùng lặp thất bại!');
    process.exit(1);
  }
}

testDedup();
