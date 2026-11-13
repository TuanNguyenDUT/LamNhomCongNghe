import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../features/notifications/presentation/notification_detail_page.dart';
import '../features/notifications/presentation/notification_list_page.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/notifications',
    routes: [
      GoRoute(
        path: '/notifications',
        builder: (context, state) => const NotificationListPage(),
        routes: [
          GoRoute(
            path: ':id',
            builder: (context, state) {
              final id = int.tryParse(state.pathParameters['id'] ?? '');
              if (id == null) {
                return const _InvalidNotificationPage();
              }
              return NotificationDetailPage(notificationId: id);
            },
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      appBar: AppBar(title: const Text('Không tìm thấy trang')),
      body: Center(
        child: Text(state.error?.toString() ?? 'Đường dẫn không hợp lệ'),
      ),
    ),
  );
});

class _InvalidNotificationPage extends StatelessWidget {
  const _InvalidNotificationPage();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Thông báo không hợp lệ')),
      body: const Center(child: Text('Mã thông báo không hợp lệ.')),
    );
  }
}
