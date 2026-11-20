import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/network/api_client.dart';
import '../../../core/presentation/app_toast.dart';
import '../../../core/presentation/empty_glass_card.dart';
import '../../../core/presentation/warm_pearl_tokens.dart';
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
        return DeadlineItem.fromJson(item as Map<String, dynamic>);
      }).toList();
    }
  } catch (_) {}

  // GEMINI.md Rule 1: Tuyệt đối không tạo mock task / fake deadlines
  return const <DeadlineItem>[];
});

class DeadlinesScreen extends ConsumerStatefulWidget {
  const DeadlinesScreen({super.key});

  @override
  ConsumerState<DeadlinesScreen> createState() => _DeadlinesScreenState();
}

class _DeadlinesScreenState extends ConsumerState<DeadlinesScreen> {
  String _selectedScope = 'all'; // 'all' | 'academic' | 'personal'
  String _selectedStatus = 'ALL'; // 'ALL' | 'DUE_SOON' | 'PENDING' | 'COMPLETED'

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    try {
      // Parse ?scope= query param from URI if present
      final uri = GoRouterState.of(context).uri;
      final scopeParam = uri.queryParameters['scope'];
      if (scopeParam != null &&
          ['all', 'academic', 'personal'].contains(scopeParam)) {
        _selectedScope = scopeParam;
      }
    } catch (_) {}
  }

  Future<void> _toggleTaskStatus(DeadlineItem item) async {
    final newStatus = item.isCompleted ? 'PENDING' : 'COMPLETED';

    try {
      final dio = ref.read(dioProvider);
      await dio.put(
        '/api/v1/deadlines/${item.deadlineId}',
        data: {'status': newStatus},
      );
      ref.invalidate(deadlinesListProvider);

      if (mounted) {
        AppToast.showSuccess(
          context,
          newStatus == 'COMPLETED'
              ? 'Đã hoàn thành: "${item.title}"'
              : 'Đã chuyển sang chưa hoàn thành',
        );
      }
    } catch (_) {
      if (mounted) {
        AppToast.showError(context, 'Lỗi cập nhật trạng thái hạn chót');
      }
    }
  }

  Future<void> _deleteReminder(DeadlineItem item) async {
    try {
      final dio = ref.read(dioProvider);
      await dio.delete('/api/v1/deadlines/${item.deadlineId}');
      ref.invalidate(deadlinesListProvider);

      if (mounted) {
        AppToast.showSuccess(context, 'Đã xóa nhắc việc cá nhân');
      }
    } catch (_) {
      if (mounted) {
        AppToast.showError(context, 'Lỗi khi xóa nhắc việc');
      }
    }
  }

  Future<void> _syncSingleGoogleCalendar(DeadlineItem item) async {
    final session = ref.read(authControllerProvider).session;
    final studentId = session?.studentCode ?? '';

    try {
      final dio = ref.read(dioProvider);
      if (item.googleEventId != null) {
        await dio.post(
          '/api/v1/calendar/google/delete-event',
          data: {
            'student_id': studentId,
            'deadline_id': item.deadlineId,
          },
        );
        if (mounted) {
          AppToast.showSuccess(context, 'Đã gỡ khỏi Google Calendar');
        }
      } else {
        await dio.post(
          '/api/v1/calendar/google/sync-event',
          data: {
            'student_id': studentId,
            'deadline_id': item.deadlineId,
          },
        );
        if (mounted) {
          AppToast.showSuccess(context, 'Đã đồng bộ lên Google Calendar');
        }
      }
      ref.invalidate(deadlinesListProvider);
    } catch (e) {
      if (mounted) {
        String msg = 'Tài khoản chưa liên kết Google Calendar';
        if (e is DioException && e.response?.data is Map) {
          final serverMsg = e.response?.data['message']?.toString();
          if (serverMsg != null && serverMsg.isNotEmpty) {
            msg = serverMsg;
          }
        }
        AppToast.showError(
          context,
          msg,
          actionLabel: 'Kết nối',
          onAction: () => context.go('/profile'),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final deadlinesAsync = ref.watch(deadlinesListProvider);

    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(deadlinesListProvider),
      color: WarmPearlColors.coralFrom,
      backgroundColor: Colors.white,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        padding: const EdgeInsets.fromLTRB(14, 6, 14, 120),
        children: [
          // Section Top Row: Title + Calendar Settings ghost link
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text(
                    'Hạn & Nhắc việc',
                    style: TextStyle(
                      fontFamily: WarmPearlTypography.displayFont,
                      fontSize: 19,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.3,
                      color: WarmPearlColors.inkPrimary,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Hạn chót học vụ & nhắc nhở cá nhân',
                    style: TextStyle(
                      fontFamily: WarmPearlTypography.bodyFont,
                      fontSize: 11.5,
                      color: WarmPearlColors.inkMuted,
                    ),
                  ),
                ],
              ),
              GestureDetector(
                onTap: () => context.go('/profile?tab=settings&focus=gcal'),
                child: Container(
                  height: 34,
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.75),
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: WarmPearlColors.glassBorderStrong,
                    ),
                    boxShadow: WarmPearlShadows.glassSm,
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      Icon(
                        Icons.calendar_month_rounded,
                        size: 14,
                        color: WarmPearlColors.mint,
                      ),
                      SizedBox(width: 5),
                      Text(
                        'Cài đặt lịch',
                        style: TextStyle(
                          fontFamily: WarmPearlTypography.displayFont,
                          fontSize: 11.5,
                          fontWeight: FontWeight.w700,
                          color: WarmPearlColors.inkPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),

          const SizedBox(height: 12),

          // 3-Segment Switcher (Tất cả | Hạn học vụ | Nhắc cá nhân)
          Container(
            height: 42,
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              color: WarmPearlColors.segSwitcherBg,
              borderRadius: BorderRadius.circular(999),
              border: Border.all(
                color: WarmPearlColors.glassBorderStrong,
                width: 1,
              ),
              boxShadow: WarmPearlShadows.glassSm,
            ),
            child: Row(
              children: [
                _buildSegmentTab(
                  label: 'Tất cả',
                  scope: 'all',
                  lensGradient: WarmPearlGradients.coralButton,
                ),
                _buildSegmentTab(
                  label: 'Hạn học vụ',
                  scope: 'academic',
                  lensGradient: WarmPearlGradients.violetLens,
                ),
                _buildSegmentTab(
                  label: 'Nhắc cá nhân',
                  scope: 'personal',
                  lensGradient: WarmPearlGradients.coralButton,
                ),
              ],
            ),
          ),

          const SizedBox(height: 10),

          // 4 Status Filter Row
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            physics: const BouncingScrollPhysics(),
            child: Row(
              children: [
                _buildStatusChip('ALL', 'Tất cả'),
                const SizedBox(width: 6),
                _buildStatusChip('DUE_SOON', '⏳ Sắp đến hạn'),
                const SizedBox(width: 6),
                _buildStatusChip('PENDING', 'Chờ xử lý'),
                const SizedBox(width: 6),
                _buildStatusChip('COMPLETED', 'Đã xong'),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // Task List or Scope-Aware Empty States
          deadlinesAsync.when(
            loading: () => const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: CircularProgressIndicator(color: WarmPearlColors.coralFrom),
              ),
            ),
            error: (err, stack) => EmptyGlassCard(
              icon: Icons.sync_problem_rounded,
              title: 'Lỗi tải danh sách hạn chót',
              description: 'Vui lòng kiểm tra kết nối mạng và thử lại.',
              actionLabel: 'Tải lại',
              onAction: () => ref.invalidate(deadlinesListProvider),
            ),
            data: (allDeadlines) {
              // 1. Filter by Scope
              var list = allDeadlines;
              if (_selectedScope == 'academic') {
                list = list.where((d) => d.isAcademicDeadline).toList();
              } else if (_selectedScope == 'personal') {
                list = list.where((d) => d.isReminder).toList();
              }

              // 2. Filter by Status
              if (_selectedStatus == 'DUE_SOON') {
                list = list.where((d) => d.status == 'DUE_SOON').toList();
              } else if (_selectedStatus == 'PENDING') {
                list = list.where((d) => d.status != 'COMPLETED').toList();
              } else if (_selectedStatus == 'COMPLETED') {
                list = list.where((d) => d.status == 'COMPLETED').toList();
              }

              if (list.isEmpty) {
                if (_selectedScope == 'academic') {
                  return EmptyGlassCard(
                    icon: Icons.school_rounded,
                    title: 'Chưa có hạn chót học vụ',
                    description:
                        'Các hạn chót học vụ sẽ tự động được trích xuất từ các thông báo chính thức của nhà trường và giảng viên.',
                  );
                } else {
                  return EmptyGlassCard(
                    icon: Icons.alarm_rounded,
                    title: 'Chưa có nhắc việc cá nhân',
                    description:
                        'Nhắc việc luôn gắn liền với thông báo thật. Hãy vào Bảng tin, chọn thông báo và bấm "Thêm nhắc nhở".',
                    actionLabel: 'Đi đến Bảng tin thông báo',
                    onAction: () => context.go('/notifications'),
                  );
                }
              }

              return Column(
                children: list.map((item) => _buildTaskCard(item)).toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildSegmentTab({
    required String label,
    required String scope,
    required LinearGradient lensGradient,
  }) {
    final isActive = _selectedScope == scope;

    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedScope = scope),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 220),
          curve: WarmPearlMotion.spring,
          decoration: BoxDecoration(
            gradient: isActive ? lensGradient : null,
            borderRadius: BorderRadius.circular(999),
            boxShadow: isActive
                ? const [
                    BoxShadow(
                      color: Color(0x33182036),
                      blurRadius: 8,
                      offset: Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontFamily: WarmPearlTypography.displayFont,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: isActive ? Colors.white : WarmPearlColors.inkSecondary,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStatusChip(String code, String label) {
    final isSelected = _selectedStatus == code;

    return GestureDetector(
      onTap: () => setState(() => _selectedStatus = code),
      child: Container(
        height: 32,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: isSelected
              ? WarmPearlColors.coralSoft
              : Colors.white.withValues(alpha: 0.65),
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: isSelected
                ? WarmPearlColors.coralBorder
                : WarmPearlColors.glassBorder,
          ),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            fontFamily: WarmPearlTypography.bodyFont,
            fontSize: 11.5,
            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
            color: isSelected
                ? WarmPearlColors.coralInk
                : WarmPearlColors.inkSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildTaskCard(DeadlineItem item) {
    final isDone = item.isCompleted;

    return AnimatedOpacity(
      duration: const Duration(milliseconds: 200),
      opacity: isDone ? 0.62 : 1.0,
      child: Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: WarmPearlColors.glassBgStrong,
          borderRadius: BorderRadius.circular(22),
          border: Border.all(
            color: WarmPearlColors.glassBorderStrong,
            width: 1,
          ),
          boxShadow: WarmPearlShadows.glassSm,
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Interactive 24x24 Check Circle
            GestureDetector(
              onTap: () => _toggleTaskStatus(item),
              child: Container(
                width: 24,
                height: 24,
                margin: const EdgeInsets.only(top: 2),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isDone
                      ? WarmPearlColors.mintBright
                      : Colors.white.withValues(alpha: 0.8),
                  border: Border.all(
                    color: isDone
                        ? WarmPearlColors.mintBright
                        : const Color(0x38141926),
                    width: 1.8,
                  ),
                  boxShadow: isDone
                      ? const [
                          BoxShadow(
                            color: Color(0x4D10B981),
                            blurRadius: 8,
                            offset: Offset(0, 2),
                          ),
                        ]
                      : null,
                ),
                alignment: Alignment.center,
                child: isDone
                    ? const Icon(
                        Icons.check_rounded,
                        size: 15,
                        color: Colors.white,
                      )
                    : null,
              ),
            ),
            const SizedBox(width: 11),

            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Badges: Scope + Course + G-Cal
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 7,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: item.isAcademicDeadline
                              ? WarmPearlColors.violetSoft
                              : WarmPearlColors.coralSoft,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: item.isAcademicDeadline
                                ? WarmPearlColors.violetBorder
                                : WarmPearlColors.coralBorder,
                          ),
                        ),
                        child: Text(
                          item.isAcademicDeadline
                              ? 'Hạn học vụ'
                              : 'Nhắc cá nhân',
                          style: TextStyle(
                            fontFamily: WarmPearlTypography.displayFont,
                            fontSize: 9.5,
                            fontWeight: FontWeight.w700,
                            color: item.isAcademicDeadline
                                ? WarmPearlColors.violet
                                : WarmPearlColors.coralInk,
                          ),
                        ),
                      ),
                      if (item.courseCode != null &&
                          item.courseCode!.isNotEmpty) ...[
                        const SizedBox(width: 5),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: WarmPearlColors.violetSoft,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Text(
                            item.courseCode!,
                            style: const TextStyle(
                              fontFamily: WarmPearlTypography.displayFont,
                              fontSize: 9.5,
                              fontWeight: FontWeight.w700,
                              color: WarmPearlColors.violet,
                            ),
                          ),
                        ),
                      ],
                      if (item.googleEventId != null) ...[
                        const SizedBox(width: 5),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            color: WarmPearlColors.mintSoft,
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: const [
                              Icon(
                                Icons.calendar_today_rounded,
                                size: 9,
                                color: WarmPearlColors.mint,
                              ),
                              SizedBox(width: 3),
                              Text(
                                'G-Cal',
                                style: TextStyle(
                                  fontFamily: WarmPearlTypography.displayFont,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w800,
                                  color: WarmPearlColors.mint,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 6),

                  // Title
                  Text(
                    item.title,
                    style: TextStyle(
                      fontFamily: WarmPearlTypography.displayFont,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      decoration: isDone
                          ? TextDecoration.lineThrough
                          : TextDecoration.none,
                      color: isDone
                          ? WarmPearlColors.inkMuted
                          : WarmPearlColors.inkPrimary,
                      height: 1.25,
                    ),
                  ),
                  const SizedBox(height: 6),

                  // Date & Link row
                  Row(
                    children: [
                      Icon(
                        Icons.access_time_rounded,
                        size: 13,
                        color: item.isOverdue
                            ? WarmPearlColors.rose
                            : WarmPearlColors.inkMuted,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        DateFormat('dd/MM/yyyy HH:mm')
                            .format(item.dueDate.toLocal()),
                        style: TextStyle(
                          fontFamily: WarmPearlTypography.bodyFont,
                          fontSize: 11,
                          fontWeight: item.isOverdue
                              ? FontWeight.w700
                              : FontWeight.w500,
                          color: item.isOverdue
                              ? WarmPearlColors.rose
                              : WarmPearlColors.inkSecondary,
                        ),
                      ),
                      const Spacer(),

                      // Link back to original announcement
                      if (item.notificationId != null &&
                          item.notificationId!.isNotEmpty) ...[
                        GestureDetector(
                          onTap: () {
                            context.go(
                              '/notifications/${item.notificationId}',
                            );
                          },
                          child: Row(
                            children: const [
                              Text(
                                'Xem tin gốc',
                                style: TextStyle(
                                  fontFamily: WarmPearlTypography.displayFont,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: WarmPearlColors.coralInk,
                                ),
                              ),
                              Icon(
                                Icons.chevron_right_rounded,
                                size: 14,
                                color: WarmPearlColors.coralInk,
                              ),
                            ],
                          ),
                        ),
                      ],

                      // Actions for personal reminders
                      if (item.isReminder) ...[
                        const SizedBox(width: 8),
                        GestureDetector(
                          onTap: () => _syncSingleGoogleCalendar(item),
                          child: Icon(
                            item.googleEventId != null
                                ? Icons.event_busy_rounded
                                : Icons.event_available_rounded,
                            size: 15,
                            color: item.googleEventId != null
                                ? WarmPearlColors.mint
                                : WarmPearlColors.inkMuted,
                          ),
                        ),
                        const SizedBox(width: 6),
                        GestureDetector(
                          onTap: () => _deleteReminder(item),
                          child: const Icon(
                            Icons.delete_outline_rounded,
                            size: 15,
                            color: WarmPearlColors.rose,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
