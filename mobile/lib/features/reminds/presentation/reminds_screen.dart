import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/api_client.dart';
import '../../../core/presentation/liquid_glass.dart';
import '../../../core/presentation/app_toast.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../deadlines/domain/deadline_item.dart';
import '../../deadlines/presentation/deadlines_screen.dart';

class RemindsScreen extends ConsumerStatefulWidget {
  const RemindsScreen({super.key});

  @override
  ConsumerState<RemindsScreen> createState() => _RemindsScreenState();
}

class _RemindsScreenState extends ConsumerState<RemindsScreen> {
  String _selectedFilter = 'ALL';

  @override
  Widget build(BuildContext context) {
    final deadlinesAsync = ref.watch(deadlinesListProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        children: [
          // Background Gradient Apple Wallpaper style
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0xFFEAF1FB),
                  Color(0xFFF1EBF9),
                  Color(0xFFEBF3FC),
                ],
              ),
            ),
          ),

          SafeArea(
            child: Column(
              children: [
                // 1. Header Bar Liquid Glass
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: LiquidGlassContainer(
                    borderRadius: 24,
                    blurSigma: 20,
                    opacity: 0.85,
                    padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Quản lý Nhắc việc',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Nhắc nhở cá nhân • Tích hợp Google Calendar',
                              style: TextStyle(
                                fontSize: 12,
                                color: Color(0xFF64748B),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                        Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.calendar_month_rounded, color: Color(0xFF1A73E8), size: 22),
                              tooltip: 'Google Calendar OAuth 2.0',
                              onPressed: () => _showGoogleCalendarModal(),
                            ),
                            IconButton(
                              icon: const Icon(Icons.sync_rounded, color: Color(0xFF64748B), size: 22),
                              tooltip: 'Làm mới',
                              onPressed: () => ref.invalidate(deadlinesListProvider),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

                // 2. Toolbar Google Calendar Sync (OAuth 2.0)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 4),
                  child: LiquidGlassContainer(
                    borderRadius: 16,
                    blurSigma: 16,
                    opacity: 0.9,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1A73E8).withValues(alpha: 0.12),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.calendar_month_rounded, color: Color(0xFF1A73E8), size: 18),
                        ),
                        const SizedBox(width: 10),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Google Calendar Sync',
                                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                              ),
                              Text(
                                'OAuth 2.0 • Tự động đồng bộ các Remind cá nhân',
                                style: TextStyle(fontSize: 10, color: Color(0xFF64748B)),
                              ),
                            ],
                          ),
                        ),
                        TextButton.icon(
                          style: TextButton.styleFrom(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            backgroundColor: const Color(0xFF1A73E8).withValues(alpha: 0.1),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          icon: const Icon(Icons.sync_rounded, size: 14, color: Color(0xFF1A73E8)),
                          label: const Text(
                            'Đồng bộ tất cả',
                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF1A73E8)),
                          ),
                          onPressed: () => _syncAllToGoogleCalendar(),
                        ),
                        const SizedBox(width: 4),
                        IconButton(
                          icon: const Icon(Icons.settings_outlined, size: 18, color: Color(0xFF64748B)),
                          tooltip: 'Cài đặt liên kết Google',
                          onPressed: () => _showGoogleCalendarModal(),
                        ),
                      ],
                    ),
                  ),
                ),

                // 3. Bộ lọc trạng thái Liquid Glass
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: Row(
                    children: [
                      _buildFilterChip('ALL', 'Tất cả'),
                      const SizedBox(width: 8),
                      _buildFilterChip('DUE_SOON', '⏳ Sắp đến hạn'),
                      const SizedBox(width: 8),
                      _buildFilterChip('PENDING', 'Chờ xử lý'),
                      const SizedBox(width: 8),
                      _buildFilterChip('COMPLETED', 'Đã xong'),
                    ],
                  ),
                ),

                // 4. Danh sách các Remind cá nhân
                Expanded(
                  child: deadlinesAsync.when(
                    loading: () => const Center(child: CircularProgressIndicator()),
                    error: (err, stack) => Center(child: Text('Lỗi tải dữ liệu: $err')),
                    data: (deadlines) {
                      // Chỉ lấy các mục là REMINDER do sinh viên chủ động tạo
                      final remindsList = deadlines.where((d) => d.isReminder).toList();

                      // Áp dụng bộ lọc trạng thái
                      var filtered = remindsList;
                      if (_selectedFilter == 'DUE_SOON') {
                        filtered = filtered.where((d) => d.status == 'DUE_SOON').toList();
                      } else if (_selectedFilter == 'PENDING') {
                        filtered = filtered.where((d) => d.status != 'COMPLETED').toList();
                      } else if (_selectedFilter == 'COMPLETED') {
                        filtered = filtered.where((d) => d.status == 'COMPLETED').toList();
                      }

                      // Giao diện khi danh sách trống
                      if (filtered.isEmpty) {
                        return Center(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 28),
                            child: LiquidGlassContainer(
                              borderRadius: 24,
                              blurSigma: 20,
                              opacity: 0.88,
                              padding: const EdgeInsets.all(24),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Container(
                                    width: 64,
                                    height: 64,
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFFF9500).withValues(alpha: 0.12),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.alarm_on_rounded,
                                      size: 34,
                                      color: Color(0xFFFF9500),
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                  const Text(
                                    'Chưa có nhắc việc nào',
                                    style: TextStyle(
                                      fontSize: 18,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF0F172A),
                                      letterSpacing: -0.3,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  const Text(
                                    'Mỗi nhắc việc phải luôn gắn liền với một thông báo gốc từ nhà trường hoặc giảng viên.\n\nHãy vào tab "Bảng tin", chọn thông báo cần lưu và bấm nút "⏰ Thêm nhắc nhở".',
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: Color(0xFF64748B),
                                      height: 1.4,
                                    ),
                                  ),
                                  const SizedBox(height: 18),
                                  LiquidGlassButton(
                                    label: '📢 Đi đến Bảng tin thông báo',
                                    onPressed: () => context.go('/notifications'),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        );
                      }

                      return ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        itemCount: filtered.length,
                        itemBuilder: (context, index) {
                          final item = filtered[index];
                          final isOverdue = item.isOverdue;
                          final isDueSoon = item.isDueSoon;

                          return LiquidGlassCard(
                            borderRadius: 22,
                            padding: const EdgeInsets.all(16),
                            margin: const EdgeInsets.only(bottom: 12),
                            accentColor: isOverdue
                                ? const Color(0xFFFF3B30)
                                : (isDueSoon ? const Color(0xFFFF9500) : null),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    if (item.courseCode != null)
                                      LiquidGlassBadge(
                                        text: item.courseCode!,
                                        icon: Icons.school_rounded,
                                        color: const Color(0xFF5856D6),
                                      )
                                    else
                                      const LiquidGlassBadge(
                                        text: 'Nhắc việc cá nhân',
                                        icon: Icons.alarm_rounded,
                                        color: Color(0xFFFF9500),
                                      ),
                                    const Spacer(),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: _getStatusColor(item.status).withValues(alpha: 0.15),
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Text(
                                        _getStatusText(item.status),
                                        style: TextStyle(
                                          color: _getStatusColor(item.status),
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                    IconButton(
                                      icon: const Icon(Icons.delete_outline_rounded, size: 20, color: Color(0xFF94A3B8)),
                                      tooltip: 'Xóa nhắc việc',
                                      onPressed: () => _deleteDeadline(item.deadlineId),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  item.title,
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    decoration: item.isCompleted ? TextDecoration.lineThrough : null,
                                    color: item.isCompleted ? const Color(0xFF94A3B8) : const Color(0xFF0F172A),
                                  ),
                                ),
                                if (item.description != null && item.description!.isNotEmpty) ...[
                                  const SizedBox(height: 4),
                                  Text(
                                    item.description!,
                                    style: const TextStyle(
                                      fontSize: 13,
                                      color: Color(0xFF475569),
                                    ),
                                  ),
                                ],
                                if (item.notificationId != null && item.notificationId!.isNotEmpty) ...[
                                  const SizedBox(height: 8),
                                  InkWell(
                                    onTap: () => context.push('/notifications/${item.notificationId}'),
                                    borderRadius: BorderRadius.circular(8),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFF007AFF).withValues(alpha: 0.08),
                                        borderRadius: BorderRadius.circular(8),
                                        border: Border.all(color: const Color(0xFF007AFF).withValues(alpha: 0.2)),
                                      ),
                                      child: const Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(Icons.campaign_outlined, size: 16, color: Color(0xFF007AFF)),
                                          SizedBox(width: 6),
                                          Text(
                                            'Gắn liền thông báo từ Bản tin',
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600,
                                              color: Color(0xFF007AFF),
                                            ),
                                          ),
                                          SizedBox(width: 4),
                                          Icon(Icons.arrow_forward_ios_rounded, size: 11, color: Color(0xFF007AFF)),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                                const SizedBox(height: 12),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Row(
                                      children: [
                                        Icon(
                                          Icons.calendar_today_rounded,
                                          size: 14,
                                          color: isOverdue ? const Color(0xFFFF3B30) : const Color(0xFF64748B),
                                        ),
                                        const SizedBox(width: 4),
                                        Text(
                                          'Nhắc vào: ${DateFormat('dd/MM/yyyy HH:mm').format(item.dueDate)}',
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                            color: isOverdue ? const Color(0xFFFF3B30) : const Color(0xFF64748B),
                                          ),
                                        ),
                                      ],
                                    ),
                                    if (item.status != 'COMPLETED')
                                      TextButton.icon(
                                        icon: const Icon(Icons.check_circle_outline_rounded, size: 18, color: Color(0xFF34C759)),
                                        label: const Text(
                                          'Hoàn thành',
                                          style: TextStyle(color: Color(0xFF34C759), fontWeight: FontWeight.bold),
                                        ),
                                        onPressed: () => _markCompleted(item.deadlineId, item.title),
                                      )
                                    else
                                      const Row(
                                        children: [
                                          Icon(Icons.check_circle_rounded, size: 16, color: Color(0xFF34C759)),
                                          SizedBox(width: 4),
                                          Text(
                                            'Đã hoàn thành',
                                            style: TextStyle(color: Color(0xFF34C759), fontSize: 12, fontWeight: FontWeight.bold),
                                          ),
                                        ],
                                      ),
                                  ],
                                ),

                                // Nút Tự động thêm vào Google Calendar & Xóa khỏi Google Calendar
                                const SizedBox(height: 10),
                                Container(
                                  padding: const EdgeInsets.only(top: 8),
                                  decoration: BoxDecoration(
                                    border: Border(
                                      top: BorderSide(
                                        color: Colors.black.withValues(alpha: 0.06),
                                        width: 1,
                                      ),
                                    ),
                                  ),
                                  child: item.googleEventId != null
                                      ? Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFE8F5E9),
                                            borderRadius: BorderRadius.circular(10),
                                            border: Border.all(
                                              color: const Color(0xFF34C759).withValues(alpha: 0.4),
                                            ),
                                          ),
                                          child: Row(
                                            children: [
                                              const Icon(
                                                Icons.check_circle_rounded,
                                                size: 16,
                                                color: Color(0xFF2E7D32),
                                              ),
                                              const SizedBox(width: 6),
                                              const Expanded(
                                                child: Text(
                                                  'Đã lưu Google Calendar',
                                                  style: TextStyle(
                                                    fontSize: 12,
                                                    fontWeight: FontWeight.w600,
                                                    color: Color(0xFF2E7D32),
                                                  ),
                                                ),
                                              ),
                                              InkWell(
                                                borderRadius: BorderRadius.circular(8),
                                                onTap: () => _removeFromGoogleCalendar(item),
                                                child: Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFFFEE2E2),
                                                    borderRadius: BorderRadius.circular(8),
                                                    border: Border.all(
                                                      color: const Color(0xFFEF4444).withValues(alpha: 0.35),
                                                    ),
                                                  ),
                                                  child: const Row(
                                                    mainAxisSize: MainAxisSize.min,
                                                    children: [
                                                      Icon(
                                                        Icons.event_busy_rounded,
                                                        size: 14,
                                                        color: Color(0xFFDC2626),
                                                      ),
                                                      SizedBox(width: 4),
                                                      Text(
                                                        'Xóa khỏi lịch',
                                                        style: TextStyle(
                                                          fontSize: 11,
                                                          fontWeight: FontWeight.bold,
                                                          color: Color(0xFFDC2626),
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        )
                                      : (item.status == 'COMPLETED'
                                          ? Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                              decoration: BoxDecoration(
                                                color: const Color(0xFFF8FAFC),
                                                borderRadius: BorderRadius.circular(10),
                                                border: Border.all(
                                                  color: const Color(0xFFE2E8F0),
                                                ),
                                              ),
                                              child: const Row(
                                                mainAxisAlignment: MainAxisAlignment.center,
                                                children: [
                                                  Icon(
                                                    Icons.event_available_rounded,
                                                    size: 14,
                                                    color: Color(0xFF64748B),
                                                  ),
                                                  SizedBox(width: 6),
                                                  Text(
                                                    'Đã hoàn thành • Đã gỡ khỏi lịch Google Calendar',
                                                    style: TextStyle(
                                                      fontSize: 11,
                                                      color: Color(0xFF64748B),
                                                      fontWeight: FontWeight.w500,
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            )
                                          : InkWell(
                                              borderRadius: BorderRadius.circular(10),
                                              onTap: () => _addToGoogleCalendar(item),
                                              child: Container(
                                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFF4285F4).withValues(alpha: 0.08),
                                                  borderRadius: BorderRadius.circular(10),
                                                  border: Border.all(
                                                    color: const Color(0xFF4285F4).withValues(alpha: 0.25),
                                                  ),
                                                ),
                                                child: const Row(
                                                  mainAxisAlignment: MainAxisAlignment.center,
                                                  children: [
                                                    Icon(
                                                      Icons.edit_calendar_rounded,
                                                      size: 16,
                                                      color: Color(0xFF1A73E8),
                                                    ),
                                                    SizedBox(width: 6),
                                                    Text(
                                                      'Thêm vào Google Calendar',
                                                      style: TextStyle(
                                                        fontSize: 12,
                                                        fontWeight: FontWeight.w600,
                                                        color: Color(0xFF1A73E8),
                                                      ),
                                                    ),
                                                  ],
                                                ),
                                              ),
                                            )),
                                ),
                              ],
                            ),
                          );
                        },
                      );
                    },
                  ),
                ),

                // Spacing for floating Bottom Navigation Bar
                const SizedBox(height: 90),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterChip(String code, String label) {
    final isSelected = _selectedFilter == code;
    return GestureDetector(
      onTap: () => setState(() => _selectedFilter = code),
      child: LiquidGlassContainer(
        borderRadius: 18,
        blurSigma: 12,
        opacity: isSelected ? 0.9 : 0.5,
        gradientColors: isSelected
            ? [const Color(0xFFFF9500), const Color(0xFFE65100)]
            : null,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: isSelected ? Colors.white : const Color(0xFF334155),
          ),
        ),
      ),
    );
  }

  String _getStatusText(String status) {
    switch (status) {
      case 'DUE_SOON':
        return 'Sắp đến hạn';
      case 'OVERDUE':
        return 'Quá hạn';
      case 'COMPLETED':
        return 'Đã xong';
      default:
        return 'Chờ làm';
    }
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'DUE_SOON':
        return const Color(0xFFFF9500);
      case 'OVERDUE':
        return const Color(0xFFFF3B30);
      case 'COMPLETED':
        return const Color(0xFF34C759);
      default:
        return const Color(0xFF007AFF);
    }
  }

  Future<void> _markCompleted(String deadlineId, String title) async {
    try {
      final dio = ref.read(dioProvider);
      await dio.put(
        '/api/v1/deadlines/$deadlineId',
        data: {'status': 'COMPLETED'},
      );
      ref.invalidate(deadlinesListProvider);
      if (mounted) {
        AppToast.showSuccess(
          context,
          'Đã hoàn thành: $title (Tự động gỡ khỏi Google Calendar nếu có)',
          duration: const Duration(seconds: 2),
        );
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi cập nhật: $err')),
        );
      }
    }
  }

  Future<void> _removeFromGoogleCalendar(DeadlineItem item) async {
    try {
      final dio = ref.read(dioProvider);
      final authState = ref.read(authControllerProvider);
      final studentCode = authState.session?.studentCode ?? item.studentId;

      await dio.post(
        '/api/v1/calendar/google/delete-event',
        data: {
          'student_id': studentCode,
          'deadline_id': item.deadlineId,
        },
      );

      ref.invalidate(deadlinesListProvider);

      if (mounted) {
        AppToast.show(
          context,
          message: 'Đã xóa sự kiện khỏi Google Calendar: "${item.title}"',
          icon: const Icon(Icons.event_busy_rounded, color: Colors.white, size: 20),
          backgroundColor: const Color(0xFFDC2626),
          duration: const Duration(seconds: 2),
        );
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Lỗi xóa khỏi Google Calendar: $err'),
            backgroundColor: const Color(0xFFD32F2F),
          ),
        );
      }
    }
  }

  Future<void> _deleteDeadline(String deadlineId) async {
    try {
      final dio = ref.read(dioProvider);
      await dio.delete('/api/v1/deadlines/$deadlineId');
      ref.invalidate(deadlinesListProvider);
      if (mounted) {
        AppToast.showSuccess(
          context,
          'Đã xóa nhắc việc (và đã gỡ khỏi Google Calendar)',
          duration: const Duration(seconds: 2),
        );
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi xóa: $err')),
        );
      }
    }
  }

  Future<void> _addToGoogleCalendar(DeadlineItem item) async {
    try {
      final dio = ref.read(dioProvider);
      final authState = ref.read(authControllerProvider);
      final studentCode = authState.session?.studentCode ?? item.studentId;

      await dio.post(
        '/api/v1/calendar/google/sync',
        data: {
          'student_id': studentCode,
          'deadline_id': item.deadlineId,
        },
      );

      ref.invalidate(deadlinesListProvider);

      if (mounted) {
        AppToast.showSuccess(
          context,
          'Đã tự động lưu vào Google Calendar: "${item.title}"',
          duration: const Duration(seconds: 2),
        );
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Lỗi thêm vào Google Calendar: $err'),
            backgroundColor: const Color(0xFFD32F2F),
          ),
        );
      }
    }
  }

  Future<void> _syncAllToGoogleCalendar() async {
    final authState = ref.read(authControllerProvider);
    final studentCode = authState.session?.studentCode ?? '102230026';
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.post(
        '/api/v1/calendar/google/sync',
        data: {'student_id': studentCode},
      );
      ref.invalidate(deadlinesListProvider);
      final count = res.data['data']?['synced_count'] ?? 0;
      if (mounted) {
        AppToast.showInfo(
          context,
          'Đã đồng bộ $count sự kiện Remind với Google Calendar',
          duration: const Duration(seconds: 2),
        );
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi đồng bộ Google Calendar: $err')),
        );
      }
    }
  }

  Future<void> _connectGoogleCalendar() async {
    final authState = ref.read(authControllerProvider);
    final studentCode = authState.session?.studentCode ?? '102230026';
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.get(
        '/api/v1/calendar/google/auth-url',
        queryParameters: {'student_id': studentCode},
      );
      final url = res.data['data']?['url']?.toString();
      if (url != null && url.isNotEmpty) {
        final uri = Uri.parse(url);
        try {
          await launchUrl(uri, mode: LaunchMode.externalApplication, webOnlyWindowName: '_blank');
        } catch (_) {
          await launchUrl(uri);
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Không thể tạo URL ủy quyền Google Calendar')),
          );
        }
      }
    } catch (err) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Lỗi kết nối Google: $err')),
        );
      }
    }
  }

  Future<Map<String, dynamic>> _fetchGoogleStatus() async {
    final authState = ref.read(authControllerProvider);
    final studentCode = authState.session?.studentCode ?? '102230026';
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.get(
        '/api/v1/calendar/google/status',
        queryParameters: {'student_id': studentCode},
      );
      return (res.data['data'] as Map<String, dynamic>?) ?? {};
    } catch (_) {
      return {};
    }
  }

  void _showGoogleCalendarModal() {
    showDialog(
      context: context,
      builder: (ctx) => FutureBuilder<Map<String, dynamic>>(
        future: _fetchGoogleStatus(),
        builder: (context, snapshot) {
          final isConnected = snapshot.data?['is_connected'] == true;
          final isConfigured = snapshot.data?['configured'] ?? true;

          return AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
            title: const Row(
              children: [
                Icon(Icons.calendar_month_rounded, color: Color(0xFF1A73E8), size: 24),
                SizedBox(width: 10),
                Text('Google Calendar (OAuth 2.0)', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ],
            ),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Trạng thái tích hợp:',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isConnected ? const Color(0xFFE8F5E9) : const Color(0xFFE8F0FE),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isConnected
                          ? const Color(0xFF34C759).withValues(alpha: 0.3)
                          : const Color(0xFF1A73E8).withValues(alpha: 0.3),
                    ),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        isConnected ? Icons.check_circle_rounded : Icons.lock_open_rounded,
                        color: isConnected ? const Color(0xFF2E7D32) : const Color(0xFF1A73E8),
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          isConnected
                              ? 'Đã liên kết Google Calendar thành công! Các sự kiện Remind sẽ tự động đồng bộ.'
                              : (isConfigured
                                  ? 'Đã cấu hình Google OAuth Client. Nhấn nút bên dưới để ủy quyền tài khoản Google.'
                                  : 'Chưa cấu hình Google Client Credentials.'),
                          style: TextStyle(
                            fontSize: 12,
                            color: isConnected ? const Color(0xFF1B5E20) : const Color(0xFF174EA6),
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),
                if (!isConnected && isConfigured) ...[
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF1A73E8),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      icon: const Icon(Icons.login_rounded, size: 18),
                      label: const Text(
                        'Ủy quyền tài khoản Google',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      onPressed: () {
                        Navigator.pop(ctx);
                        _connectGoogleCalendar();
                      },
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                const Text(
                  'Quy tắc đồng bộ Google Calendar:',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: 4),
                const Text(
                  '• CHỈ các mục Remind (Nhắc việc cá nhân) mới có nút "Thêm vào Google Calendar" và được phép đồng bộ lên tài khoản Google.\n• Hạn chót học vụ của nhà trường là thông tin chính quy phục vụ theo dõi học tập, không đồng bộ tràn lan vào lịch cá nhân.',
                  style: TextStyle(fontSize: 12, color: Color(0xFF475569), height: 1.4),
                ),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Đóng'),
              ),
              ElevatedButton.icon(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF1A73E8),
                  foregroundColor: Colors.white,
                ),
                icon: const Icon(Icons.sync_rounded, size: 16),
                label: const Text('Đồng bộ Reminds'),
                onPressed: () {
                  Navigator.pop(ctx);
                  _syncAllToGoogleCalendar();
                },
              ),
            ],
          );
        },
      ),
    );
  }
}
