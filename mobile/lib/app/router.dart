import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../core/presentation/liquid_glass.dart';
import '../features/auth/presentation/auth_controller.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/courses/presentation/enrolled_courses_screen.dart';
import '../features/deadlines/presentation/deadlines_screen.dart';
import '../features/reminds/presentation/reminds_screen.dart';
import '../features/notifications/presentation/home_feed_screen.dart';
import '../features/notifications/presentation/notification_detail_page.dart';
import '../features/profile/presentation/profile_screen.dart';

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authControllerProvider);

  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final isAuth = authState.isAuthenticated;
      final isLoggingIn = state.matchedLocation == '/login';

      if (!isAuth && !isLoggingIn) {
        return '/login';
      }
      if (isAuth && isLoggingIn) {
        return '/notifications';
      }
      return null;
    },
    routes: [
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
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
                  final id = state.pathParameters['id'] ?? '';
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
          GoRoute(
            path: '/reminds',
            builder: (context, state) => const RemindsScreen(),
          ),
          GoRoute(
            path: '/profile',
            builder: (context, state) => const ProfileScreen(),
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
    if (location.startsWith('/reminds')) return 3;
    if (location.startsWith('/profile')) return 4;
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final selectedIndex = _calculateSelectedIndex(context);

    return Scaffold(
      body: Stack(
        children: [
          child,

          // Apple Style Liquid Glass Floating Bottom Navigation Bar (5 tabs)
          Positioned(
            left: 12,
            right: 12,
            bottom: 20,
            child: LiquidGlassContainer(
              borderRadius: 30,
              blurSigma: 24,
              opacity: 0.88,
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildNavItem(
                    context: context,
                    index: 0,
                    selectedIndex: selectedIndex,
                    path: '/notifications',
                    icon: Icons.feed_outlined,
                    selectedIcon: Icons.feed_rounded,
                    label: 'Bảng tin',
                  ),
                  _buildNavItem(
                    context: context,
                    index: 1,
                    selectedIndex: selectedIndex,
                    path: '/courses',
                    icon: Icons.school_outlined,
                    selectedIcon: Icons.school_rounded,
                    label: 'Học phần',
                  ),
                  _buildNavItem(
                    context: context,
                    index: 2,
                    selectedIndex: selectedIndex,
                    path: '/deadlines',
                    icon: Icons.event_note_outlined,
                    selectedIcon: Icons.event_note_rounded,
                    label: 'Hạn chót',
                  ),
                  _buildNavItem(
                    context: context,
                    index: 3,
                    selectedIndex: selectedIndex,
                    path: '/reminds',
                    icon: Icons.alarm_outlined,
                    selectedIcon: Icons.alarm_on_rounded,
                    label: 'Nhắc việc',
                  ),
                  _buildNavItem(
                    context: context,
                    index: 4,
                    selectedIndex: selectedIndex,
                    path: '/profile',
                    icon: Icons.person_outline_rounded,
                    selectedIcon: Icons.person_rounded,
                    label: 'Cá nhân',
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNavItem({
    required BuildContext context,
    required int index,
    required int selectedIndex,
    required String path,
    required IconData icon,
    required IconData selectedIcon,
    required String label,
  }) {
    final isSelected = index == selectedIndex;
    const activeColor = Color(0xFF007AFF); // Apple iOS Blue
    final inactiveColor = const Color(0xFF64748B).withValues(alpha: 0.8);

    return GestureDetector(
      onTap: () => context.go(path),
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 220),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? activeColor.withValues(alpha: 0.12) : Colors.transparent,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              isSelected ? selectedIcon : icon,
              size: 22,
              color: isSelected ? activeColor : inactiveColor,
            ),
            if (isSelected) ...[
              const SizedBox(width: 8),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: activeColor,
                  letterSpacing: -0.2,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
