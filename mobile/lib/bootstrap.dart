import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import 'app/app.dart';
import 'app/router.dart';
import 'core/config/app_config.dart';
import 'core/notifications/push_notification_service.dart';

Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();

  FlutterError.onError = (details) {
    FlutterError.presentError(details);
  };
  PlatformDispatcher.instance.onError = (error, stack) {
    debugPrint('Uncaught platform error: $error\n$stack');
    return true;
  };

  final container = ProviderContainer();

  if (AppConfig.enableFirebase) {
    try {
      await container
          .read(pushNotificationServiceProvider)
          .initialize(
            onOpenNotification: (notificationId) {
              container
                  .read(appRouterProvider)
                  .go('/notifications/$notificationId');
            },
          );
    } catch (error, stack) {
      debugPrint('Firebase bootstrap skipped: $error\n$stack');
    }
  }

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const StudentNotificationApp(),
    ),
  );
}
