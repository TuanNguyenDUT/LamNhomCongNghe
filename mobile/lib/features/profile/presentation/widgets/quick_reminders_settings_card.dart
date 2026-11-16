import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../core/presentation/app_toast.dart';
import '../../../../core/presentation/liquid_glass.dart';
import '../../../reminds/presentation/quick_reminder_preferences_provider.dart';

class QuickRemindersSettingsCard extends ConsumerStatefulWidget {
  const QuickRemindersSettingsCard({super.key});

  @override
  ConsumerState<QuickRemindersSettingsCard> createState() => _QuickRemindersSettingsCardState();
}

class _QuickRemindersSettingsCardState extends ConsumerState<QuickRemindersSettingsCard> {
  late List<String> _selectedOptions;
  late bool _autoSyncGoogle;
  bool _initialized = false;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _selectedOptions = [];
    _autoSyncGoogle = true;
  }

  void _syncStateWithProvider(QuickReminderPreferencesState state) {
    if (!_initialized) {
      _selectedOptions = List<String>.from(state.enabledOptionIds);
      _autoSyncGoogle = state.autoSyncGoogleCalendarByDefault;
      _initialized = true;
    }
  }

  @override
  Widget build(BuildContext context) {
    final prefsState = ref.watch(quickReminderPreferencesProvider);
    _syncStateWithProvider(prefsState);

    return LiquidGlassContainer(
      borderRadius: 20,
      blurSigma: 20,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFF9500).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(
                    Icons.alarm_on_rounded,
                    color: Color(0xFFFF9500),
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Cấu hình Nhắc nhở Nhanh',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Tùy chỉnh gợi ý thời gian & đồng bộ Google Calendar',
                        style: TextStyle(
                          fontSize: 12,
                          color: Color(0xFF64748B),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            const SizedBox(height: 18),
            const Divider(height: 1, color: Color(0xFFE2E8F0)),
            const SizedBox(height: 14),

            // Toggle Google Calendar default sync
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: _autoSyncGoogle ? const Color(0xFFE8F0FE) : const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                  color: _autoSyncGoogle
                      ? const Color(0xFF4285F4).withValues(alpha: 0.35)
                      : const Color(0xFFE2E8F0),
                ),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.edit_calendar_rounded,
                    size: 22,
                    color: Color(0xFF1A73E8),
                  ),
                  const SizedBox(width: 10),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Mặc định đồng bộ Google Calendar',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF1E293B),
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Tự động tích chọn gửi vào Google Calendar khi thêm nhắc nhở',
                          style: TextStyle(
                            fontSize: 11,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Switch(
                    value: _autoSyncGoogle,
                    activeTrackColor: const Color(0xFF1A73E8),
                    onChanged: (val) {
                      setState(() {
                        _autoSyncGoogle = val;
                      });
                    },
                  ),
                ],
              ),
            ),

            const SizedBox(height: 16),

            // Quick presets selection
            const Text(
              'Các mốc nhắc nhở nhanh hiển thị trong hộp thoại:',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF334155),
              ),
            ),
            const SizedBox(height: 8),

            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: kAvailableQuickPresets.map((preset) {
                final isSelected = _selectedOptions.contains(preset.id);
                return FilterChip(
                  selected: isSelected,
                  label: Text(preset.label),
                  labelStyle: TextStyle(
                    fontSize: 12,
                    fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                    color: isSelected ? const Color(0xFF0F172A) : const Color(0xFF475569),
                  ),
                  avatar: Icon(
                    isSelected ? Icons.check_circle_rounded : Icons.add_circle_outline_rounded,
                    size: 16,
                    color: isSelected ? const Color(0xFFFF9500) : const Color(0xFF94A3B8),
                  ),
                  backgroundColor: Colors.white,
                  selectedColor: const Color(0xFFFF9500).withValues(alpha: 0.18),
                  checkmarkColor: const Color(0xFFFF9500),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(10),
                    side: BorderSide(
                      color: isSelected
                          ? const Color(0xFFFF9500).withValues(alpha: 0.6)
                          : const Color(0xFFCBD5E1),
                    ),
                  ),
                  onSelected: (val) {
                    setState(() {
                      if (val) {
                        if (!_selectedOptions.contains(preset.id)) {
                          _selectedOptions.add(preset.id);
                        }
                      } else {
                        if (_selectedOptions.length > 1) {
                          _selectedOptions.remove(preset.id);
                        } else {
                          AppToast.showInfo(context, 'Cần giữ lại ít nhất 1 mốc nhắc nhở nhanh');
                        }
                      }
                    });
                  },
                );
              }).toList(),
            ),

            const SizedBox(height: 18),

            // Save button
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: _isSaving
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.save_rounded, size: 18),
                label: Text(
                  _isSaving ? 'Đang lưu...' : 'Lưu cấu hình nhắc việc',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF007AFF),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: _isSaving
                    ? null
                    : () async {
                        setState(() {
                          _isSaving = true;
                        });
                        final success = await ref
                            .read(quickReminderPreferencesProvider.notifier)
                            .savePreferences(
                              enabledOptionIds: _selectedOptions,
                              autoSyncGoogleCalendarByDefault: _autoSyncGoogle,
                            );
                        if (!context.mounted) return;
                        setState(() {
                          _isSaving = false;
                        });
                        if (success) {
                          AppToast.showSuccess(
                            context,
                            'Đã lưu cấu hình nhắc nhở nhanh thành công!',
                          );
                        } else {
                          AppToast.showError(
                            context,
                            'Lỗi lưu cấu hình nhắc nhở',
                          );
                        }
                      },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
