import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/network/api_client.dart';
import '../../../core/presentation/app_toast.dart';
import '../../../core/presentation/warm_pearl_tokens.dart';
import '../../deadlines/presentation/deadlines_screen.dart';
import '../../notifications/domain/notification_item.dart';
import 'quick_reminder_preferences_provider.dart';

/// Shows the Warm Pearl Liquid Glass Add Reminder Bottom Sheet.
/// Strictly enforces notification_id link and zero mock tasks.
Future<void> showAddReminderModal(
  BuildContext context,
  WidgetRef ref,
  NotificationItem notif,
  dynamic session,
) async {
  final titleCtrl = TextEditingController(text: '[Nhắc nhở] ${notif.title}');
  final descCtrl = TextEditingController(
    text: notif.summary.isNotEmpty ? notif.summary : notif.content,
  );
  final courseCtrl = TextEditingController(text: notif.courseCode ?? '');

  final prefs = ref.read(quickReminderPreferencesProvider);

  DateTime selectedDate =
      notif.deadlineAt ?? DateTime.now().add(const Duration(days: 1));
  String? activePresetId = notif.deadlineAt != null ? null : '1_day';
  bool syncToGoogleCalendar = prefs.autoSyncGoogleCalendarByDefault;

  final availablePresets = kAvailableQuickPresets
      .where((p) => prefs.enabledOptionIds.contains(p.id))
      .toList();

  await showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (ctx) => Align(
      alignment: Alignment.bottomCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 720),
        child: StatefulBuilder(
          builder: (ctx, setDlgState) {
            final bottomInset = MediaQuery.of(ctx).viewInsets.bottom;

        return Container(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.of(ctx).size.height * 0.88,
          ),
          padding: EdgeInsets.fromLTRB(18, 12, 18, 26 + bottomInset),
          decoration: const BoxDecoration(
            color: WarmPearlColors.sheetBg,
            borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
            border: Border(
              top: BorderSide(color: WarmPearlColors.white, width: 1.5),
            ),
            boxShadow: [
              BoxShadow(
                color: Color(0x29182036),
                blurRadius: 48,
                offset: Offset(0, -18),
              ),
            ],
          ),
          child: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Drag handle
                Center(
                  child: Container(
                    width: 40,
                    height: 4.5,
                    decoration: BoxDecoration(
                      color: WarmPearlColors.sheetHandle,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 14),

                // Header
                Row(
                  children: [
                    Container(
                      width: 38,
                      height: 38,
                      decoration: BoxDecoration(
                        color: WarmPearlColors.coralSoft,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: WarmPearlColors.coralBorder),
                      ),
                      child: const Icon(
                        Icons.alarm_add_rounded,
                        color: WarmPearlColors.coralInk,
                        size: 20,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'Thêm Nhắc Nhở Cá Nhân',
                            style: TextStyle(
                              fontFamily: WarmPearlTypography.displayFont,
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: WarmPearlColors.inkPrimary,
                            ),
                          ),
                          Text(
                            'Gắn liền với thông báo thực tế từ nhà trường',
                            style: TextStyle(
                              fontFamily: WarmPearlTypography.bodyFont,
                              fontSize: 11.5,
                              color: WarmPearlColors.inkSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Linked post preview card
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.75),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: WarmPearlColors.glassBorder),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: WarmPearlColors.coralSoft,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          notif.sourceTitle,
                          style: const TextStyle(
                            fontFamily: WarmPearlTypography.displayFont,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: WarmPearlColors.coralInk,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          notif.title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontFamily: WarmPearlTypography.displayFont,
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: WarmPearlColors.inkPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Title input
                Container(
                  height: 46,
                  padding: const EdgeInsets.symmetric(horizontal: 14),
                  decoration: BoxDecoration(
                    color: WarmPearlColors.inputBg,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: WarmPearlColors.inputBorder,
                      width: 1,
                    ),
                  ),
                  child: TextField(
                    controller: titleCtrl,
                    style: const TextStyle(
                      fontFamily: WarmPearlTypography.bodyFont,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600,
                      color: WarmPearlColors.inkPrimary,
                    ),
                    decoration: const InputDecoration(
                      hintText: 'Tiêu đề nhắc việc...',
                      hintStyle: TextStyle(
                        color: WarmPearlColors.inkMuted,
                        fontSize: 13,
                      ),
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ),
                const SizedBox(height: 10),

                // Quick presets
                if (availablePresets.isNotEmpty) ...[
                  Row(
                    children: const [
                      Icon(
                        Icons.bolt_rounded,
                        size: 15,
                        color: WarmPearlColors.coralInk,
                      ),
                      SizedBox(width: 4),
                      Text(
                        'Gợi ý nhắc nhanh:',
                        style: TextStyle(
                          fontFamily: WarmPearlTypography.displayFont,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: WarmPearlColors.inkSecondary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: availablePresets.map((preset) {
                      final isActive = activePresetId == preset.id;
                      return GestureDetector(
                        onTap: () {
                          setDlgState(() {
                            activePresetId = preset.id;
                            selectedDate = preset.calculateTargetDate();
                          });
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 5,
                          ),
                          decoration: BoxDecoration(
                            color: isActive
                                ? WarmPearlColors.coralSoft
                                : Colors.white.withValues(alpha: 0.65),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: isActive
                                  ? WarmPearlColors.coralBorder
                                  : WarmPearlColors.glassBorder,
                            ),
                          ),
                          child: Text(
                            preset.label,
                            style: TextStyle(
                              fontFamily: WarmPearlTypography.bodyFont,
                              fontSize: 11.5,
                              fontWeight:
                                  isActive ? FontWeight.w700 : FontWeight.w600,
                              color: isActive
                                  ? WarmPearlColors.coralInk
                                  : WarmPearlColors.inkSecondary,
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 12),
                ],

                // Date Time Picker Row
                GestureDetector(
                  onTap: () async {
                    final pickedDate = await showDatePicker(
                      context: ctx,
                      initialDate: selectedDate,
                      firstDate: DateTime.now().subtract(const Duration(days: 1)),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (pickedDate != null && ctx.mounted) {
                      final pickedTime = await showTimePicker(
                        context: ctx,
                        initialTime: TimeOfDay.fromDateTime(selectedDate),
                      );
                      if (pickedTime != null) {
                        setDlgState(() {
                          activePresetId = null;
                          selectedDate = DateTime(
                            pickedDate.year,
                            pickedDate.month,
                            pickedDate.day,
                            pickedTime.hour,
                            pickedTime.minute,
                          );
                        });
                      }
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 14,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.75),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: WarmPearlColors.glassBorder),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.event_rounded,
                          size: 18,
                          color: WarmPearlColors.coralInk,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          'Thời gian: ${DateFormat('dd/MM/yyyy HH:mm').format(selectedDate.toLocal())}',
                          style: const TextStyle(
                            fontFamily: WarmPearlTypography.displayFont,
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: WarmPearlColors.inkPrimary,
                          ),
                        ),
                        const Spacer(),
                        const Icon(
                          Icons.edit_calendar_rounded,
                          size: 16,
                          color: WarmPearlColors.inkMuted,
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 10),

                // Google Calendar Sync Switch
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.75),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: WarmPearlColors.glassBorder),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.calendar_month_rounded,
                        size: 18,
                        color: Color(0xFF1A73E8),
                      ),
                      const SizedBox(width: 8),
                      const Expanded(
                        child: Text(
                          'Đồng bộ lên Google Calendar',
                          style: TextStyle(
                            fontFamily: WarmPearlTypography.bodyFont,
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                            color: WarmPearlColors.inkPrimary,
                          ),
                        ),
                      ),
                      Switch.adaptive(
                        value: syncToGoogleCalendar,
                        onChanged: (val) {
                          setDlgState(() => syncToGoogleCalendar = val);
                        },
                        activeTrackColor: WarmPearlColors.mint,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                // Submit Button
                GestureDetector(
                  onTap: () async {
                    final title = titleCtrl.text.trim();
                    if (title.isEmpty) return;
                    Navigator.of(ctx).pop();

                    final studentId = session?.studentCode ?? '';

                    try {
                      final res = await ref.read(dioProvider).post(
                        '/api/v1/deadlines',
                        data: {
                          'student_id': studentId,
                          'title': title,
                          'course_code': courseCtrl.text.trim().isEmpty
                              ? null
                              : courseCtrl.text.trim(),
                          'description': descCtrl.text.trim(),
                          'due_date': selectedDate.toIso8601String(),
                          'notification_id': notif.id.toString(),
                          'item_type': 'REMINDER',
                          'sync_google_calendar': syncToGoogleCalendar,
                        },
                      );

                      ref.invalidate(deadlinesListProvider);

                      if (context.mounted) {
                        final isSynced = res.data['data']?['google_calendar_synced'] == true ||
                            res.data['google_calendar_synced'] == true;

                        if (isSynced) {
                          AppToast.showSuccess(
                            context,
                            '⏰ Đã thêm nhắc việc và tự động đồng bộ Google Calendar',
                            actionLabel: 'Xem ngay',
                            onAction: () =>
                                context.go('/deadlines?scope=personal'),
                          );
                        } else if (syncToGoogleCalendar) {
                          AppToast.showInfo(
                            context,
                            '⏰ Đã lưu nhắc việc. (Lưu ý: Chưa liên kết Google Calendar trong Cài đặt)',
                            actionLabel: 'Kết nối',
                            onAction: () => context.go('/profile'),
                          );
                        } else {
                          AppToast.showSuccess(
                            context,
                            '⏰ Đã thêm nhắc nhở: "$title"',
                            actionLabel: 'Xem ngay',
                            onAction: () =>
                                context.go('/deadlines?scope=personal'),
                          );
                        }
                      }
                    } catch (err) {
                      if (context.mounted) {
                        AppToast.showError(
                          context,
                          'Lỗi thêm nhắc nhở: $err',
                        );
                      }
                    }
                  },
                  child: Container(
                    height: 46,
                    decoration: BoxDecoration(
                      gradient: WarmPearlGradients.coralButton,
                      borderRadius: BorderRadius.circular(999),
                      boxShadow: const [
                        BoxShadow(
                          color: WarmPearlColors.coralGlow,
                          blurRadius: 16,
                          offset: Offset(0, 5),
                        ),
                      ],
                    ),
                    alignment: Alignment.center,
                    child: const Text(
                      'Lưu nhắc việc',
                      style: TextStyle(
                        fontFamily: WarmPearlTypography.displayFont,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    ),
  ),
),
);
}
