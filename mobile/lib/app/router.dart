import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../core/presentation/ambient_background.dart';
import '../core/presentation/floating_bottom_dock.dart';
import '../core/presentation/top_dynamic_bar.dart';
import '../core/presentation/warm_pearl_tokens.dart';
import '../features/auth/presentation/auth_controller.dart';
import '../features/auth/presentation/login_screen.dart';
import '../features/courses/presentation/enrolled_courses_screen.dart';
import '../features/deadlines/presentation/deadlines_screen.dart';
import '../features/notifications/presentation/home_feed_screen.dart';
import '../features/notifications/presentation/notification_detail_page.dart';
import '../features/profile/presentation/profile_screen.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>();
final _shellNavigatorKey = GlobalKey<NavigatorState>();

final appRouterProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authControllerProvider);

  return GoRouter(
    navigatorKey: _rootNavigatorKey,
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
        parentNavigatorKey: _rootNavigatorKey,
        builder: (context, state) => const LoginScreen(),
      ),
      // Deep link backwards compatibility: redirects /reminds to /deadlines?scope=personal
      GoRoute(
        path: '/reminds',
        redirect: (context, state) => '/deadlines?scope=personal',
      ),
      // Full slide-over Notification Detail route (outside dock shell)
      GoRoute(
        path: '/notifications/:id',
        parentNavigatorKey: _rootNavigatorKey,
        pageBuilder: (context, state) {
          final id = state.pathParameters['id'] ?? '';
          return CustomTransitionPage(
            key: state.pageKey,
            child: NotificationDetailPage(notificationId: id),
            transitionsBuilder: (context, animation, secondaryAnimation, child) {
              final curved = CurvedAnimation(
                parent: animation,
                curve: WarmPearlMotion.smooth,
              );
              return SlideTransition(
                position: Tween<Offset>(
                  begin: const Offset(1.0, 0.0),
                  end: Offset.zero,
                ).animate(curved),
                child: child,
              );
            },
          );
        },
      ),
      // 4-Tab Main Shell Route
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) {
          return _MainNavigationScaffold(child: child);
        },
        routes: [
          GoRoute(
            path: '/notifications',
            builder: (context, state) => const HomeFeedScreen(),
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
            path: '/profile',
            builder: (context, state) => const ProfileScreen(),
          ),
        ],
      ),
    ],
    errorBuilder: (context, state) => Scaffold(
      backgroundColor: WarmPearlColors.canvasBg,
      appBar: AppBar(
        title: const Text('Không tìm thấy trang'),
        backgroundColor: Colors.transparent,
      ),
      body: Center(
        child: Text(
          state.error?.toString() ?? 'Đường dẫn không hợp lệ',
          style: const TextStyle(
            fontFamily: WarmPearlTypography.bodyFont,
            color: WarmPearlColors.inkSecondary,
          ),
        ),
      ),
    ),
  );
});

class _MainNavigationScaffold extends ConsumerWidget {
  const _MainNavigationScaffold({required this.child});
  final Widget child;

  int _calculateSelectedIndex(BuildContext context) {
    final location = GoRouterState.of(context).uri.path;
    if (location.startsWith('/courses')) return 1;
    if (location.startsWith('/deadlines')) return 2;
    if (location.startsWith('/profile')) return 3;
    return 0; // /notifications
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedIndex = _calculateSelectedIndex(context);

    final deadlinesAsync = ref.watch(deadlinesListProvider);
    final allTasks = deadlinesAsync.asData?.value ?? [];
    final pendingCount = allTasks.where((t) => !t.isCompleted).length;

    return WarmPearlAmbientBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: Stack(
          children: [
            // Centered content column:
            // Mobile (< 768px): Full 100% width, no outer borders, scrolls naturally
            // Desktop (>= 768px): Spacious centered column (maxWidth: 720px)
            Positioned.fill(
              child: Align(
                alignment: Alignment.topCenter,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 720),
                  child: Column(
                    children: [
                      const SafeArea(bottom: false, child: TopDynamicBar()),
                      Expanded(child: child),
                    ],
                  ),
                ),
              ),
            ),
            // Floating Bottom Dock:
            // Fixed at bottom: 16px according to actual viewport, centered with maxWidth: 720px
            Positioned(
              left: 0,
              right: 0,
              bottom: 16,
              child: SafeArea(
                top: false,
                bottom: false,
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 720),
                    child: FloatingBottomDock(
                      selectedIndex: selectedIndex,
                      pendingCount: pendingCount,
                      onTabSelected: (index) {
                        switch (index) {
                          case 0:
                            context.go('/notifications');
                            break;
                          case 1:
                            context.go('/courses');
                            break;
                          case 2:
                            context.go('/deadlines');
                            break;
                          case 3:
                            context.go('/profile');
                            break;
                        }
                      },
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
