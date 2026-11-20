import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/config/app_config.dart';
import '../../../core/network/api_client.dart';
import '../../auth/presentation/auth_controller.dart';
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

class SelectedCategoryNotifier extends Notifier<String> {
  @override
  String build() => 'ALL';

  void setCategory(String category) {
    state = category;
  }
}

final selectedCategoryProvider =
    NotifierProvider<SelectedCategoryNotifier, String>(SelectedCategoryNotifier.new);

class SelectedTopicCategoriesNotifier extends Notifier<Set<String>> {
  @override
  Set<String> build() => <String>{};

  void toggle(String categoryCode) {
    final next = Set<String>.from(state);
    if (next.contains(categoryCode)) {
      next.remove(categoryCode);
    } else {
      next.add(categoryCode);
    }
    state = next;
  }

  void clear() {
    state = <String>{};
  }
}

final selectedTopicCategoriesProvider =
    NotifierProvider<SelectedTopicCategoriesNotifier, Set<String>>(
  SelectedTopicCategoriesNotifier.new,
);

class CourseFilter {
  final String courseCode;
  final String courseName;

  const CourseFilter({required this.courseCode, required this.courseName});
}

class SelectedCourseFilterNotifier extends Notifier<CourseFilter?> {
  @override
  CourseFilter? build() => null;

  void setFilter({required String courseCode, required String courseName}) {
    state = CourseFilter(courseCode: courseCode, courseName: courseName);
  }

  void clear() {
    state = null;
  }
}

final selectedCourseFilterProvider =
    NotifierProvider<SelectedCourseFilterNotifier, CourseFilter?>(
  SelectedCourseFilterNotifier.new,
);

class FeedSearchQueryNotifier extends Notifier<String> {
  @override
  String build() => '';

  void setQuery(String query) {
    state = query;
  }

  void clear() {
    state = '';
  }
}

final feedSearchQueryProvider =
    NotifierProvider<FeedSearchQueryNotifier, String>(
  FeedSearchQueryNotifier.new,
);

final notificationFeedProvider = FutureProvider.autoDispose<NotificationPage>((
  ref,
) {
  final authState = ref.watch(authControllerProvider);
  final studentId = authState.session?.studentCode ?? AppConfig.developmentStudentId;
  final category = ref.watch(selectedCategoryProvider);
  return ref.watch(notificationRepositoryProvider).fetchNotifications(
    studentId: studentId,
    sourceChannel: category == 'ALL' ? null : category,
    limit: 100,
  );
});

final notificationDetailProvider = FutureProvider.autoDispose
    .family<NotificationItem, dynamic>((ref, id) {
      final authState = ref.watch(authControllerProvider);
      final studentId = authState.session?.studentCode ?? AppConfig.developmentStudentId;
      return ref.watch(notificationRepositoryProvider).fetchNotification(
        id,
        studentId: studentId,
      );
    });
