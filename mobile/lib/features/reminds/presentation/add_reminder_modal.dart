import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/network/api_client.dart';
import '../../../core/presentation/app_toast.dart';
import '../../notifications/domain/notification_item.dart';
import 'quick_reminder_preferences_provider.dart';

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

  // Mặc định chọn mốc +1 ngày hoặc deadline của thông báo nếu có
  DateTime selectedDate = notif.deadlineAt ?? DateTime.now().add(const Duration(days: 1));
  String? activePresetId = notif.deadlineAt != null ? null : '1_day';
  bool syncToGoogleCalendar = prefs.autoSyncGoogleCalendarByDefault;

  // Lấy danh sách các options được người dùng bật trong Profile
  final availablePresets = kAvailableQuickPresets
      .where((p) => prefs.enabledOptionIds.contains(p.id))
      .toList();

  await showDialog(
    context: context,
    builder: (ctx) => StatefulBuilder(
      builder: (ctx, setDlgState) => AlertDialog(
        backgroundColor: Colors.white.withValues(alpha: 0.98),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFFFF9500).withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.alarm_add_rounded, color: Color(0xFFFF9500), size: 22),
            ),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'Thêm Nhắc Nhở',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 18,
                  color: Color(0xFF0F172A),
                ),
              ),
            ),
          ],
        ),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              TextField(
                controller: titleCtrl,
                decoration: InputDecoration(
                  labelText: 'Tiêu đề nhắc nhở *',
                  hintText: 'Nhập tiêu đề nhắc nhở',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 12),
              if (notif.courseCode != null &&
                  notif.courseCode!.trim().isNotEmpty &&
                  notif.sourceChannel != 'FB_CTSV' &&
                  notif.sourceChannel != 'FB_TUVAN_SV' &&
                  notif.sourceChannel != 'DUT_GENERAL' &&
                  notif.sourceChannel != 'DUT_STUDENT_AFFAIRS') ...[
                TextField(
                  controller: courseCtrl,
                  decoration: InputDecoration(
                    labelText: 'Mã học phần',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              TextField(
                controller: descCtrl,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: 'Ghi chú chi tiết',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 14),

              // 1. CÁC TÙY CHỌN NHẮC NHỞ NHANH (QUICK REMINDER PRESETS)
              if (availablePresets.isNotEmpty) ...[
                Row(
                  children: [
                    const Icon(Icons.flash_on_rounded, size: 16, color: Color(0xFFFF9500)),
                    const SizedBox(width: 4),
                    const Text(
                      'Gợi ý nhắc nhanh:',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF475569),
                      ),
                    ),
                    const Spacer(),
                    Text(
                      'Tùy chỉnh trong Profile',
                      style: TextStyle(
                        fontSize: 10,
                        color: const Color(0xFF007AFF).withValues(alpha: 0.8),
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: availablePresets.map((preset) {
                    final isActive = activePresetId == preset.id;
                    return InkWell(
                      borderRadius: BorderRadius.circular(10),
                      onTap: () {
                        setDlgState(() {
                          activePresetId = preset.id;
                          selectedDate = preset.calculateTargetDate();
                        });
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: isActive
                              ? const Color(0xFFFF9500).withValues(alpha: 0.2)
                              : const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(
                            color: isActive
                                ? const Color(0xFFFF9500)
                                : const Color(0xFFCBD5E1),
                            width: isActive ? 1.5 : 1,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (isActive)
                              const Padding(
                                padding: EdgeInsets.only(right: 4),
                                child: Icon(
                                  Icons.check_circle_rounded,
                                  size: 13,
                                  color: Color(0xFFFF9500),
                                ),
                              ),
                            Text(
                              preset.label,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: isActive ? FontWeight.bold : FontWeight.w500,
                                color: isActive
                                    ? const Color(0xFFB45309)
                                    : const Color(0xFF334155),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
                const SizedBox(height: 12),
              ],

              // 2. NGÀY & GIỜ NHẮC NHỞ HIỆN TẠI (DATE PICKER ROW)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFCBD5E1)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.event_rounded, size: 20, color: Color(0xFF007AFF)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        DateFormat('dd/MM/yyyy HH:mm').format(selectedDate),
                        style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                      ),
                    ),
                    TextButton.icon(
                      icon: const Icon(Icons.edit_calendar_rounded, size: 16),
                      label: const Text('Đổi ngày', style: TextStyle(fontSize: 12)),
                      onPressed: () async {
                        final d = await showDatePicker(
                          context: ctx,
                          initialDate: selectedDate,
                          firstDate: DateTime.now().subtract(const Duration(days: 1)),
                          lastDate: DateTime.now().add(const Duration(days: 365)),
                        );
                        if (d != null && ctx.mounted) {
                          final t = await showTimePicker(
                            context: ctx,
                            initialTime: TimeOfDay.fromDateTime(selectedDate),
                          );
                          setDlgState(() {
                            activePresetId = null; // Hủy preset khi chọn ngày thủ công
                            selectedDate = DateTime(
                              d.year,
                              d.month,
                              d.day,
                              t?.hour ?? selectedDate.hour,
                              t?.minute ?? selectedDate.minute,
                            );
                          });
                        }
                      },
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 12),

              // 3. TÍCH CHỌN ĐỒNG BỘ LÊN GOOGLE CALENDAR
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: syncToGoogleCalendar
                      ? const Color(0xFFE8F0FE)
                      : const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: syncToGoogleCalendar
                        ? const Color(0xFF4285F4).withValues(alpha: 0.4)
                        : const Color(0xFFE2E8F0),
                  ),
                ),
                child: InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: () {
                    setDlgState(() {
                      syncToGoogleCalendar = !syncToGoogleCalendar;
                    });
                  },
                  child: Row(
                    children: [
                      Checkbox(
                        value: syncToGoogleCalendar,
                        activeColor: const Color(0xFF1A73E8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                        onChanged: (val) {
                          setDlgState(() {
                            syncToGoogleCalendar = val ?? false;
                          });
                        },
                      ),
                      const Icon(Icons.edit_calendar_rounded, size: 18, color: Color(0xFF1A73E8)),
                      const SizedBox(width: 8),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Đồng bộ lên Google Calendar',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF1E293B),
                              ),
                            ),
                            Text(
                              'Tự động thêm vào lịch cá nhân ngay khi tạo',
                              style: TextStyle(
                                fontSize: 10,
                                color: Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Hủy', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton.icon(
            icon: const Icon(Icons.check_rounded, size: 18),
            label: const Text('Lưu nhắc nhở'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF007AFF),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            onPressed: () async {
              final title = titleCtrl.text.trim();
              if (title.isEmpty) return;
              Navigator.of(ctx).pop();

              try {
                final studentId = session?.studentCode ?? '102230026';
                await ref.read(dioProvider).post(
                  '/api/v1/deadlines',
                  data: {
                    'student_id': studentId,
                    'title': title,
                    'course_code': courseCtrl.text.trim().isEmpty ? null : courseCtrl.text.trim(),
                    'description': descCtrl.text.trim(),
                    'due_date': selectedDate.toIso8601String(),
                    'notification_id': notif.id.toString(),
                    'item_type': 'REMINDER',
                    'sync_google_calendar': syncToGoogleCalendar,
                  },
                );

                if (context.mounted) {
                  final successMsg = syncToGoogleCalendar
                      ? '⏰ Đã thêm nhắc nhở và tự động đồng bộ Google Calendar: "$title"'
                      : '⏰ Đã thêm nhắc nhở: "$title"';
                  AppToast.showSuccess(
                    context,
                    successMsg,
                    duration: const Duration(seconds: 2),
                    actionLabel: 'Xem Nhắc việc',
                    onAction: () => context.go('/reminds'),
                  );
                }
              } catch (err) {
                if (context.mounted) {
                  AppToast.showError(
                    context,
                    'Lỗi thêm nhắc nhở: $err',
                    duration: const Duration(seconds: 2),
                  );
                }
              }
            },
          ),
        ],
      ),
    ),
  );
}
