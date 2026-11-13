import 'package:dut_student_notifications/features/notifications/domain/notification_item.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('parses notification payload returned by Node backend', () {
    final item = NotificationItem.fromJson({
      'id': 15,
      'title': 'Đổi phòng thi IT401',
      'content': 'Phòng thi chuyển sang A105.',
      'summary': 'Phòng thi chuyển sang A105.',
      'priority': 'URGENT',
      'priority_score': 92,
      'scope_type': 'CLASS',
      'source_type': 'CLASS',
      'published_at': '2026-11-13T08:00:00.000Z',
      'is_read': false,
      'is_pinned': 1,
      'course_code': 'IT401',
      'course_tag': '#IT401-CNPM',
      'tags': ['#LịchThi', '#LớpHọcPhần'],
    });

    expect(item.id, 15);
    expect(item.priority, 'URGENT');
    expect(item.priorityScore, 92);
    expect(item.isPinned, isTrue);
    expect(item.isRead, isFalse);
    expect(item.courseCode, 'IT401');
    expect(item.tags, ['#LịchThi', '#LớpHọcPhần']);
  });
}
