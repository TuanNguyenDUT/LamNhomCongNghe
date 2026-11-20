import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../features/courses/domain/course_item.dart';
import '../../features/courses/presentation/enrolled_courses_screen.dart';
import '../../features/notifications/domain/notification_item.dart';
import '../../features/notifications/presentation/notification_providers.dart';
import 'empty_glass_card.dart';
import 'warm_pearl_tokens.dart';

/// Opens the full-screen Warm Pearl Liquid Glass Spotlight Search Overlay.
Future<void> openSpotlightSearch(
  BuildContext context, {
  String? initialQuery,
}) {
  return showGeneralDialog<void>(
    context: context,
    useRootNavigator: true,
    barrierDismissible: true,
    barrierLabel: 'Spotlight Search',
    barrierColor: WarmPearlColors.scrim,
    transitionDuration: const Duration(milliseconds: 320),
    pageBuilder: (context, anim1, anim2) {
      return SpotlightSearchOverlay(initialQuery: initialQuery);
    },
    transitionBuilder: (context, anim1, anim2, child) {
      final curved = CurvedAnimation(
        parent: anim1,
        curve: WarmPearlMotion.spring,
      );
      return FadeTransition(
        opacity: anim1,
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.96, end: 1.0).animate(curved),
          child: child,
        ),
      );
    },
  );
}

class SpotlightSearchOverlay extends ConsumerStatefulWidget {
  const SpotlightSearchOverlay({super.key, this.initialQuery});

  final String? initialQuery;

  @override
  ConsumerState<SpotlightSearchOverlay> createState() =>
      _SpotlightSearchOverlayState();
}

class _SpotlightSearchOverlayState
    extends ConsumerState<SpotlightSearchOverlay> {
  late final TextEditingController _searchController;
  final FocusNode _focusNode = FocusNode();
  String _currentQuery = '';

  static const List<String> _quickTags = [
    '#HọcTập',
    '#ĐiểmSố',
    '#HọcBổng',
    '#HànhChính',
    '#HoạtĐộng',
    '#LịchThi',
  ];

  @override
  void initState() {
    super.initState();
    _currentQuery = widget.initialQuery ?? '';
    _searchController = TextEditingController(text: _currentQuery);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _applyTag(String tag) {
    setState(() {
      _currentQuery = tag;
      _searchController.text = tag;
      _searchController.selection = TextSelection.fromPosition(
        TextPosition(offset: tag.length),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final notificationsAsync = ref.watch(notificationsProvider);
    final coursesAsync = ref.watch(enrolledCoursesProvider);

    final allNotifs = notificationsAsync.asData?.value ?? <NotificationItem>[];
    final allCourses = coursesAsync.asData?.value ?? <CourseItem>[];

    final queryClean = _currentQuery.trim().toLowerCase();

    // Filter announcements
    final filteredNotifs = queryClean.isEmpty
        ? <NotificationItem>[]
        : allNotifs.where((n) {
            final t = n.title.toLowerCase();
            final c = n.content.toLowerCase();
            final s = n.summary.toLowerCase();
            final code = (n.courseCode ?? '').toLowerCase();
            final tags = n.tags.join(' ').toLowerCase();
            final cat = (n.categoryName ?? '').toLowerCase();
            return t.contains(queryClean) ||
                c.contains(queryClean) ||
                s.contains(queryClean) ||
                code.contains(queryClean) ||
                tags.contains(queryClean) ||
                cat.contains(queryClean);
          }).toList();

    // Filter courses
    final filteredCourses = queryClean.isEmpty
        ? <CourseItem>[]
        : allCourses.where((c) {
            final code = c.courseCode.toLowerCase();
            final name = c.courseName.toLowerCase();
            final lecturer = (c.lecturerName ?? '').toLowerCase();
            return code.contains(queryClean) ||
                name.contains(queryClean) ||
                lecturer.contains(queryClean);
          }).toList();

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 720),
            child: Container(
              margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              padding: const EdgeInsets.fromLTRB(14, 14, 14, 14),
              decoration: BoxDecoration(
                color: WarmPearlColors.spotlightBg,
                borderRadius: BorderRadius.circular(28),
                border: Border.all(
                  color: WarmPearlColors.glassBorderStrong,
                  width: 1.2,
                ),
                boxShadow: WarmPearlShadows.glass,
              ),
              child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Search Input & Close button row
              Row(
                children: [
                  Expanded(
                    child: Container(
                      height: 48,
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: WarmPearlColors.spotlightInputBg,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: WarmPearlColors.glassBorderStrong,
                          width: 1,
                        ),
                        boxShadow: WarmPearlShadows.glassSm,
                      ),
                      child: Row(
                        children: [
                          const Icon(
                            Icons.search_rounded,
                            size: 20,
                            color: WarmPearlColors.coralFrom,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: TextField(
                              controller: _searchController,
                              focusNode: _focusNode,
                              onChanged: (val) {
                                setState(() => _currentQuery = val);
                              },
                              style: const TextStyle(
                                fontFamily: WarmPearlTypography.bodyFont,
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: WarmPearlColors.inkPrimary,
                              ),
                              decoration: const InputDecoration(
                                hintText:
                                    'Tìm thông báo, mã học phần, #hashtag...',
                                hintStyle: TextStyle(
                                  color: WarmPearlColors.inkMuted,
                                  fontSize: 13,
                                  fontWeight: FontWeight.normal,
                                ),
                                border: InputBorder.none,
                                isDense: true,
                                contentPadding: EdgeInsets.zero,
                              ),
                            ),
                          ),
                          if (_currentQuery.isNotEmpty)
                            GestureDetector(
                              onTap: () {
                                _searchController.clear();
                                setState(() => _currentQuery = '');
                              },
                              child: const Icon(
                                Icons.cancel_rounded,
                                size: 18,
                                color: WarmPearlColors.inkMuted,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Close button
                  GestureDetector(
                    onTap: () => Navigator.of(context).pop(),
                    child: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xADFFFFFF),
                        border: Border.all(
                          color: WarmPearlColors.glassBorderStrong,
                          width: 1,
                        ),
                        boxShadow: WarmPearlShadows.glassSm,
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.close_rounded,
                        size: 20,
                        color: WarmPearlColors.inkPrimary,
                      ),
                    ),
                  ),
                ],
              ),

              const SizedBox(height: 12),

              // Quick Hashtag Chips
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                physics: const BouncingScrollPhysics(),
                child: Row(
                  children: _quickTags.map((tag) {
                    final isSelected =
                        _currentQuery.toLowerCase() == tag.toLowerCase();
                    return Padding(
                      padding: const EdgeInsets.only(right: 6.0),
                      child: GestureDetector(
                        onTap: () => _applyTag(tag),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 11,
                            vertical: 5,
                          ),
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
                          child: Text(
                            tag,
                            style: TextStyle(
                              fontFamily: WarmPearlTypography.bodyFont,
                              fontSize: 11.5,
                              fontWeight:
                                  isSelected ? FontWeight.w700 : FontWeight.w600,
                              color: isSelected
                                  ? WarmPearlColors.coralInk
                                  : WarmPearlColors.inkSecondary,
                            ),
                          ),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),

              const SizedBox(height: 12),

              // Results or Prompt
              Expanded(
                child: queryClean.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: const [
                            Icon(
                              Icons.manage_search_rounded,
                              size: 44,
                              color: WarmPearlColors.inkMuted,
                            ),
                            SizedBox(height: 8),
                            Text(
                              'Nhập từ khóa tìm kiếm',
                              style: TextStyle(
                                fontFamily: WarmPearlTypography.displayFont,
                                fontSize: 14.5,
                                fontWeight: FontWeight.w700,
                                color: WarmPearlColors.inkPrimary,
                              ),
                            ),
                            SizedBox(height: 4),
                            Text(
                              'Tìm kiếm trên thông báo, học phần và hạn chót',
                              style: TextStyle(
                                fontFamily: WarmPearlTypography.bodyFont,
                                fontSize: 12,
                                color: WarmPearlColors.inkMuted,
                              ),
                            ),
                          ],
                        ),
                      )
                    : (filteredCourses.isEmpty && filteredNotifs.isEmpty)
                        ? Center(
                            child: EmptyGlassCard(
                              icon: Icons.search_off_rounded,
                              title: 'Không tìm thấy kết quả',
                              description:
                                  'Không có thông báo hoặc học phần nào khớp với "$_currentQuery"',
                            ),
                          )
                        : ListView(
                            physics: const BouncingScrollPhysics(),
                            children: [
                              // Courses Section
                              if (filteredCourses.isNotEmpty) ...[
                                Padding(
                                  padding:
                                      const EdgeInsets.only(bottom: 8.0, top: 4.0),
                                  child: Text(
                                    'Học phần (${filteredCourses.length})',
                                    style: const TextStyle(
                                      fontFamily:
                                          WarmPearlTypography.displayFont,
                                      fontSize: 13,
                                      fontWeight: FontWeight.w800,
                                      color: WarmPearlColors.inkPrimary,
                                    ),
                                  ),
                                ),
                                ...filteredCourses.map((course) {
                                  return Container(
                                    margin: const EdgeInsets.only(bottom: 8),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 10,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(alpha: 0.8),
                                      borderRadius: BorderRadius.circular(16),
                                      border: Border.all(
                                        color: WarmPearlColors.glassBorder,
                                      ),
                                    ),
                                    child: Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 7,
                                            vertical: 3,
                                          ),
                                          decoration: BoxDecoration(
                                            color: WarmPearlColors.violetSoft,
                                            borderRadius:
                                                BorderRadius.circular(6),
                                            border: Border.all(
                                              color:
                                                  WarmPearlColors.violetBorder,
                                            ),
                                          ),
                                          child: Text(
                                            course.courseCode,
                                            style: const TextStyle(
                                              fontFamily:
                                                  WarmPearlTypography.displayFont,
                                              fontSize: 11,
                                              fontWeight: FontWeight.w700,
                                              color: WarmPearlColors.violet,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 10),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                course.courseName,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(
                                                  fontFamily: WarmPearlTypography
                                                      .displayFont,
                                                  fontSize: 13,
                                                  fontWeight: FontWeight.w700,
                                                  color: WarmPearlColors
                                                      .inkPrimary,
                                                ),
                                              ),
                                              if (course.lecturerName != null &&
                                                  course.lecturerName!.isNotEmpty)
                                                Text(
                                                  'GV: ${course.lecturerName}',
                                                  style: const TextStyle(
                                                    fontFamily:
                                                        WarmPearlTypography
                                                            .bodyFont,
                                                    fontSize: 11,
                                                    color: WarmPearlColors
                                                        .inkSecondary,
                                                  ),
                                                ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                }),
                                const SizedBox(height: 10),
                              ],

                              // Notifications Section
                              if (filteredNotifs.isNotEmpty) ...[
                                Padding(
                                  padding:
                                      const EdgeInsets.only(bottom: 8.0, top: 4.0),
                                  child: Text(
                                    'Thông báo (${filteredNotifs.length})',
                                    style: const TextStyle(
                                      fontFamily:
                                          WarmPearlTypography.displayFont,
                                      fontSize: 13,
                                      fontWeight: FontWeight.w800,
                                      color: WarmPearlColors.inkPrimary,
                                    ),
                                  ),
                                ),
                                ...filteredNotifs.map((n) {
                                  return GestureDetector(
                                    onTap: () {
                                      Navigator.of(context).pop();
                                      context.go('/notifications/${n.id}');
                                    },
                                    child: Container(
                                      margin: const EdgeInsets.only(bottom: 8),
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: Colors.white.withValues(alpha: 0.8),
                                        borderRadius: BorderRadius.circular(16),
                                        border: Border.all(
                                          color: WarmPearlColors.glassBorder,
                                        ),
                                      ),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Row(
                                            children: [
                                              Container(
                                                padding:
                                                    const EdgeInsets.symmetric(
                                                  horizontal: 6,
                                                  vertical: 2,
                                                ),
                                                decoration: BoxDecoration(
                                                  color:
                                                      WarmPearlColors.coralSoft,
                                                  borderRadius:
                                                      BorderRadius.circular(6),
                                                ),
                                                child: Text(
                                                  n.sourceTitle,
                                                  style: const TextStyle(
                                                    fontSize: 10,
                                                    fontWeight: FontWeight.w700,
                                                    color:
                                                        WarmPearlColors.coralInk,
                                                  ),
                                                ),
                                              ),
                                              const Spacer(),
                                              Text(
                                                n.formattedPublishedAt,
                                                style: const TextStyle(
                                                  fontSize: 10.5,
                                                  color:
                                                      WarmPearlColors.inkMuted,
                                                ),
                                              ),
                                            ],
                                          ),
                                          const SizedBox(height: 5),
                                          Text(
                                            n.title,
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              fontFamily: WarmPearlTypography
                                                  .displayFont,
                                              fontSize: 13,
                                              fontWeight: FontWeight.w700,
                                              color: WarmPearlColors.inkPrimary,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                }),
                              ],
                            ],
                          ),
              ),
            ],
          ),
            ),
          ),
        ),
      ),
    );
  }
}
