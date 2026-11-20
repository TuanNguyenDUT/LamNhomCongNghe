import 'notification_item.dart';

abstract interface class NotificationRepository {
  Future<NotificationPage> fetchNotifications({
    int page = 1,
    int limit = 50,
    String? studentId,
    String? sourceChannel,
  });

  Future<NotificationItem> fetchNotification(dynamic id, {String? studentId});

  Future<void> setReadStatus(
    dynamic id, {
    required bool isRead,
    String? studentId,
  });

  Future<void> acknowledgeNotification(
    dynamic id, {
    required String studentId,
  });
}
