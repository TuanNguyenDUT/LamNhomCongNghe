import '../domain/notification_item.dart';
import '../domain/notification_repository.dart';
import 'notification_api_service.dart';

class NotificationRepositoryImpl implements NotificationRepository {
  const NotificationRepositoryImpl(this._apiService);

  final NotificationApiService _apiService;

  @override
  Future<NotificationPage> fetchNotifications({int page = 1, int limit = 20}) {
    return _apiService.fetchNotifications(page: page, limit: limit);
  }

  @override
  Future<NotificationItem> fetchNotification(int id) {
    return _apiService.fetchNotification(id);
  }

  @override
  Future<void> setReadStatus(int id, {required bool isRead}) {
    return _apiService.setReadStatus(id, isRead: isRead);
  }
}
