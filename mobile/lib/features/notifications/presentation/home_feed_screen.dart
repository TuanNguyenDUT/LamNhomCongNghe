import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/api_client.dart';
import '../../../core/presentation/app_toast.dart';
import '../../../core/presentation/empty_glass_card.dart';
import '../../../core/presentation/warm_pearl_tokens.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../deadlines/presentation/deadlines_screen.dart';
import '../../reminds/presentation/add_reminder_modal.dart';
import '../domain/notification_item.dart';
import 'follow_fanpage_sheet.dart';
import 'notification_providers.dart';

class HomeFeedScreen extends ConsumerStatefulWidget {
  const HomeFeedScreen({super.key});

  @override
  ConsumerState<HomeFeedScreen> createState() => _HomeFeedScreenState();
}

class _HomeFeedScreenState extends ConsumerState<HomeFeedScreen> {
  bool _onlyUnread = false;
  bool _isCategoryDrawerOpen = false;
  bool _isConfirmingAck = false;
  List<Map<String, dynamic>> _customFollowedPages = [];

  final List<Map<String, String>> _channelFilters = const [
    {'code': 'ALL', 'label': '🌟 Tất cả'},
    {'code': 'DUT_COURSE_CLASS', 'label': '📚 Lớp học phần'},
    {'code': 'DUT_TRAINING', 'label': '🎓 Đào tạo'},
    {'code': 'DUT_TUITION_FEE', 'label': '💰 Học phí, lệ phí'},
    {'code': 'DUT_TESTING_QA', 'label': '📝 Khảo thí & ĐBCL'},
    {'code': 'DUT_STUDENT_AFFAIRS', 'label': '🤝 Công tác SV'},
    {'code': 'DUT_GENERAL', 'label': '📢 Thông báo chung'},
    {'code': 'DUT_REGULATIONS', 'label': '⚖️ Quy chế'},
    {'code': 'FB_CTSV', 'label': '🔵 Fanpage CTSV'},
    {'code': 'FB_TUVAN_SV', 'label': '💬 Tư vấn SV'},
  ];

  final List<Map<String, String>> _topicFilters = const [
    {'code': 'ACADEMIC', 'label': '📖 Học tập'},
    {'code': 'GRADE', 'label': '📊 Điểm số'},
    {'code': 'ADMINISTRATIVE', 'label': '📑 Hành chính'},
    {'code': 'EVENT', 'label': '🎉 Hoạt động sự kiện'},
    {'code': 'CAREER', 'label': '💼 Nghề nghiệp'},
    {'code': 'SCHOLARSHIP', 'label': '🎓 Học bổng'},
  ];

  @override
  void initState() {
    super.initState();
    _loadFollowedPages();
  }

  Future<void> _loadFollowedPages() async {
    try {
      final session = ref.read(authControllerProvider).session;
      final studentId = session?.studentCode ?? '';
      if (studentId.isEmpty) return;

      final res = await ref.read(dioProvider).get(
        '/api/v1/facebook/followed',
        queryParameters: {'student_id': studentId},
      );
      if (res.data != null && res.data['data'] is List) {
        final list = List<Map<String, dynamic>>.from(res.data['data']);
        if (mounted) {
          setState(() {
            _customFollowedPages = list.where((p) {
              final url = (p['page_url'] ?? '').toString();
              return !url.contains('ctsvdhbkdhdn') &&
                  !url.contains('tuvansinhvien.dut');
            }).toList();
          });
        }
      }
    } catch (_) {}
  }

  Future<void> _openUrl(String url) async {
    final uri = Uri.tryParse(url);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        AppToast.showError(context, 'Không thể mở liên kết');
      }
    }
  }

  Future<void> _copyUrl(String url) async {
    await Clipboard.setData(ClipboardData(text: url));
    if (mounted) {
      AppToast.showSuccess(context, 'Đã sao chép liên kết vào bộ nhớ tạm');
    }
  }

  Future<void> _handleAcknowledge(NotificationItem item) async {
    final session = ref.read(authControllerProvider).session;
    final studentId = session?.studentCode ?? '';
    if (studentId.isEmpty) return;

    setState(() => _isConfirmingAck = true);

    try {
      await ref
          .read(notificationRepositoryProvider)
          .acknowledgeNotification(item.id, studentId: studentId);

      await ref
          .read(notificationRepositoryProvider)
          .setReadStatus(item.id, isRead: true, studentId: studentId);

      ref.invalidate(notificationFeedProvider);

      if (mounted) {
        AppToast.showSuccess(
          context,
          'Đã xác nhận nhận thông báo khẩn cấp thành công',
        );
      }
    } catch (_) {
      if (mounted) {
        AppToast.showError(context, 'Lỗi khi gửi xác nhận đã đọc');
      }
    } finally {
      if (mounted) {
        setState(() => _isConfirmingAck = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final selectedCategory = ref.watch(selectedCategoryProvider);
    final selectedTopics = ref.watch(selectedTopicCategoriesProvider);
    final courseFilter = ref.watch(selectedCourseFilterProvider);
    final feedAsync = ref.watch(notificationFeedProvider);
    final session = ref.watch(authControllerProvider).session;

    final unreadCount = ref.watch(unreadNotificationsCountProvider);
    final deadlinesList = ref.watch(deadlinesListProvider).asData?.value ?? [];
    final pendingAcademicCount = deadlinesList
        .where((d) => d.isAcademicDeadline && !d.isCompleted)
        .length;
    final pendingPersonalCount = deadlinesList
        .where((d) => d.isReminder && !d.isCompleted)
        .length;

    final urgentNotif = ref.watch(urgentNotificationProvider);

    return RefreshIndicator(
      onRefresh: () async {
        try {
          await ref.read(dioProvider).post('/api/v1/crawler/trigger');
        } catch (_) {}
        ref.invalidate(notificationFeedProvider);
        await _loadFollowedPages();
      },
      color: WarmPearlColors.coralFrom,
      backgroundColor: Colors.white,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(
          parent: BouncingScrollPhysics(),
        ),
        padding: const EdgeInsets.fromLTRB(14, 6, 14, 120),
        children: [
          // 1. CONDITIONAL URGENT ALERT CARD (Only when real emergency exists)
          if (urgentNotif != null) ...[
            _buildUrgentAlertCard(urgentNotif),
            const SizedBox(height: 12),
          ],

          // 2. BENTO PULSE 3-TILE STRIP
          _buildBentoPulseStrip(
            unreadCount: unreadCount,
            pendingAcademicCount: pendingAcademicCount,
            pendingPersonalCount: pendingPersonalCount,
          ),
          const SizedBox(height: 14),

          // 3. FILTER BLOCK (Source Rail + Topic Drawer + Active Filter Badges)
          _buildFilterBlock(
            selectedCategory: selectedCategory,
            selectedTopics: selectedTopics,
            courseFilter: courseFilter,
          ),
          const SizedBox(height: 12),

          // 4. ANNOUNCEMENT FEED CARDS / EMPTY STATE
          feedAsync.when(
            loading: () => const Center(
              child: Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: CircularProgressIndicator(color: WarmPearlColors.coralFrom),
              ),
            ),
            error: (err, stack) => EmptyGlassCard(
              icon: Icons.error_outline_rounded,
              title: 'Lỗi tải bảng tin',
              description: 'Vui lòng kiểm tra kết nối mạng và thử lại.',
              actionLabel: 'Tải lại',
              onAction: () => ref.invalidate(notificationFeedProvider),
            ),
            data: (page) {
              var items = page.items;

              // Apply topic filters
              if (selectedTopics.isNotEmpty) {
                items = items.where((item) {
                  final cat = (item.category ?? '').toUpperCase();
                  final catCode = (item.categoryCode ?? '').toUpperCase();
                  return (cat.isNotEmpty && selectedTopics.contains(cat)) ||
                      (catCode.isNotEmpty && selectedTopics.contains(catCode));
                }).toList();
              }

              // Apply course filter
              if (courseFilter != null) {
                items = items.where((item) {
                  return item.courseCode != null &&
                      item.courseCode!.toLowerCase() ==
                          courseFilter.courseCode.toLowerCase();
                }).toList();
              }

              // Apply unread filter toggle
              if (_onlyUnread) {
                items = items.where((item) => !item.isRead).toList();
              }

              if (items.isEmpty) {
                return EmptyGlassCard(
                  icon: Icons.filter_alt_off_rounded,
                  title: 'Không có thông báo phù hợp',
                  description:
                      'Không tìm thấy thông báo nào trong danh mục hoặc bộ lọc hiện tại.',
                  actionLabel: 'Xem tất cả thông báo',
                  onAction: () {
                    ref.read(selectedCategoryProvider.notifier).setCategory('ALL');
                    ref.read(selectedTopicCategoriesProvider.notifier).clear();
                    ref.read(selectedCourseFilterProvider.notifier).clear();
                    setState(() => _onlyUnread = false);
                  },
                );
              }

              return Column(
                children: items.map((item) {
                  return _buildFeedCard(item, session);
                }).toList(),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildUrgentAlertCard(NotificationItem item) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: WarmPearlColors.urgentCardSurface,
        borderRadius: BorderRadius.circular(26),
        border: Border.all(
          color: WarmPearlColors.urgentCardBorder,
          width: 1.2,
        ),
        boxShadow: const [
          BoxShadow(
            color: Color(0x1CFF5A36),
            blurRadius: 28,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: const [
              Icon(
                Icons.warning_amber_rounded,
                size: 18,
                color: WarmPearlColors.coralInk,
              ),
              SizedBox(width: 6),
              Text(
                'CẢNH BÁO KHẨN CẤP / LỊCH NGHỈ BÙ',
                style: TextStyle(
                  fontFamily: WarmPearlTypography.displayFont,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.3,
                  color: WarmPearlColors.coralInk,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          GestureDetector(
            onTap: () => context.push('/notifications/${item.id}'),
            child: Text(
              item.title,
              style: const TextStyle(
                fontFamily: WarmPearlTypography.displayFont,
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: WarmPearlColors.inkPrimary,
                height: 1.3,
              ),
            ),
          ),
          const SizedBox(height: 12),
          GestureDetector(
            onTap: _isConfirmingAck ? null : () => _handleAcknowledge(item),
            child: Container(
              height: 42,
              decoration: BoxDecoration(
                gradient: WarmPearlGradients.coralButton,
                borderRadius: BorderRadius.circular(999),
                boxShadow: const [
                  BoxShadow(
                    color: WarmPearlColors.coralGlow,
                    blurRadius: 16,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              alignment: Alignment.center,
              child: _isConfirmingAck
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text(
                      'Xác nhận đã đọc (Read Receipt)',
                      style: TextStyle(
                        fontFamily: WarmPearlTypography.displayFont,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBentoPulseStrip({
    required int unreadCount,
    required int pendingAcademicCount,
    required int pendingPersonalCount,
  }) {
    return Row(
      children: [
        // Tile 1: Chưa đọc
        Expanded(
          child: GestureDetector(
            onTap: () => setState(() => _onlyUnread = !_onlyUnread),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              decoration: BoxDecoration(
                color: _onlyUnread
                    ? WarmPearlColors.coralSoft
                    : WarmPearlColors.glassBgStrong,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: _onlyUnread
                      ? WarmPearlColors.coralBorder
                      : WarmPearlColors.glassBorderStrong,
                  width: 1,
                ),
                boxShadow: WarmPearlShadows.glassSm,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Chưa đọc',
                    style: TextStyle(
                      fontFamily: WarmPearlTypography.bodyFont,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: WarmPearlColors.inkMuted,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text(
                        '$unreadCount',
                        style: const TextStyle(
                          fontFamily: WarmPearlTypography.displayFont,
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: WarmPearlColors.coralInk,
                        ),
                      ),
                      if (unreadCount > 0) ...[
                        const SizedBox(width: 5),
                        Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: WarmPearlColors.coralFrom,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 9),

        // Tile 2: Hạn sắp tới
        Expanded(
          child: GestureDetector(
            onTap: () => context.go('/deadlines?scope=academic'),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              decoration: BoxDecoration(
                color: WarmPearlColors.glassBgStrong,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: WarmPearlColors.glassBorderStrong,
                  width: 1,
                ),
                boxShadow: WarmPearlShadows.glassSm,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Hạn sắp tới',
                    style: TextStyle(
                      fontFamily: WarmPearlTypography.bodyFont,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: WarmPearlColors.inkMuted,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '$pendingAcademicCount',
                    style: const TextStyle(
                      fontFamily: WarmPearlTypography.displayFont,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: WarmPearlColors.violet,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 9),

        // Tile 3: Nhắc việc
        Expanded(
          child: GestureDetector(
            onTap: () => context.go('/deadlines?scope=personal'),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
              decoration: BoxDecoration(
                color: WarmPearlColors.glassBgStrong,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(
                  color: WarmPearlColors.glassBorderStrong,
                  width: 1,
                ),
                boxShadow: WarmPearlShadows.glassSm,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Nhắc việc',
                    style: TextStyle(
                      fontFamily: WarmPearlTypography.bodyFont,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: WarmPearlColors.inkMuted,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '$pendingPersonalCount',
                    style: const TextStyle(
                      fontFamily: WarmPearlTypography.displayFont,
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: WarmPearlColors.mint,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildFilterBlock({
    required String selectedCategory,
    required Set<String> selectedTopics,
    required dynamic courseFilter,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Horizontal Source Rail
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          physics: const BouncingScrollPhysics(),
          child: Row(
            children: [
              ..._channelFilters.map((ch) {
                final isSelected = selectedCategory == ch['code'];
                return Padding(
                  padding: const EdgeInsets.only(right: 6.0),
                  child: GestureDetector(
                    onTap: () {
                      ref
                          .read(selectedCategoryProvider.notifier)
                          .setCategory(ch['code']!);
                    },
                    child: Container(
                      height: 34,
                      padding: const EdgeInsets.symmetric(horizontal: 13),
                      decoration: BoxDecoration(
                        gradient: isSelected
                            ? WarmPearlGradients.coralButton
                            : null,
                        color: isSelected
                            ? null
                            : Colors.white.withValues(alpha: 0.65),
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: isSelected
                              ? Colors.white.withValues(alpha: 0.45)
                              : WarmPearlColors.glassBorder,
                        ),
                        boxShadow: WarmPearlShadows.glassSm,
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        ch['label']!,
                        style: TextStyle(
                          fontFamily: WarmPearlTypography.bodyFont,
                          fontSize: 12,
                          fontWeight:
                              isSelected ? FontWeight.w700 : FontWeight.w600,
                          color: isSelected
                              ? Colors.white
                              : WarmPearlColors.inkSecondary,
                        ),
                      ),
                    ),
                  ),
                );
              }),

              // Custom Followed Fanpages
              ..._customFollowedPages.map((page) {
                final pageCode = (page['channel_code']?.toString().isNotEmpty == true)
                    ? page['channel_code'].toString()
                    : (page['page_url']?.toString() ?? '');
                final pageName = page['page_name']?.toString() ?? 'Fanpage';
                final isSelected = selectedCategory == pageCode ||
                    selectedCategory == page['page_url']?.toString() ||
                    selectedCategory == page['channel_code']?.toString();

                return Padding(
                  padding: const EdgeInsets.only(right: 6.0),
                  child: GestureDetector(
                    onTap: () {
                      ref
                          .read(selectedCategoryProvider.notifier)
                          .setCategory(pageCode);
                    },
                    child: Container(
                      height: 34,
                      padding: const EdgeInsets.symmetric(horizontal: 13),
                      decoration: BoxDecoration(
                        gradient: isSelected
                            ? WarmPearlGradients.coralButton
                            : null,
                        color: isSelected
                            ? null
                            : WarmPearlColors.fbSoft,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: isSelected
                              ? Colors.white.withValues(alpha: 0.45)
                              : WarmPearlColors.fbBlue.withValues(alpha: 0.3),
                        ),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        '🔵 $pageName',
                        style: TextStyle(
                          fontFamily: WarmPearlTypography.bodyFont,
                          fontSize: 12,
                          fontWeight:
                              isSelected ? FontWeight.w700 : FontWeight.w600,
                          color: isSelected
                              ? Colors.white
                              : WarmPearlColors.fbBlue,
                        ),
                      ),
                    ),
                  ),
                );
              }),

              // + Theo dõi Fanpage Pill (Dashed border)
              GestureDetector(
                onTap: () => showFollowFanpageSheet(context),
                child: Container(
                  height: 34,
                  padding: const EdgeInsets.symmetric(horizontal: 13),
                  decoration: BoxDecoration(
                    color: WarmPearlColors.fbPillBg,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: WarmPearlColors.fbPillBorder,
                      style: BorderStyle.solid,
                    ),
                  ),
                  alignment: Alignment.center,
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: const [
                      Icon(
                        Icons.add_rounded,
                        size: 15,
                        color: WarmPearlColors.fbBlue,
                      ),
                      SizedBox(width: 4),
                      Text(
                        'Theo dõi Fanpage',
                        style: TextStyle(
                          fontFamily: WarmPearlTypography.bodyFont,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: WarmPearlColors.fbBlue,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 8),

        // Category drawer toggle row
        Row(
          children: [
            GestureDetector(
              onTap: () {
                setState(() => _isCategoryDrawerOpen = !_isCategoryDrawerOpen);
              },
              child: Container(
                height: 30,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.65),
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: WarmPearlColors.glassBorder),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _isCategoryDrawerOpen
                          ? Icons.keyboard_arrow_up_rounded
                          : Icons.keyboard_arrow_down_rounded,
                      size: 16,
                      color: WarmPearlColors.inkSecondary,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      _isCategoryDrawerOpen ? 'Thu gọn loại tin' : 'Lọc loại tin ▾',
                      style: const TextStyle(
                        fontFamily: WarmPearlTypography.bodyFont,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                        color: WarmPearlColors.inkSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 8),

            // Active Course Filter Chip
            if (courseFilter != null) ...[
              Container(
                height: 30,
                padding: const EdgeInsets.fromLTRB(10, 0, 4, 0),
                decoration: BoxDecoration(
                  color: WarmPearlColors.violetSoft,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(color: WarmPearlColors.violetBorder),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      courseFilter.courseCode,
                      style: const TextStyle(
                        fontFamily: WarmPearlTypography.displayFont,
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: WarmPearlColors.violet,
                      ),
                    ),
                    IconButton(
                      icon: const Icon(
                        Icons.close_rounded,
                        size: 14,
                        color: WarmPearlColors.violet,
                      ),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: () {
                        ref.read(selectedCourseFilterProvider.notifier).clear();
                      },
                    ),
                  ],
                ),
              ),
            ],
          ],
        ),

        // Expandable Topic Chips
        if (_isCategoryDrawerOpen) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.75),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: WarmPearlColors.glassBorder),
            ),
            child: Wrap(
              spacing: 6,
              runSpacing: 6,
              children: _topicFilters.map((t) {
                final isSelected = selectedTopics.contains(t['code']);
                return GestureDetector(
                  onTap: () {
                    ref
                        .read(selectedTopicCategoriesProvider.notifier)
                        .toggle(t['code']!);
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? WarmPearlColors.violetSoft
                          : Colors.white.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(
                        color: isSelected
                            ? WarmPearlColors.violetBorder
                            : WarmPearlColors.glassBorder,
                      ),
                    ),
                    child: Text(
                      t['label']!,
                      style: TextStyle(
                        fontFamily: WarmPearlTypography.bodyFont,
                        fontSize: 11.5,
                        fontWeight:
                            isSelected ? FontWeight.w700 : FontWeight.w600,
                        color: isSelected
                            ? WarmPearlColors.violet
                            : WarmPearlColors.inkSecondary,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildFeedCard(NotificationItem item, dynamic session) {
    final stripeColor = item.isEmergency
        ? WarmPearlColors.coralFrom
        : (item.priority == 'URGENT' || item.priority == 'HIGH'
            ? WarmPearlColors.coralTo
            : (item.category == 'ACADEMIC'
                ? WarmPearlColors.violet
                : const Color(0xFF64748B)));

    final isFb = item.sourceChannel == 'FB_CTSV' ||
        item.sourceChannel == 'FB_TUVAN_SV' ||
        (item.sourceUrl != null && item.sourceUrl!.contains('facebook.com'));

    final realUrl = item.sourceUrl?.trim().isNotEmpty == true
        ? item.sourceUrl!.trim()
        : (item.sourceChannel == 'FB_TUVAN_SV'
            ? 'https://www.facebook.com/tuvansinhvien.dut'
            : (item.sourceChannel == 'FB_CTSV'
                ? 'https://www.facebook.com/ctsvdhbkdhdn'
                : 'https://sv.dut.udn.vn'));

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: WarmPearlColors.glassBgStrong,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: WarmPearlColors.glassBorderStrong,
          width: 1,
        ),
        boxShadow: WarmPearlShadows.glassSm,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Left priority stripe
              Container(width: 4, color: stripeColor),

              // Main Card Content
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Header: Source + Category + Date
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 3,
                            ),
                            decoration: BoxDecoration(
                              color: isFb
                                  ? WarmPearlColors.fbSoft
                                  : WarmPearlColors.coralSoft,
                              borderRadius: BorderRadius.circular(7),
                            ),
                            child: Text(
                              item.sourceTitle,
                              style: TextStyle(
                                fontFamily: WarmPearlTypography.displayFont,
                                fontSize: 10.5,
                                fontWeight: FontWeight.w700,
                                color: isFb
                                    ? WarmPearlColors.fbBlue
                                    : WarmPearlColors.coralInk,
                              ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          if (item.categoryName != null) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 7,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                color: WarmPearlColors.violetSoft,
                                borderRadius: BorderRadius.circular(7),
                              ),
                              child: Text(
                                item.categoryName!,
                                style: const TextStyle(
                                  fontFamily: WarmPearlTypography.displayFont,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: WarmPearlColors.violet,
                                ),
                              ),
                            ),
                          ],
                          const Spacer(),
                          Text(
                            item.formattedPublishedAt,
                            style: const TextStyle(
                              fontFamily: WarmPearlTypography.bodyFont,
                              fontSize: 10.5,
                              color: WarmPearlColors.inkMuted,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),

                      // Title
                      GestureDetector(
                        onTap: () => context.push('/notifications/${item.id}'),
                        child: Text(
                          item.title,
                          style: TextStyle(
                            fontFamily: WarmPearlTypography.displayFont,
                            fontSize: 14.5,
                            fontWeight: item.isRead
                                ? FontWeight.w600
                                : FontWeight.w800,
                            color: item.isRead
                                ? WarmPearlColors.inkSecondary
                                : WarmPearlColors.inkPrimary,
                            height: 1.3,
                          ),
                        ),
                      ),
                      const SizedBox(height: 5),

                      // Excerpt
                      if (item.summary.isNotEmpty) ...[
                        Text(
                          item.summary,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontFamily: WarmPearlTypography.bodyFont,
                            fontSize: 12,
                            color: WarmPearlColors.inkSecondary,
                            height: 1.35,
                          ),
                        ),
                        const SizedBox(height: 8),
                      ],

                      const Divider(
                        height: 14,
                        color: WarmPearlColors.glassDivider,
                      ),

                      // Card Footer Actions
                      Row(
                        children: [
                          // Thêm nhắc nhở
                          GestureDetector(
                            onTap: () => showAddReminderModal(
                              context,
                              ref,
                              item,
                              session,
                            ),
                            child: Row(
                              children: const [
                                Icon(
                                  Icons.alarm_add_rounded,
                                  size: 15,
                                  color: WarmPearlColors.coralInk,
                                ),
                                SizedBox(width: 4),
                                Text(
                                  'Thêm nhắc nhở',
                                  style: TextStyle(
                                    fontFamily: WarmPearlTypography.displayFont,
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w700,
                                    color: WarmPearlColors.coralInk,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const Spacer(),

                          // Mở bài viết / Xem FB
                          GestureDetector(
                            onTap: () => _openUrl(realUrl),
                            child: Row(
                              children: [
                                Icon(
                                  isFb
                                      ? Icons.facebook_rounded
                                      : Icons.open_in_new_rounded,
                                  size: 14,
                                  color: isFb
                                      ? WarmPearlColors.fbBlue
                                      : WarmPearlColors.inkSecondary,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  isFb ? 'Xem Facebook' : 'Mở bài viết',
                                  style: TextStyle(
                                    fontFamily: WarmPearlTypography.bodyFont,
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w600,
                                    color: isFb
                                        ? WarmPearlColors.fbBlue
                                        : WarmPearlColors.inkSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),

                          // Copy Link Icon Button
                          GestureDetector(
                            onTap: () => _copyUrl(realUrl),
                            child: const Icon(
                              Icons.copy_rounded,
                              size: 14,
                              color: WarmPearlColors.inkMuted,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
