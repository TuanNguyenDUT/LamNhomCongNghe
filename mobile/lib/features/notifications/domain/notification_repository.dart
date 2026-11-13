import 'notification_item.dart';

abstract interface class NotificationRepository {
  Future<NotificationPage> fetchNotifications({int page = 1, int limit = 20});

  Future<NotificationItem> fetchNotification(int id);

  Future<void> setReadStatus(int id, {required bool isRead});
}
