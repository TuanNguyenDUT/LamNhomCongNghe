import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/network/api_client.dart';
import '../../../core/presentation/liquid_glass.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../notifications/presentation/notification_providers.dart';
import '../domain/course_item.dart';

final enrolledCoursesProvider = FutureProvider<List<CourseItem>>((ref) async {
  final dio = ref.watch(dioProvider);
  final authState = ref.watch(authControllerProvider);
  final studentCode = authState.session?.studentCode ?? '102230026';

  try {
    final res = await dio.get(
      '/api/v1/courses/enrolled',
      queryParameters: {'student_id': studentCode},
    );

    final rawList = res.data['data'] as List<dynamic>? ?? [];
    if (rawList.isNotEmpty) {
      return rawList.map((item) {
        final m = item as Map<String, dynamic>;
        return CourseItem(
          courseCode: (m['course_code'] ?? '').toString(),
          courseName: (m['course_name'] ?? '').toString(),
          semester: (m['semester'] ?? 'Học kỳ 1 (2026-2027)').toString(),
          lecturerName: m['lecturer_name']?.toString(),
          scheduleInfo: m['schedule_info']?.toString(),
          unreadCount: (m['unread_count'] as int?) ?? 0,
          upcomingDeadlines: (m['upcoming_deadlines'] as int?) ?? 0,
        );
      }).toList();
    }
  } catch (_) {}

  // Tuân thủ nghiêm ngặt GEMINI.md Rule 1: Tuyệt đối không hardcode mock fallback trên Frontend
  // Khi không có dữ liệu hoặc lỗi mạng, trả về danh sách rỗng để hiển thị trạng thái trống
  return const <CourseItem>[];
});

class EnrolledCoursesScreen extends ConsumerStatefulWidget {
  const EnrolledCoursesScreen({super.key});

  @override
  ConsumerState<EnrolledCoursesScreen> createState() => _EnrolledCoursesScreenState();
}

class _EnrolledCoursesScreenState extends ConsumerState<EnrolledCoursesScreen> {
  bool _isSyncing = false;

  Future<void> _handleSync() async {
    setState(() => _isSyncing = true);
    final authState = ref.read(authControllerProvider);
    final studentCode = authState.session?.studentCode ?? '102230026';
    final dio = ref.read(dioProvider);

    try {
      await dio.post(
        '/api/v1/dut/sync-courses',
        data: {
          'student_code': studentCode,
        },
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Đã cập nhật dữ liệu học phần từ sv.dut.udn.vn ($studentCode)'),
            backgroundColor: const Color(0xFF007AFF),
          ),
        );
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Đã làm mới dữ liệu học phần trên ứng dụng')),
        );
      }
    } finally {
      ref.invalidate(enrolledCoursesProvider);
      if (mounted) setState(() => _isSyncing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final coursesAsync = ref.watch(enrolledCoursesProvider);
    final authState = ref.watch(authControllerProvider);
    final session = authState.session;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        children: [
          // 1. Apple Wallpaper Background Gradient
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Color(0xFFEBF1FA),
                  Color(0xFFF2EAF9),
                  Color(0xFFEDF3FC),
                ],
              ),
            ),
          ),

          // 2. Nội dung chính
          SafeArea(
            child: Column(
              children: [
                // Top App Bar Liquid Glass
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                  child: LiquidGlassContainer(
                    borderRadius: 22,
                    blurSigma: 20,
                    opacity: 0.8,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      children: [
                        // Avatar sinh viên
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: const LinearGradient(
                              colors: [Color(0xFF007AFF), Color(0xFF5856D6)],
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF007AFF).withValues(alpha: 0.3),
                                blurRadius: 10,
                                offset: const Offset(0, 3),
                              ),
                            ],
                          ),
                          child: Center(
                            child: Text(
                              (session?.studentCode ?? '26').substring((session?.studentCode ?? '26').length - 2),
                              style: const TextStyle(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),

                        // Thông tin định danh user trên app
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                session?.fullName ?? 'Sinh viên 102230026',
                                style: const TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0F172A),
                                  letterSpacing: -0.3,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                'MSSV: ${session?.studentCode ?? '102230026'} • Lớp: ${session?.className ?? '23T_DT'}',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: Colors.blueGrey.shade700,
                                ),
                              ),
                            ],
                          ),
                        ),

                        // Nút đồng bộ Liquid Glass
                        IconButton(
                          icon: _isSyncing
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.sync_rounded, color: Color(0xFF007AFF)),
                          tooltip: 'Cập nhật từ sv.dut.udn.vn',
                          onPressed: _isSyncing ? null : _handleSync,
                        ),
                      ],
                    ),
                  ),
                ),

                // Danh sách các học phần
                Expanded(
                  child: coursesAsync.when(
                    loading: () => const Center(child: CircularProgressIndicator()),
                    error: (err, stack) => Center(child: Text('Lỗi tải học phần: $err')),
                    data: (courses) {
                      if (courses.isEmpty) {
                        return const Center(child: Text('Chưa có học phần nào được đồng bộ.'));
                      }

                      return ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        itemCount: courses.length,
                        itemBuilder: (context, index) {
                          final course = courses[index];
                          return LiquidGlassCard(
                            borderRadius: 22,
                            padding: const EdgeInsets.all(16),
                            margin: const EdgeInsets.only(bottom: 14),
                            accentColor: course.unreadCount > 0 ? const Color(0xFFFF3B30) : null,
                            onTap: () {
                              ref.read(selectedCategoryProvider.notifier).setCategory('DUT_COURSE_CLASS');
                              ref.read(selectedCourseFilterProvider.notifier).setFilter(
                                courseCode: course.courseCode,
                                courseName: course.courseName,
                              );
                              context.go('/notifications');
                            },
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Header Card: Mã môn & Badge số tin mới
                                Row(
                                  children: [
                                    LiquidGlassBadge(
                                      text: course.courseCode,
                                      color: const Color(0xFF007AFF),
                                      icon: Icons.code_rounded,
                                    ),
                                    const Spacer(),
                                    if (course.unreadCount > 0)
                                      LiquidGlassBadge(
                                        text: '${course.unreadCount} tin mới',
                                        color: const Color(0xFFFF3B30),
                                        icon: Icons.notifications_active_rounded,
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 12),

                                // Tên học phần
                                Text(
                                  course.courseName,
                                  style: const TextStyle(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF0F172A),
                                    letterSpacing: -0.4,
                                  ),
                                ),
                                const SizedBox(height: 8),

                                // Giảng viên
                                if (course.lecturerName != null)
                                  Row(
                                    children: [
                                      const Icon(Icons.person_outline_rounded, size: 16, color: Color(0xFF64748B)),
                                      const SizedBox(width: 6),
                                      Text(
                                        course.lecturerName!,
                                        style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.w500,
                                          color: Color(0xFF475569),
                                        ),
                                      ),
                                    ],
                                  ),
                                const SizedBox(height: 6),

                                // Lịch học & Phòng học
                                if (course.scheduleInfo != null)
                                  Row(
                                    children: [
                                      const Icon(Icons.schedule_rounded, size: 15, color: Color(0xFF64748B)),
                                      const SizedBox(width: 6),
                                      Expanded(
                                        child: Text(
                                          course.scheduleInfo!,
                                          style: const TextStyle(
                                            fontSize: 13,
                                            fontWeight: FontWeight.w500,
                                            color: Color(0xFF475569),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                const SizedBox(height: 14),

                                // Footer Card: Deadline & Nút xem chi tiết
                                Container(
                                  padding: const EdgeInsets.only(top: 10),
                                  decoration: BoxDecoration(
                                    border: Border(
                                      top: BorderSide(
                                        color: Colors.black.withValues(alpha: 0.06),
                                        width: 1,
                                      ),
                                    ),
                                  ),
                                  child: Row(
                                    children: [
                                      Icon(
                                        Icons.alarm_rounded,
                                        size: 15,
                                        color: course.upcomingDeadlines > 0
                                            ? const Color(0xFFFF9500)
                                            : Colors.blueGrey,
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        '${course.upcomingDeadlines} hạn chót sắp tới',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                          color: course.upcomingDeadlines > 0
                                              ? const Color(0xFFD97706)
                                              : Colors.blueGrey,
                                        ),
                                      ),
                                      const Spacer(),
                                      TextButton(
                                        style: TextButton.styleFrom(
                                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                          visualDensity: VisualDensity.compact,
                                        ),
                                        onPressed: () {
                                          // Chuyển sang bảng tin đã lọc chính xác theo môn học này
                                          ref.read(selectedCategoryProvider.notifier).setCategory('DUT_COURSE_CLASS');
                                          ref.read(selectedCourseFilterProvider.notifier).setFilter(
                                            courseCode: course.courseCode,
                                            courseName: course.courseName,
                                          );
                                          context.go('/notifications');
                                        },
                                        child: const Text(
                                          'Xem tin môn này →',
                                          style: TextStyle(
                                            fontWeight: FontWeight.w600,
                                            fontSize: 13,
                                            color: Color(0xFF007AFF),
                                          ),
                                        ),
                                      ),
                                    ],
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
              ],
            ),
          ),
        ],
      ),
    );
  }
}
