import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/network/api_client.dart';
import '../../../core/presentation/app_toast.dart';
import '../../../core/presentation/empty_glass_card.dart';
import '../../../core/presentation/warm_pearl_tokens.dart';
import '../../auth/presentation/auth_controller.dart';
import '../domain/course_item.dart';
import 'course_detail_sheet.dart';

final enrolledCoursesProvider = FutureProvider<List<CourseItem>>((ref) async {
  final dio = ref.watch(dioProvider);
  final authState = ref.watch(authControllerProvider);
  final studentCode = authState.session?.studentCode ?? '';

  if (studentCode.isEmpty) return const <CourseItem>[];

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

  // GEMINI.md Rule 1: Tuyệt đối không mock, trả về danh sách rỗng nếu không có dữ liệu
  return const <CourseItem>[];
});

class EnrolledCoursesScreen extends ConsumerStatefulWidget {
  const EnrolledCoursesScreen({super.key});

  @override
  ConsumerState<EnrolledCoursesScreen> createState() =>
      _EnrolledCoursesScreenState();
}

class _EnrolledCoursesScreenState extends ConsumerState<EnrolledCoursesScreen> {
  bool _isSyncing = false;

  Future<void> _handleSync() async {
    if (_isSyncing) return;
    setState(() => _isSyncing = true);
    final authState = ref.read(authControllerProvider);
    final studentCode = authState.session?.studentCode ?? '';
    final dio = ref.read(dioProvider);

    try {
      await dio.post(
        '/api/v1/dut/sync-courses',
        data: {'student_id': studentCode},
      );
      if (mounted) {
        AppToast.showSuccess(
          context,
          'Đã cập nhật danh sách học phần từ sv.dut.udn.vn',
        );
      }
    } catch (_) {
      if (mounted) {
        AppToast.showError(
          context,
          'Không thể kết nối cổng sv.dut.udn.vn để đồng bộ',
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
    final session = ref.watch(authControllerProvider).session;

    return RefreshIndicator(
      onRefresh: _handleSync,
      color: WarmPearlColors.coralFrom,
      backgroundColor: Colors.white,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        padding: const EdgeInsets.fromLTRB(14, 6, 14, 120),
        children: [
          coursesAsync.when(
            loading: () => const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: CircularProgressIndicator(color: WarmPearlColors.coralFrom),
              ),
            ),
            error: (err, stack) => EmptyGlassCard(
              icon: Icons.sync_problem_rounded,
              title: 'Lỗi tải danh sách học phần',
              description: 'Vui lòng kiểm tra kết nối mạng và thử lại.',
              actionLabel: 'Thử lại ngay',
              onAction: _handleSync,
            ),
            data: (courses) {
              if (courses.isEmpty) {
                return EmptyGlassCard(
                  orbitalMode: true,
                  icon: Icons.school_rounded,
                  title: 'Chưa có dữ liệu học phần',
                  description:
                      'Học kỳ hiện tại chưa có thông tin học phần từ sv.dut.udn.vn',
                  actionLabel: 'Đồng bộ học phần ngay',
                  isActionLoading: _isSyncing,
                  onAction: _handleSync,
                );
              }

              final className = session?.className.isNotEmpty == true
                  ? session!.className
                  : 'Lớp sinh hoạt';

              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Semester Summary Glass Card
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: WarmPearlColors.glassBgStrong,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: WarmPearlColors.glassBorderStrong,
                        width: 1,
                      ),
                      boxShadow: WarmPearlShadows.glassSm,
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 44,
                          height: 44,
                          decoration: BoxDecoration(
                            color: WarmPearlColors.coralSoft,
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: WarmPearlColors.coralBorder),
                          ),
                          child: const Icon(
                            Icons.school_rounded,
                            color: WarmPearlColors.coralInk,
                            size: 24,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '${courses.length} học phần đang theo học',
                                style: const TextStyle(
                                  fontFamily: WarmPearlTypography.displayFont,
                                  fontSize: 15,
                                  fontWeight: FontWeight.w800,
                                  color: WarmPearlColors.inkPrimary,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '$className • Học kỳ 1 (2026-2027)',
                                style: const TextStyle(
                                  fontFamily: WarmPearlTypography.bodyFont,
                                  fontSize: 11.5,
                                  color: WarmPearlColors.inkSecondary,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            color: WarmPearlColors.mintSoft,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: WarmPearlColors.mintBorder),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: const [
                              Icon(
                                Icons.check_circle_rounded,
                                size: 12,
                                color: WarmPearlColors.mint,
                              ),
                              SizedBox(width: 4),
                              Text(
                                'Đã đồng bộ',
                                style: TextStyle(
                                  fontFamily: WarmPearlTypography.displayFont,
                                  fontSize: 10.5,
                                  fontWeight: FontWeight.w700,
                                  color: WarmPearlColors.mint,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 14),

                  // 2-Column Bento Course Grid
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 10,
                      mainAxisSpacing: 10,
                      childAspectRatio: 0.88,
                    ),
                    itemCount: courses.length,
                    itemBuilder: (context, index) {
                      final course = courses[index];
                      final tint = CourseTint.values[index % CourseTint.values.length];
                      return _buildCourseBentoTile(context, course, tint);
                    },
                  ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildCourseBentoTile(
    BuildContext context,
    CourseItem course,
    CourseTint tint,
  ) {
    final (badgeBg, badgeBorder, badgeText) = switch (tint) {
      CourseTint.coral => (
          WarmPearlColors.coralSoft,
          WarmPearlColors.coralBorder,
          WarmPearlColors.coralInk
        ),
      CourseTint.mint => (
          WarmPearlColors.mintSoft,
          WarmPearlColors.mintBorder,
          WarmPearlColors.mint
        ),
      CourseTint.violet => (
          WarmPearlColors.violetSoft,
          WarmPearlColors.violetBorder,
          WarmPearlColors.violet
        ),
      CourseTint.amber => (
          WarmPearlColors.amberTint,
          const Color(0x4DF59E0B),
          WarmPearlColors.amber
        ),
    };

    return GestureDetector(
      onTap: () => showCourseDetailSheet(context, course),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: WarmPearlColors.glassBgStrong,
          gradient: WarmPearlGradients.courseRadialTint(tint),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: WarmPearlColors.glassBorderStrong,
            width: 1,
          ),
          boxShadow: WarmPearlShadows.glassSm,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Code badge + Unread tag
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                  decoration: BoxDecoration(
                    color: badgeBg,
                    borderRadius: BorderRadius.circular(7),
                    border: Border.all(color: badgeBorder),
                  ),
                  child: Text(
                    course.courseCode,
                    style: TextStyle(
                      fontFamily: WarmPearlTypography.displayFont,
                      fontSize: 10.5,
                      fontWeight: FontWeight.w700,
                      color: badgeText,
                    ),
                  ),
                ),
                const Spacer(),
                if (course.unreadCount > 0)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: WarmPearlColors.coralSoft,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: WarmPearlColors.coralBorder),
                    ),
                    child: Text(
                      '${course.unreadCount} mới',
                      style: const TextStyle(
                        fontFamily: WarmPearlTypography.displayFont,
                        fontSize: 9.5,
                        fontWeight: FontWeight.w700,
                        color: WarmPearlColors.coralInk,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 8),

            // Course Name
            Expanded(
              child: Text(
                course.courseName,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontFamily: WarmPearlTypography.displayFont,
                  fontSize: 13,
                  fontWeight: FontWeight.w800,
                  height: 1.25,
                  color: WarmPearlColors.inkPrimary,
                ),
              ),
            ),

            const Divider(height: 12, color: WarmPearlColors.glassDivider),

            // Lecturer footer
            Row(
              children: [
                const Icon(
                  Icons.person_outline_rounded,
                  size: 13,
                  color: WarmPearlColors.inkMuted,
                ),
                const SizedBox(width: 4),
                Expanded(
                  child: Text(
                    course.lecturerName?.isNotEmpty == true
                        ? course.lecturerName!
                        : 'DUT',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontFamily: WarmPearlTypography.bodyFont,
                      fontSize: 10.5,
                      fontWeight: FontWeight.w600,
                      color: WarmPearlColors.inkSecondary,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
