import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/api_client.dart';
import '../../../core/presentation/liquid_glass.dart';
import '../../auth/presentation/auth_controller.dart';
import '../domain/deadline_item.dart';

final deadlinesListProvider = FutureProvider<List<DeadlineItem>>((ref) async {
  final dio = ref.watch(dioProvider);
  final authState = ref.watch(authControllerProvider);
  final studentCode = authState.session?.studentCode ?? '';

  if (studentCode.isEmpty) return const <DeadlineItem>[];

  try {
    final res = await dio.get(
      '/api/v1/deadlines',
      queryParameters: {'student_id': studentCode},
    );
    final rawList = res.data['data'] as List<dynamic>? ?? [];
    if (rawList.isNotEmpty) {
      return rawList.map((item) {
        final m = item as Map<String, dynamic>;
        return DeadlineItem(
          deadlineId: (m['deadline_id'] ?? m['id'] ?? '').toString(),
          studentId: (m['student_id'] ?? studentCode).toString(),
          notificationId: m['notification_id']?.toString(),
          courseCode: m['course_code']?.toString(),
          title: (m['title'] ?? 'Hạn chót học tập').toString(),
          description: m['description']?.toString(),
          dueDate: m['due_date'] != null
              ? DateTime.parse(m['due_date'].toString())
              : DateTime.now().add(const Duration(days: 3)),
          status: (m['status'] ?? 'PENDING').toString(),
          googleEventId: m['google_event_id']?.toString(),
        );
      }).toList();
    }
  } catch (_) {}

  // TUYỆT ĐỐI KHÔNG TẠO MOCK TASK / DỮ LIỆU GIẢ:
  // Nếu chưa có hạn chót thật do người dùng tạo hoặc từ thông báo bóc tách, trả về danh sách rỗng!
  return const <DeadlineItem>[];
});

class DeadlinesScreen extends ConsumerStatefulWidget {
  const DeadlinesScreen({super.key});

  @override
  ConsumerState<DeadlinesScreen> createState() => _DeadlinesScreenState();
}

class _DeadlinesScreenState extends ConsumerState<DeadlinesScreen> {
  String _selectedFilter = 'ALL';

  @override
  Widget build(BuildContext context) {
    final deadlinesAsync = ref.watch(deadlinesListProvider);
    final authState = ref.watch(authControllerProvider);
    final studentCode = authState.session?.studentCode ?? '';

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        children: [
          // Background Gradient
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
                // Header Bar Liquid Glass
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
                              'Hạn chót & Nhắc việc',
                              style: TextStyle(
                                fontSize: 20,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF0F172A),
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Dữ liệu thực tế • Không tạo task giả lập',
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
                              tooltip: 'Đồng bộ Google Calendar (OAuth 2.0)',
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

                // Bộ lọc trạng thái Liquid Glass
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

                // Danh sách Deadlines
                Expanded(
                  child: deadlinesAsync.when(
                    loading: () => const Center(child: CircularProgressIndicator()),
                    error: (err, stack) => Center(child: Text('Lỗi tải deadlines: $err')),
                    data: (deadlines) {
                      var filtered = deadlines.where((d) => d.notificationId != null && d.notificationId!.isNotEmpty).toList();
                      if (_selectedFilter == 'DUE_SOON') {
                        filtered = filtered.where((d) => d.status == 'DUE_SOON').toList();
                      } else if (_selectedFilter == 'PENDING') {
                        filtered = filtered.where((d) => d.status != 'COMPLETED').toList();
                      } else if (_selectedFilter == 'COMPLETED') {
                        filtered = filtered.where((d) => d.status == 'COMPLETED').toList();
                      }

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
                                      color: const Color(0xFF007AFF).withValues(alpha: 0.12),
                                      shape: BoxShape.circle,
                                    ),
                                    child: const Icon(
                                      Icons.notifications_active_outlined,
                                      size: 34,
                                      color: Color(0xFF007AFF),
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
                                    'Mỗi nhắc việc và hạn chót phải luôn gắn liền với một thông báo từ nhà trường, khoa hoặc lớp học phần.\n\nHãy vào tab "Bảng tin", chọn thông báo cần lưu và bấm nút "⏰ Thêm nhắc nhở".',
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
                                      tooltip: 'Xóa hạn chót',
                                      onPressed: () => _deleteDeadline(item.deadlineId),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  item.title,
                                  style: const TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                    color: Color(0xFF0F172A),
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
                                          'Hạn: ${DateFormat('dd/MM/yyyy HH:mm').format(item.dueDate)}',
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
                                      ),
                                  ],
                                ),
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
                                  child: InkWell(
                                    borderRadius: BorderRadius.circular(10),
                                    onTap: () => _addToGoogleCalendar(item),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                                      decoration: BoxDecoration(
                                        color: item.googleEventId != null
                                            ? const Color(0xFF34C759).withValues(alpha: 0.1)
                                            : const Color(0xFF4285F4).withValues(alpha: 0.08),
                                        borderRadius: BorderRadius.circular(10),
                                        border: Border.all(
                                          color: item.googleEventId != null
                                              ? const Color(0xFF34C759).withValues(alpha: 0.3)
                                              : const Color(0xFF4285F4).withValues(alpha: 0.25),
                                        ),
                                      ),
                                      child: Row(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Icon(
                                            item.googleEventId != null
                                                ? Icons.event_available_rounded
                                                : Icons.edit_calendar_rounded,
                                            size: 16,
                                            color: item.googleEventId != null
                                                ? const Color(0xFF2E7D32)
                                                : const Color(0xFF1A73E8),
                                          ),
                                          const SizedBox(width: 6),
                                          Text(
                                            item.googleEventId != null
                                                ? 'Đã thêm vào Google Calendar • Mở xem ↗'
                                                : 'Thêm vào Google Calendar ↗',
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600,
                                              color: item.googleEventId != null
                                                  ? const Color(0xFF2E7D32)
                                                  : const Color(0xFF1A73E8),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
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
            ? [const Color(0xFF007AFF), const Color(0xFF0051D5)]
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Đã hoàn thành: $title'),
            backgroundColor: const Color(0xFF34C759),
          ),
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

  Future<void> _deleteDeadline(String deadlineId) async {
    try {
      final dio = ref.read(dioProvider);
      await dio.delete('/api/v1/deadlines/$deadlineId');
      ref.invalidate(deadlinesListProvider);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã xóa hạn chót thành công')),
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

  String _formatGCalDate(DateTime dt) {
    final utc = dt.toUtc();
    return DateFormat("yyyyMMdd'T'HHmmss'Z'").format(utc);
  }

  Future<void> _addToGoogleCalendar(DeadlineItem item) async {
    final startDate = item.dueDate;
    final endDate = startDate.add(const Duration(hours: 1));
    final startStr = _formatGCalDate(startDate);
    final endStr = _formatGCalDate(endDate);

    final details = StringBuffer();
    if (item.description != null && item.description!.isNotEmpty) {
      details.writeln(item.description);
      details.writeln();
    }
    if (item.courseCode != null && item.courseCode!.isNotEmpty) {
      details.writeln('Mã học phần: ${item.courseCode}');
    }
    details.writeln('Hệ thống Thông báo Sinh viên DUT (sv.dut.udn.vn)');

    final gcalUri = Uri.https('calendar.google.com', '/calendar/render', {
      'action': 'TEMPLATE',
      'text': item.title,
      'dates': '$startStr/$endStr',
      'details': details.toString(),
    });

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
    } catch (_) {}

    try {
      await launchUrl(gcalUri, mode: LaunchMode.externalApplication);
    } catch (_) {
      await launchUrl(gcalUri);
    }

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Đang mở Google Calendar để thêm: ${item.title}'),
          backgroundColor: const Color(0xFF1A73E8),
          duration: const Duration(seconds: 3),
        ),
      );
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Đã đồng bộ $count sự kiện với Google Calendar'),
            backgroundColor: const Color(0xFF1A73E8),
          ),
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

  void _showGoogleCalendarModal() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
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
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFFE8F0FE),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF1A73E8).withValues(alpha: 0.3)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.check_circle_rounded, color: Color(0xFF1A73E8), size: 18),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Sẵn sàng tiếp nhận Google Authentication (Client ID / Secret).',
                      style: TextStyle(fontSize: 12, color: Color(0xFF174EA6), fontWeight: FontWeight.w500),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            const Text(
              'Tính năng thêm vào Google Calendar:',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: Color(0xFF0F172A)),
            ),
            const SizedBox(height: 4),
            const Text(
              '• Mỗi nhắc việc trên danh sách đều có nút "Thêm vào Google Calendar" để thêm nhanh 1-chạm vào lịch Google cá nhân.\n• Khi cung cấp Google Authentication, hệ thống sẽ tự động đồng bộ hóa đa thiết bị qua Google Calendar API.',
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
            label: const Text('Đồng bộ tất cả'),
            onPressed: () {
              Navigator.pop(ctx);
              _syncAllToGoogleCalendar();
            },
          ),
        ],
      ),
    );
  }
}
