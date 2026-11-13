import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../data/notification_api_service.dart';
import '../data/notification_repository_impl.dart';
import '../domain/notification_item.dart';
import '../domain/notification_repository.dart';

final notificationApiServiceProvider = Provider<NotificationApiService>((ref) {
  return NotificationApiService(ref.watch(dioProvider));
});

final notificationRepositoryProvider = Provider<NotificationRepository>((ref) {
  return NotificationRepositoryImpl(ref.watch(notificationApiServiceProvider));
});

final notificationFeedProvider = FutureProvider.autoDispose<NotificationPage>((
  ref,
) {
  return ref.watch(notificationRepositoryProvider).fetchNotifications();
});

final notificationDetailProvider = FutureProvider.autoDispose
    .family<NotificationItem, int>((ref, id) {
      return ref.watch(notificationRepositoryProvider).fetchNotification(id);
    });
