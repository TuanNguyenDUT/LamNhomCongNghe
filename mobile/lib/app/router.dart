import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../features/courses/presentation/enrolled_courses_screen.dart';
import '../features/deadlines/presentation/deadlines_screen.dart';
import '../features/notifications/presentation/home_feed_screen.dart';
import '../features/notifications/presentation/notification_detail_page.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/notifications',
    routes: [
      ShellRoute(
        builder: (context, state, child) {
          return _MainNavigationScaffold(child: child);
        },
        routes: [
          GoRoute(
            path: '/notifications',
            builder: (context, state) => const HomeFeedScreen(),
            routes: [
              GoRoute(
                path: ':id',
                builder: (context, state) {
                  final id = int.tryParse(state.pathParameters['id'] ?? '') ?? 0;
                  return NotificationDetailPage(notificationId: id);
                },
              ),
            ],
          ),
          GoRoute(
            path: '/courses',
            builder: (context, state) => const EnrolledCoursesScreen(),
          ),
          GoRoute(
            path: '/deadlines',
            builder: (context, state) => const DeadlinesScreen(),
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

class _MainNavigationScaffold extends StatelessWidget {
  const _MainNavigationScaffold({required this.child});
  final Widget child;

  int _calculateSelectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).uri.path;
    if (location.startsWith('/courses')) return 1;
    if (location.startsWith('/deadlines')) return 2;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final selectedIndex = _calculateSelectedIndex(context);
    return Scaffold(
      body: child,
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIndex,
        onDestinationSelected: (idx) {
          switch (idx) {
            case 0:
              context.go('/notifications');
              break;
            case 1:
              context.go('/courses');
              break;
            case 2:
              context.go('/deadlines');
              break;
          }
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.feed_outlined),
            selectedIcon: Icon(Icons.feed),
            label: 'Bảng tin',
          ),
          NavigationDestination(
            icon: Icon(Icons.school_outlined),
            selectedIcon: Icon(Icons.school),
            label: 'Học phần',
          ),
          NavigationDestination(
            icon: Icon(Icons.access_time_outlined),
            selectedIcon: Icon(Icons.access_time_filled),
            label: 'Hạn chót',
          ),
        ],
      ),
    );
  }
}
