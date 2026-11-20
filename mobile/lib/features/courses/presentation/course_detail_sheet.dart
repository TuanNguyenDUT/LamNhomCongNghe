import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/presentation/warm_pearl_tokens.dart';
import '../../notifications/presentation/notification_providers.dart';
import '../domain/course_item.dart';

/// Shows the Warm Pearl Liquid Glass Course Detail Bottom Sheet.
Future<void> showCourseDetailSheet(BuildContext context, CourseItem course) {
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (context) => Align(
      alignment: Alignment.bottomCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 720),
        child: CourseDetailSheet(course: course),
      ),
    ),
  );
}

class CourseDetailSheet extends ConsumerWidget {
  const CourseDetailSheet({super.key, required this.course});

  final CourseItem course;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Container(
      padding: const EdgeInsets.fromLTRB(18, 12, 18, 28),
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

          // Course Code & Semester Row
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                decoration: BoxDecoration(
                  color: WarmPearlColors.violetSoft,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: WarmPearlColors.violetBorder),
                ),
                child: Text(
                  course.courseCode,
                  style: const TextStyle(
                    fontFamily: WarmPearlTypography.displayFont,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: WarmPearlColors.violet,
                  ),
                ),
              ),
              const Spacer(),
              Text(
                course.semester,
                style: const TextStyle(
                  fontFamily: WarmPearlTypography.bodyFont,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: WarmPearlColors.inkMuted,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // Course Name
          Text(
            course.courseName,
            style: const TextStyle(
              fontFamily: WarmPearlTypography.displayFont,
              fontSize: 18,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.3,
              color: WarmPearlColors.inkPrimary,
            ),
          ),
          const SizedBox(height: 16),

          // Detail rows in glass box
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.75),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: WarmPearlColors.glassBorder),
            ),
            child: Column(
              children: [
                _buildInfoRow(
                  icon: Icons.person_outline_rounded,
                  label: 'Giảng viên',
                  value: course.lecturerName?.isNotEmpty == true
                      ? course.lecturerName!
                      : 'Đang cập nhật',
                ),
                const Divider(height: 18, color: WarmPearlColors.glassDivider),
                _buildInfoRow(
                  icon: Icons.schedule_rounded,
                  label: 'Lịch học',
                  value: course.scheduleInfo?.isNotEmpty == true
                      ? course.scheduleInfo!
                      : 'Đang cập nhật',
                ),
                const Divider(height: 18, color: WarmPearlColors.glassDivider),
                _buildInfoRow(
                  icon: Icons.mark_chat_unread_outlined,
                  label: 'Thông báo mới',
                  value: '${course.unreadCount} tin chưa đọc',
                  valueColor: course.unreadCount > 0
                      ? WarmPearlColors.coralInk
                      : WarmPearlColors.inkSecondary,
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Action buttons
          Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => Navigator.of(context).pop(),
                  child: Container(
                    height: 44,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.8),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: WarmPearlColors.glassBorderStrong),
                    ),
                    alignment: Alignment.center,
                    child: const Text(
                      'Đóng',
                      style: TextStyle(
                        fontFamily: WarmPearlTypography.displayFont,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: WarmPearlColors.inkPrimary,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                flex: 2,
                child: GestureDetector(
                  onTap: () {
                    Navigator.of(context).pop();
                    ref
                        .read(selectedCourseFilterProvider.notifier)
                        .setFilter(
                          courseCode: course.courseCode,
                          courseName: course.courseName,
                        );
                    context.go('/notifications');
                  },
                  child: Container(
                    height: 44,
                    decoration: BoxDecoration(
                      gradient: WarmPearlGradients.coralButton,
                      borderRadius: BorderRadius.circular(999),
                      boxShadow: const [
                        BoxShadow(
                          color: WarmPearlColors.coralGlow,
                          blurRadius: 16,
                          offset: Offset(0, 6),
                        ),
                      ],
                    ),
                    alignment: Alignment.center,
                    child: const Text(
                      'Xem tin lớp học phần',
                      style: TextStyle(
                        fontFamily: WarmPearlTypography.displayFont,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildInfoRow({
    required IconData icon,
    required String label,
    required String value,
    Color? valueColor,
  }) {
    return Row(
      children: [
        Icon(icon, size: 18, color: WarmPearlColors.inkMuted),
        const SizedBox(width: 10),
        Text(
          label,
          style: const TextStyle(
            fontFamily: WarmPearlTypography.bodyFont,
            fontSize: 12.5,
            color: WarmPearlColors.inkSecondary,
          ),
        ),
        const Spacer(),
        Flexible(
          child: Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.end,
            style: TextStyle(
              fontFamily: WarmPearlTypography.displayFont,
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: valueColor ?? WarmPearlColors.inkPrimary,
            ),
          ),
        ),
      ],
    );
  }
}
