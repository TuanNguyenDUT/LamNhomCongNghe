import 'dart:async';

import 'package:dio/dio.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../network/api_client.dart';
import 'device_identity_service.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

final pushNotificationServiceProvider = Provider<PushNotificationService>((
  ref,
) {
  final service = PushNotificationService(
    ref.watch(dioProvider),
    ref.watch(deviceIdentityServiceProvider),
    FirebaseMessaging.instance,
    FlutterLocalNotificationsPlugin(),
  );
  ref.onDispose(service.dispose);
  return service;
});

class PushNotificationService {
  PushNotificationService(
    this._dio,
    this._deviceIdentityService,
    this._messaging,
    this._localNotifications,
  );

  static const _channelId = 'student_notifications';
  static const _channelName = 'Thông báo sinh viên';

  final Dio _dio;
  final DeviceIdentityService _deviceIdentityService;
  final FirebaseMessaging _messaging;
  final FlutterLocalNotificationsPlugin _localNotifications;

  final _subscriptions = <StreamSubscription<dynamic>>[];
  void Function(String notificationId)? _onOpenNotification;

  Future<void> initialize({
    required void Function(String notificationId) onOpenNotification,
  }) async {
    _onOpenNotification = onOpenNotification;
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    await _initializeLocalNotifications();
    await _messaging.requestPermission(alert: true, badge: true, sound: true);

    _subscriptions.add(_messaging.onRegistered.listen(_handleRegistered));
    _subscriptions.add(_messaging.onUnregistered.listen(_handleUnregistered));
    _subscriptions.add(
      FirebaseMessaging.onMessage.listen(_showForegroundNotification),
    );
    _subscriptions.add(
      FirebaseMessaging.onMessageOpenedApp.listen(_openRemoteMessage),
    );

    await _messaging.register();

    final initialMessage = await _messaging.getInitialMessage();
    if (initialMessage != null) {
      _openRemoteMessage(initialMessage);
    }
  }

  Future<void> _initializeLocalNotifications() async {
    const initializationSettings = InitializationSettings(
      android: AndroidInitializationSettings('ic_launcher'),
    );

    await _localNotifications.initialize(
      settings: initializationSettings,
      onDidReceiveNotificationResponse: (response) {
        final notificationId = response.payload;
        if (notificationId != null && notificationId.isNotEmpty) {
          _onOpenNotification?.call(notificationId);
        }
      },
    );
  }

  Future<void> _registerFid(String fid) async {
    final studentId = AppConfig.developmentStudentId;
    if (studentId.isEmpty || fid.isEmpty) {
      return;
    }

    final deviceId = await _deviceIdentityService.getOrCreateDeviceId();
    await _dio.post<void>(
      '/api/devices/register',
      data: {
        'student_id': studentId,
        'fid': fid,
        'platform': _platformName,
        'device_id': deviceId,
        'app_version': '0.1.0',
      },
    );
  }

  void _handleRegistered(String fid) {
    unawaited(
      _registerFid(fid).catchError((Object error, StackTrace stack) {
        debugPrint('Không thể đăng ký FID với backend: $error\n$stack');
      }),
    );
  }

  void _handleUnregistered(String fid) {
    unawaited(
      _unregisterCurrentDevice().catchError((Object error, StackTrace stack) {
        debugPrint(
          'Không thể hủy đăng ký thiết bị với backend: $error\n$stack',
        );
      }),
    );
  }

  Future<void> _unregisterCurrentDevice() async {
    final studentId = AppConfig.developmentStudentId;
    if (studentId.isEmpty) {
      return;
    }
    final deviceId = await _deviceIdentityService.getOrCreateDeviceId();
    await _dio.delete<void>(
      '/api/devices/$deviceId',
      queryParameters: {'student_id': studentId},
    );
  }

  Future<void> _showForegroundNotification(RemoteMessage message) async {
    final title = message.notification?.title ?? 'Thông báo mới';
    final body = message.notification?.body ?? '';
    final notificationId = message.data['notification_id']?.toString();

    const details = NotificationDetails(
      android: AndroidNotificationDetails(
        _channelId,
        _channelName,
        channelDescription: 'Thông báo học vụ và nhắc nhở dành cho sinh viên',
        importance: Importance.max,
        priority: Priority.high,
      ),
    );

    await _localNotifications.show(
      id:
          message.messageId?.hashCode ??
          DateTime.now().millisecondsSinceEpoch.remainder(1 << 31),
      title: title,
      body: body,
      notificationDetails: details,
      payload: notificationId,
    );
  }

  void _openRemoteMessage(RemoteMessage message) {
    final notificationId = message.data['notification_id']?.toString();
    if (notificationId != null && notificationId.isNotEmpty) {
      _onOpenNotification?.call(notificationId);
    }
  }

  String get _platformName {
    if (defaultTargetPlatform != TargetPlatform.android) {
      throw UnsupportedError('Ứng dụng hiện chỉ hỗ trợ Android');
    }
    return 'ANDROID';
  }

  void dispose() {
    for (final subscription in _subscriptions) {
      unawaited(subscription.cancel());
    }
    _subscriptions.clear();
  }
}
