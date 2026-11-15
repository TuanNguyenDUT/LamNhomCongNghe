import '../domain/notification_item.dart';
import '../domain/notification_repository.dart';
import 'notification_api_service.dart';

class NotificationRepositoryImpl implements NotificationRepository {
  const NotificationRepositoryImpl(this._apiService);

  final NotificationApiService _apiService;

  @override
  Future<NotificationPage> fetchNotifications({
    int page = 1,
    int limit = 50,
    String? studentId,
    String? sourceChannel,
  }) {
    return _apiService.fetchNotifications(
      page: page,
      limit: limit,
      studentId: studentId,
      sourceChannel: sourceChannel,
    );
  }

  @override
  Future<NotificationItem> fetchNotification(dynamic id, {String? studentId}) {
    return _apiService.fetchNotification(id, studentId: studentId);
  }

  @override
  Future<void> setReadStatus(
    dynamic id, {
    required bool isRead,
    String? studentId,
  }) {
    return _apiService.setReadStatus(id, isRead: isRead, studentId: studentId);
  }
}
