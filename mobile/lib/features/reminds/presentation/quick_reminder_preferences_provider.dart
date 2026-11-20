import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../auth/presentation/auth_controller.dart';

class QuickPresetOption {
  final String id;
  final String label;
  final String description;

  const QuickPresetOption({
    required this.id,
    required this.label,
    required this.description,
  });

  DateTime calculateTargetDate([DateTime? referenceTime]) {
    final now = referenceTime ?? DateTime.now();
    switch (id) {
      case '1_hour':
        return now.add(const Duration(hours: 1));
      case 'tonight':
        DateTime dt = DateTime(now.year, now.month, now.day, 20, 0);
        if (dt.isBefore(now)) dt = dt.add(const Duration(days: 1));
        return dt;
      case 'tomorrow_morning':
        return DateTime(now.year, now.month, now.day + 1, 8, 0);
      case '1_day':
        return now.add(const Duration(days: 1));
      case '3_days':
        return now.add(const Duration(days: 3));
      case '1_week':
        return now.add(const Duration(days: 7));
      default:
        return now.add(const Duration(days: 1));
    }
  }
}

const List<QuickPresetOption> kAvailableQuickPresets = [
  QuickPresetOption(id: '1_hour', label: '+1 giờ', description: 'Sau 1 giờ nữa'),
  QuickPresetOption(id: 'tonight', label: 'Tối nay (20:00)', description: '20:00 tối nay'),
  QuickPresetOption(id: 'tomorrow_morning', label: 'Sáng mai (08:00)', description: '08:00 sáng mai'),
  QuickPresetOption(id: '1_day', label: '+1 ngày', description: 'Sau 24 giờ nữa'),
  QuickPresetOption(id: '3_days', label: '+3 ngày', description: 'Sau 3 ngày nữa'),
  QuickPresetOption(id: '1_week', label: '+1 tuần', description: 'Sau 7 ngày nữa'),
];

class QuickReminderPreferencesState {
  final List<String> enabledOptionIds;
  final bool autoSyncGoogleCalendarByDefault;
  final bool isLoading;

  const QuickReminderPreferencesState({
    this.enabledOptionIds = const [
      '1_hour',
      'tonight',
      'tomorrow_morning',
      '1_day',
      '3_days',
      '1_week',
    ],
    this.autoSyncGoogleCalendarByDefault = true,
    this.isLoading = false,
  });

  QuickReminderPreferencesState copyWith({
    List<String>? enabledOptionIds,
    bool? autoSyncGoogleCalendarByDefault,
    bool? isLoading,
  }) {
    return QuickReminderPreferencesState(
      enabledOptionIds: enabledOptionIds ?? this.enabledOptionIds,
      autoSyncGoogleCalendarByDefault:
          autoSyncGoogleCalendarByDefault ?? this.autoSyncGoogleCalendarByDefault,
      isLoading: isLoading ?? this.isLoading,
    );
  }
}

class QuickReminderPreferencesNotifier extends Notifier<QuickReminderPreferencesState> {
  @override
  QuickReminderPreferencesState build() {
    Future.microtask(() => loadPreferences());
    return const QuickReminderPreferencesState();
  }

  Future<void> loadPreferences() async {
    final authState = ref.read(authControllerProvider);
    final studentCode = authState.session?.studentCode ?? '';

    try {
      final dio = ref.read(dioProvider);
      final res = await dio.get(
        '/api/v1/students/preferences',
        queryParameters: {'student_code': studentCode},
      );

      if (res.data != null && res.data['data'] != null) {
        final data = res.data['data'] as Map<String, dynamic>;
        final List<String> loadedOptions = [];
        if (data['quick_reminder_options'] is List) {
          for (final item in data['quick_reminder_options'] as List) {
            loadedOptions.add(item.toString());
          }
        }

        state = state.copyWith(
          enabledOptionIds: loadedOptions.isNotEmpty ? loadedOptions : state.enabledOptionIds,
          autoSyncGoogleCalendarByDefault: data['is_calendar_sync_enabled'] != false,
        );
      }
    } catch (_) {}
  }

  Future<bool> savePreferences({
    required List<String> enabledOptionIds,
    required bool autoSyncGoogleCalendarByDefault,
  }) async {
    state = state.copyWith(isLoading: true);
    final authState = ref.read(authControllerProvider);
    final studentCode = authState.session?.studentCode ?? '';

    try {
      final dio = ref.read(dioProvider);
      await dio.put(
        '/api/v1/students/preferences',
        data: {
          'student_code': studentCode,
          'is_calendar_sync_enabled': autoSyncGoogleCalendarByDefault,
          'quick_reminder_options': enabledOptionIds,
        },
      );

      state = state.copyWith(
        enabledOptionIds: enabledOptionIds,
        autoSyncGoogleCalendarByDefault: autoSyncGoogleCalendarByDefault,
        isLoading: false,
      );
      return true;
    } catch (err) {
      state = state.copyWith(isLoading: false);
      return false;
    }
  }

  void toggleOption(String id) {
    final current = List<String>.from(state.enabledOptionIds);
    if (current.contains(id)) {
      if (current.length > 1) {
        current.remove(id);
      }
    } else {
      current.add(id);
    }
    state = state.copyWith(enabledOptionIds: current);
  }

  void setAutoSync(bool val) {
    state = state.copyWith(autoSyncGoogleCalendarByDefault: val);
  }
}

final quickReminderPreferencesProvider =
    NotifierProvider<QuickReminderPreferencesNotifier, QuickReminderPreferencesState>(
  QuickReminderPreferencesNotifier.new,
);
