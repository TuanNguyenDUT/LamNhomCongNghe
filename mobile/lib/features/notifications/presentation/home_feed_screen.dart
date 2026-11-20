import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/app_config.dart';
import '../../../core/network/api_client.dart';
import '../../../core/presentation/app_toast.dart';
import '../../../core/presentation/liquid_glass.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../deadlines/presentation/deadlines_screen.dart';
import '../../reminds/presentation/add_reminder_modal.dart';
import 'emergency_alert_modal.dart';
import 'notification_providers.dart';
import '../domain/notification_item.dart';

class HomeFeedScreen extends ConsumerStatefulWidget {
  const HomeFeedScreen({super.key});

  @override
  ConsumerState<HomeFeedScreen> createState() => _HomeFeedScreenState();
}

class _HomeFeedScreenState extends ConsumerState<HomeFeedScreen> {
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  List<Map<String, dynamic>> _customFollowedPages = [];

  final List<Map<String, String>> _categories = const [
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

  final List<Map<String, String>> _topicFilterOptions = const [
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
      final studentId = session?.studentCode ?? '102230026';
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
              return !url.contains('ctsvdhbkdhdn') && !url.contains('tuvansinhvien.dut');
            }).toList();
          });
        }
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final selectedCategory = ref.watch(selectedCategoryProvider);
    final selectedTopics = ref.watch(selectedTopicCategoriesProvider);
    final courseFilter = ref.watch(selectedCourseFilterProvider);
    final feedAsync = ref.watch(notificationFeedProvider);
    final authState = ref.watch(authControllerProvider);
    final session = authState.session;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        children: [
          // 1. Apple Wallpaper Style Background Gradient
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

          // 2. Nội dung chính
          SafeArea(
            child: Column(
              children: [
                // Header Bar Liquid Glass: Định danh sinh viên & Nút đăng xuất
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 8),
                  child: LiquidGlassContainer(
                    borderRadius: 22,
                    blurSigma: 20,
                    opacity: 0.82,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    child: Row(
                      children: [
                        // Avatar sinh viên
                        Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: const LinearGradient(
                              colors: [Color(0xFF007AFF), Color(0xFF5856D6)],
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFF007AFF).withValues(alpha: 0.3),
                                blurRadius: 8,
                                offset: const Offset(0, 3),
                              ),
                            ],
                          ),
                          child: ClipOval(
                            child: Image.network(
                              '${AppConfig.apiBaseUrl}/api/v1/avatar/${session?.studentCode ?? '102230026'}.jpg',
                              fit: BoxFit.cover,
                              errorBuilder: (ctx, err, stack) => Center(
                                child: Text(
                                  (session?.studentCode ?? '26').substring((session?.studentCode ?? '26').length - 2),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 15,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),

                        // Định danh user trên App
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                session?.fullName ?? 'Nguyễn Văn Lợi',
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF0F172A),
                                  letterSpacing: -0.3,
                                ),
                              ),
                              Text(
                                '${session?.studentCode ?? '102230026'} • ${session?.className ?? '23T_Nhat1'}',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w500,
                                  color: Colors.blueGrey.shade700,
                                ),
                              ),
                            ],
                          ),
                        ),

                        // Nút Theo dõi Fanpage Facebook bất kỳ
                        IconButton(
                          icon: const Icon(Icons.add_link_rounded, color: Color(0xFF1877F2), size: 24),
                          tooltip: 'Theo dõi Fanpage Facebook mới',
                          onPressed: () => _showFollowFbPageDialog(context, session),
                        ),

                        // Nút làm mới & Cào dữ liệu đa nguồn
                        IconButton(
                          icon: const Icon(Icons.refresh_rounded, color: Color(0xFF007AFF), size: 22),
                          tooltip: 'Làm mới & Đồng bộ thông báo mới nhất',
                          onPressed: () async {
                            AppToast.showInfo(context, '🔄 Đang đồng bộ thông báo mới từ sv.dut.udn.vn & Fanpage...');
                            try {
                              await ref.read(dioProvider).post('/api/v1/crawler/trigger');
                              if (context.mounted) {
                                AppToast.showSuccess(context, 'Đã cập nhật thông báo mới nhất thành công!');
                              }
                            } catch (_) {
                              if (context.mounted) {
                                AppToast.showError(context, 'Không thể kết nối đến máy chủ cào dữ liệu.');
                              }
                            }
                            ref.invalidate(notificationFeedProvider);
                            ref.invalidate(deadlinesListProvider);
                          },
                        ),

                        // Nút Đăng xuất
                        IconButton(
                          icon: const Icon(Icons.logout_rounded, color: Color(0xFF64748B), size: 20),
                          tooltip: 'Đăng xuất',
                          onPressed: () async {
                            await ref.read(authControllerProvider.notifier).logout();
                            if (context.mounted) {
                              context.go('/login');
                            }
                          },
                        ),
                      ],
                    ),
                  ),
                ),

                // 2. Thanh tìm kiếm Liquid Glass
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: LiquidGlassContainer(
                    borderRadius: 16,
                    blurSigma: 16,
                    opacity: 0.65,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    child: TextField(
                      controller: _searchController,
                      style: const TextStyle(fontSize: 14, color: Color(0xFF0F172A)),
                      decoration: InputDecoration(
                        hintText: 'Tìm thông báo, mã lớp học phần...',
                        hintStyle: TextStyle(fontSize: 14, color: Colors.blueGrey.shade400),
                        prefixIcon: const Icon(Icons.search_rounded, color: Color(0xFF007AFF), size: 20),
                        suffixIcon: _searchController.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.clear_rounded, size: 18),
                                onPressed: () {
                                  setState(() {
                                    _searchController.clear();
                                    _searchQuery = '';
                                  });
                                },
                              )
                            : null,
                        border: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      onChanged: (val) {
                        setState(() {
                          _searchQuery = val;
                        });
                      },
                    ),
                  ),
                ),

                // 3. Phân loại chuyên mục & Fanpage theo dõi (Liquid Glass Horizontal Selector)
                Builder(
                  builder: (context) {
                    final allCategories = [
                      ..._categories,
                      ..._customFollowedPages.map((p) => {
                            'code': (p['channel_code'] ?? 'FB_CUSTOM').toString(),
                            'label': '📘 ${(p['page_name'] ?? 'Fanpage').toString()}',
                            'is_custom': 'true',
                            'id': (p['id'] ?? '').toString(),
                            'url': (p['page_url'] ?? '').toString(),
                          }),
                      {'code': '__ADD_FB__', 'label': '➕ Theo dõi Fanpage'},
                    ];

                    return SizedBox(
                      height: 48,
                      child: ListView.separated(
                        scrollDirection: Axis.horizontal,
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        itemCount: allCategories.length,
                        separatorBuilder: (ctx, idx) => const SizedBox(width: 8),
                        itemBuilder: (context, index) {
                          final cat = allCategories[index];
                          final isSelected = cat['code'] == selectedCategory;
                          final isAddButton = cat['code'] == '__ADD_FB__';

                          return GestureDetector(
                            onTap: () {
                              if (isAddButton) {
                                _showFollowFbPageDialog(context, session);
                                return;
                              }
                              ref.read(selectedCategoryProvider.notifier).setCategory(cat['code']!);
                              if (cat['code'] != 'DUT_COURSE_CLASS') {
                                ref.read(selectedCourseFilterProvider.notifier).clear();
                              }
                            },
                            child: LiquidGlassContainer(
                              borderRadius: 20,
                              blurSigma: 14,
                              opacity: isSelected ? 0.9 : (isAddButton ? 0.75 : 0.5),
                              gradientColors: isSelected
                                  ? (cat['code']!.startsWith('FB_')
                                      ? [const Color(0xFF1877F2), const Color(0xFF0C63D4)]
                                      : [const Color(0xFF007AFF), const Color(0xFF005BD8)])
                                  : (isAddButton
                                      ? [const Color(0xFF1877F2).withValues(alpha: 0.15), const Color(0xFF1877F2).withValues(alpha: 0.05)]
                                      : null),
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                              child: Center(
                                child: Text(
                                  cat['label']!,
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: isAddButton ? FontWeight.w700 : FontWeight.w600,
                                    color: isSelected
                                        ? Colors.white
                                        : (isAddButton ? const Color(0xFF1877F2) : const Color(0xFF334155)),
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    );
                  },
                ),

                // 3.4 Banner hiển thị khi đang lọc theo Fanpage theo dõi tùy chọn
                Builder(
                  builder: (context) {
                    final customPage = _customFollowedPages.firstWhere(
                      (p) => p['channel_code'] == selectedCategory,
                      orElse: () => {},
                    );
                    if (customPage.isEmpty) return const SizedBox.shrink();

                    return Padding(
                      padding: const EdgeInsets.fromLTRB(16, 4, 16, 6),
                      child: LiquidGlassContainer(
                        borderRadius: 16,
                        blurSigma: 16,
                        opacity: 0.9,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                        gradientColors: [
                          const Color(0xFF1877F2).withValues(alpha: 0.15),
                          Colors.white.withValues(alpha: 0.95),
                        ],
                        child: Row(
                          children: [
                            const Icon(Icons.facebook_rounded, color: Color(0xFF1877F2), size: 20),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'Đang lọc theo Fanpage theo dõi:',
                                    style: TextStyle(
                                      fontSize: 10,
                                      color: Color(0xFF64748B),
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  Text(
                                    '${customPage['page_name']} • ${customPage['page_url']}',
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: Color(0xFF0F172A),
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ],
                              ),
                            ),
                            TextButton.icon(
                              style: TextButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                visualDensity: VisualDensity.compact,
                              ),
                              icon: const Icon(Icons.bookmark_remove_rounded, size: 15, color: Color(0xFFFF3B30)),
                              label: const Text(
                                'Bỏ theo dõi',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                  color: Color(0xFFFF3B30),
                                ),
                              ),
                              onPressed: () => _unfollowFbPage(customPage),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),

                // 3.1 Bộ lọc 6 loại thông báo (Chọn 1 hoặc nhiều option)
                SizedBox(
                  height: 42,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 3),
                    children: [
                      GestureDetector(
                        onTap: () => ref.read(selectedTopicCategoriesProvider.notifier).clear(),
                        child: Container(
                          margin: const EdgeInsets.only(right: 8),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: selectedTopics.isEmpty
                                ? const Color(0xFF0F172A)
                                : Colors.white.withValues(alpha: 0.72),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(
                              color: selectedTopics.isEmpty
                                  ? const Color(0xFF0F172A)
                                  : const Color(0xFFCBD5E1),
                            ),
                          ),
                          child: Center(
                            child: Text(
                              'Tất cả loại',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: selectedTopics.isEmpty ? Colors.white : const Color(0xFF334155),
                              ),
                            ),
                          ),
                        ),
                      ),
                      ..._topicFilterOptions.map((opt) {
                        final code = opt['code']!;
                        final isChecked = selectedTopics.contains(code);
                        final catColor = _getCategoryColor(code);
                        return GestureDetector(
                          onTap: () => ref.read(selectedTopicCategoriesProvider.notifier).toggle(code),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 160),
                            margin: const EdgeInsets.only(right: 8),
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: isChecked ? catColor : Colors.white.withValues(alpha: 0.75),
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(
                                color: isChecked ? catColor : const Color(0xFFCBD5E1),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                if (isChecked) ...[
                                  const Icon(Icons.check_rounded, size: 14, color: Colors.white),
                                  const SizedBox(width: 4),
                                ],
                                Text(
                                  opt['label']!,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: isChecked ? Colors.white : const Color(0xFF334155),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      }),
                    ],
                  ),
                ),

                // 3.5 Banner hiển thị bộ lọc môn học riêng (nếu có)
                if (courseFilter != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 6),
                    child: LiquidGlassContainer(
                      borderRadius: 16,
                      blurSigma: 16,
                      opacity: 0.88,
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      gradientColors: [
                        const Color(0xFF007AFF).withValues(alpha: 0.15),
                        Colors.white.withValues(alpha: 0.95),
                      ],
                      child: Row(
                        children: [
                          const Icon(Icons.school_rounded, color: Color(0xFF007AFF), size: 18),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Đang lọc theo môn học:',
                                  style: TextStyle(
                                    fontSize: 10,
                                    color: Color(0xFF64748B),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                Text(
                                  '${courseFilter.courseName} • ${courseFilter.courseCode}',
                                  style: const TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF0F172A),
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          TextButton.icon(
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              visualDensity: VisualDensity.compact,
                            ),
                            icon: const Icon(Icons.close_rounded, size: 15, color: Color(0xFFFF3B30)),
                            label: const Text(
                              'Bỏ lọc',
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFFFF3B30),
                              ),
                            ),
                            onPressed: () {
                              ref.read(selectedCourseFilterProvider.notifier).clear();
                            },
                          ),
                        ],
                      ),
                    ),
                  ),

                // 4. Bảng tin thông báo & Banner khẩn cấp
                Expanded(
                  child: feedAsync.when(
                    loading: () => const Center(child: CircularProgressIndicator()),
                    error: (err, stack) => Center(child: Text('Lỗi tải dữ liệu: $err')),
                    data: (page) {
                      var items = page.items;

                      // Lọc theo Kênh nguồn (Phòng CTSV, Đào tạo, Tất cả...)
                      if (selectedCategory != 'ALL') {
                        items = items.where((item) {
                          return item.sourceChannel == selectedCategory ||
                              item.sourceType == selectedCategory;
                        }).toList();
                      }

                      // Lọc kết hợp theo 6 loại thông báo (Chọn 1 hoặc nhiều option: Học bổng, Điểm số...)
                      if (selectedTopics.isNotEmpty) {
                        items = items.where((item) {
                          final cat = (item.category ?? '').toUpperCase();
                          final catCode = (item.categoryCode ?? '').toUpperCase();
                          return selectedTopics.contains(cat) || selectedTopics.contains(catCode);
                        }).toList();
                      }

                      // Lọc chính xác theo môn học được chọn (nếu có)
                      if (courseFilter != null) {
                        final targetCode = courseFilter.courseCode.toLowerCase();
                        final targetName = courseFilter.courseName.toLowerCase();
                        items = items.where((item) {
                          // 1. Khớp mã học phần đầy đủ (vd: 1023603.2610.23.99)
                          if (item.courseCode != null && item.courseCode!.toLowerCase().contains(targetCode)) {
                            return true;
                          }
                          // 2. Khớp trong danh sách tags (vd: #1023603.2610.23.99)
                          if (item.tags.any((t) => t.toLowerCase().contains(targetCode))) {
                            return true;
                          }
                          // 3. Khớp mã lớp rút gọn nếu có (vd: 23.Nh99 từ 1023603.2610.23.99)
                          final parts = targetCode.split('.');
                          if (parts.length >= 4) {
                            final shortClass = '${parts[2]}.Nh${parts[3]}';
                            final shortClassRaw = '${parts[2]}.${parts[3]}';
                            if (item.title.toLowerCase().contains(shortClass.toLowerCase()) ||
                                item.title.toLowerCase().contains(shortClassRaw.toLowerCase()) ||
                                item.content.toLowerCase().contains(shortClass.toLowerCase())) {
                              return true;
                            }
                          }
                          // 4. Khớp tên học phần trong tiêu đề hoặc nội dung (vd: "Chuyên đề công nghệ")
                          if (item.title.toLowerCase().contains(targetName) ||
                              item.summary.toLowerCase().contains(targetName) ||
                              item.content.toLowerCase().contains(targetName)) {
                            return true;
                          }
                          return false;
                        }).toList();
                      }

                      // Lọc theo Search Query
                      if (_searchQuery.isNotEmpty) {
                        final q = _searchQuery.toLowerCase();
                        items = items.where((item) {
                          return item.title.toLowerCase().contains(q) ||
                              item.content.toLowerCase().contains(q) ||
                              item.summary.toLowerCase().contains(q) ||
                              (item.courseCode != null && item.courseCode!.toLowerCase().contains(q));
                        }).toList();
                      }

                      // Tìm thông báo khẩn cấp chưa xác nhận (FR-08)
                      final unacknowledgedEmergency =
                          items.where((i) => i.isEmergency && !i.isAcknowledged).toList();

                      if (items.isEmpty) {
                        if (courseFilter != null) {
                          return Center(
                            child: Padding(
                              padding: const EdgeInsets.all(24.0),
                              child: Column(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.info_outline_rounded, size: 48, color: Colors.blueGrey),
                                  const SizedBox(height: 12),
                                  Text(
                                    'Chưa có thông báo nào cho môn:\n${courseFilter.courseName}',
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: Color(0xFF334155)),
                                  ),
                                  const SizedBox(height: 14),
                                  ElevatedButton.icon(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: const Color(0xFF007AFF),
                                      foregroundColor: Colors.white,
                                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                                    ),
                                    icon: const Icon(Icons.refresh_rounded, size: 18),
                                    label: const Text('Xem tất cả thông báo'),
                                    onPressed: () {
                                      ref.read(selectedCourseFilterProvider.notifier).clear();
                                    },
                                  ),
                                ],
                              ),
                            ),
                          );
                        }
                        return const Center(
                          child: Text('Không có thông báo nào phù hợp bộ lọc.'),
                        );
                      }

                      return ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                        itemCount: items.length + (unacknowledgedEmergency.isNotEmpty ? 1 : 0),
                        itemBuilder: (context, index) {
                          // Banner Cảnh Báo Khẩn Cấp Liquid Glass (Đỏ mờ nổi bật)
                          if (unacknowledgedEmergency.isNotEmpty && index == 0) {
                            final emergencyItem = unacknowledgedEmergency.first;
                            return LiquidGlassContainer(
                              borderRadius: 20,
                              blurSigma: 24,
                              opacity: 0.85,
                              margin: const EdgeInsets.only(bottom: 14),
                              padding: const EdgeInsets.all(16),
                              gradientColors: [
                                const Color(0xFFFF3B30).withValues(alpha: 0.18),
                                Colors.white.withValues(alpha: 0.9),
                              ],
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.all(6),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFFF3B30).withValues(alpha: 0.18),
                                          shape: BoxShape.circle,
                                        ),
                                        child: const Icon(Icons.warning_amber_rounded, color: Color(0xFFFF3B30), size: 20),
                                      ),
                                      const SizedBox(width: 8),
                                      const Text(
                                        'CẢNH BÁO NGHỈ HỌC / ĐỔI PHÒNG ĐỘT XUẤT',
                                        style: TextStyle(
                                          color: Color(0xFFD32F2F),
                                          fontWeight: FontWeight.bold,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    emergencyItem.title,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 14,
                                      color: Color(0xFF0F172A),
                                    ),
                                  ),
                                  const SizedBox(height: 10),
                                  LiquidGlassButton(
                                    label: 'Xác nhận "Đã nhận tin" (Read Receipt)',
                                    height: 42,
                                    onPressed: () {
                                      showDialog(
                                        context: context,
                                        builder: (ctx) => EmergencyAlertModal(
                                          notification: emergencyItem,
                                          onAcknowledge: () {
                                            Navigator.of(ctx).pop();
                                            ref.invalidate(notificationFeedProvider);
                                          },
                                        ),
                                      );
                                    },
                                  ),
                                ],
                              ),
                            );
                          }

                          final itemIndex = unacknowledgedEmergency.isNotEmpty ? index - 1 : index;
                          final notif = items[itemIndex];
                          final validAttachments = notif.attachments.where((att) {
                            if (att == null) return false;
                            final url = (att is Map ? att['url'] : att.toString())?.toString().trim() ?? '';
                            return url.startsWith('http');
                          }).toList();

                          return LiquidGlassCard(
                            borderRadius: 22,
                            padding: const EdgeInsets.all(16),
                            margin: const EdgeInsets.only(bottom: 12),
                            onTap: () {
                              context.go('/notifications/${notif.id}');
                            },
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                // Hàng 1: Nguồn kênh & Tag học phần (nếu thuộc môn học của SV)
                                Row(
                                  children: [
                                    LiquidGlassBadge(
                                      text: _getChannelLabel(notif.sourceChannel ?? ''),
                                      color: _getChannelColor(notif.sourceChannel ?? ''),
                                    ),
                                    if (notif.categoryName != null && notif.categoryName!.isNotEmpty) ...[
                                      const SizedBox(width: 6),
                                      LiquidGlassBadge(
                                        text: notif.categoryName!,
                                        color: _getCategoryColor(notif.category),
                                      ),
                                    ],
                                    if (notif.courseCode != null &&
                                        notif.courseCode!.trim().isNotEmpty &&
                                        notif.sourceChannel != 'FB_CTSV' &&
                                        notif.sourceChannel != 'FB_TUVAN_SV' &&
                                        notif.sourceChannel != 'DUT_GENERAL' &&
                                        notif.sourceChannel != 'DUT_STUDENT_AFFAIRS') ...[
                                      const SizedBox(width: 6),
                                      LiquidGlassBadge(
                                        text: notif.courseCode!,
                                        color: const Color(0xFF5856D6),
                                        icon: Icons.school_rounded,
                                      ),
                                    ],
                                    const Spacer(),
                                    Text(
                                      _formatDate(notif.publishedAt),
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w500,
                                        color: Colors.blueGrey.shade600,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 10),

                                // Tiêu đề thông báo
                                Text(
                                  notif.title,
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: notif.isRead ? FontWeight.w600 : FontWeight.w700,
                                    color: const Color(0xFF0F172A),
                                    letterSpacing: -0.3,
                                  ),
                                ),
                                const SizedBox(height: 6),

                                // Nội dung tóm tắt
                                Text(
                                  notif.summary.isNotEmpty ? notif.summary : notif.content,
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    fontSize: 13,
                                    color: Colors.blueGrey.shade800,
                                    height: 1.35,
                                  ),
                                ),
                                const SizedBox(height: 10),

                                // Footer: Ưu tiên & Trạng thái đọc
                                Row(
                                  children: [
                                    LiquidGlassBadge(
                                      text: notif.priority,
                                      color: _getPriorityColor(notif.priority),
                                    ),
                                    const Spacer(),
                                    if (notif.isRead)
                                      Row(
                                        children: [
                                          Icon(Icons.check_circle_outline_rounded, size: 14, color: Colors.blueGrey.shade400),
                                          const SizedBox(width: 4),
                                          Text(
                                            'Đã đọc',
                                            style: TextStyle(fontSize: 11, color: Colors.blueGrey.shade400),
                                          ),
                                        ],
                                      )
                                    else
                                      const Row(
                                        children: [
                                          Icon(Icons.fiber_new_rounded, size: 18, color: Color(0xFF007AFF)),
                                          SizedBox(width: 4),
                                          Text(
                                            'Chưa đọc',
                                            style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF007AFF)),
                                          ),
                                        ],
                                      ),
                                  ],
                                ),

                                // Tệp đính kèm (nếu có - tuyệt đối không hiển thị tệp giả lập)
                                if (validAttachments.isNotEmpty) ...[
                                  const SizedBox(height: 10),
                                  Wrap(
                                    spacing: 6,
                                    runSpacing: 4,
                                    children: validAttachments.map((att) {
                                      final title = (att is Map ? att['title'] : null) ?? 'Tệp đính kèm';
                                      final url = (att is Map ? att['url'] : null) ?? '';
                                      return InkWell(
                                        onTap: url.toString().isNotEmpty ? () => _openSourceUrl(url.toString()) : null,
                                        borderRadius: BorderRadius.circular(10),
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFE2E8F0),
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                          child: Row(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              const Icon(Icons.attach_file_rounded, size: 13, color: Color(0xFF475569)),
                                              const SizedBox(width: 3),
                                              Text(
                                                title.toString(),
                                                style: const TextStyle(fontSize: 11, color: Color(0xFF334155), fontWeight: FontWeight.w500),
                                              ),
                                            ],
                                          ),
                                        ),
                                      );
                                    }).toList(),
                                  ),
                                ],

                                const SizedBox(height: 12),
                                const Divider(height: 1, color: Color(0xFFE2E8F0)),
                                const SizedBox(height: 10),

                                // Hàng Nút Hành Động: [Thêm Nhắc Nhở] & [Điều Hướng Facebook / Nguồn Gốc]
                                Row(
                                  children: [
                                    // 1. Nút Thêm Nhắc Nhở
                                    Expanded(
                                      child: InkWell(
                                        borderRadius: BorderRadius.circular(12),
                                        onTap: () => _showAddReminderDialog(context, notif, session),
                                        child: Container(
                                          height: 36,
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFFF9500).withValues(alpha: 0.12),
                                            borderRadius: BorderRadius.circular(12),
                                            border: Border.all(color: const Color(0xFFFF9500).withValues(alpha: 0.35)),
                                          ),
                                          child: const Row(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            children: [
                                              Icon(Icons.alarm_add_rounded, size: 16, color: Color(0xFFE65100)),
                                              SizedBox(width: 6),
                                              Text(
                                                'Thêm nhắc nhở',
                                                style: TextStyle(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.bold,
                                                  color: Color(0xFFE65100),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 8),

                                    // 2. Nút Điều Hướng tới nguồn (Đặc biệt nguồn Facebook có kèm nút Copy link)
                                    if ((notif.sourceChannel?.startsWith('FB_') ?? false) ||
                                        (notif.sourceUrl != null && notif.sourceUrl!.contains('facebook.com')))
                                      Expanded(
                                        child: Row(
                                          children: [
                                            Expanded(
                                              child: InkWell(
                                                borderRadius: BorderRadius.circular(12),
                                                onTap: () {
                                                  final url = notif.sourceUrl;
                                                  if (url != null && url.trim().isNotEmpty && url.startsWith('http')) {
                                                    _openSourceUrl(url.trim());
                                                  } else {
                                                    final fallbackUrl = notif.sourceChannel == 'FB_CTSV'
                                                        ? 'https://www.facebook.com/ctsvdhbkdhdn'
                                                        : (notif.sourceChannel == 'FB_TUVAN_SV'
                                                            ? 'https://www.facebook.com/tuvansinhvien.dut'
                                                            : 'https://www.facebook.com');
                                                    _openSourceUrl(fallbackUrl);
                                                  }
                                                },
                                                child: Container(
                                                  height: 36,
                                                  decoration: BoxDecoration(
                                                    color: const Color(0xFF1877F2).withValues(alpha: 0.12),
                                                    borderRadius: BorderRadius.circular(12),
                                                    border: Border.all(color: const Color(0xFF1877F2).withValues(alpha: 0.4)),
                                                  ),
                                                  child: const Row(
                                                    mainAxisAlignment: MainAxisAlignment.center,
                                                    children: [
                                                      Icon(Icons.open_in_new_rounded, size: 15, color: Color(0xFF1877F2)),
                                                      SizedBox(width: 5),
                                                      Text(
                                                        'Xem Facebook',
                                                        style: TextStyle(
                                                          fontSize: 12,
                                                          fontWeight: FontWeight.bold,
                                                          color: Color(0xFF1877F2),
                                                        ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                              ),
                                            ),
                                            const SizedBox(width: 6),
                                            // Nút Sao chép liên kết bài viết Facebook
                                            InkWell(
                                              borderRadius: BorderRadius.circular(12),
                                              onTap: () {
                                                final postLink = notif.sourceUrl ??
                                                    (notif.sourceChannel == 'FB_CTSV'
                                                        ? 'https://www.facebook.com/ctsvdhbkdhdn'
                                                        : 'https://www.facebook.com/tuvansinhvien.dut');
                                                Clipboard.setData(ClipboardData(text: postLink));
                                                AppToast.showSuccess(context, 'Đã sao chép liên kết bài viết Facebook!');
                                              },
                                              child: Container(
                                                width: 36,
                                                height: 36,
                                                decoration: BoxDecoration(
                                                  color: const Color(0xFF1877F2).withValues(alpha: 0.1),
                                                  borderRadius: BorderRadius.circular(12),
                                                  border: Border.all(color: const Color(0xFF1877F2).withValues(alpha: 0.3)),
                                                ),
                                                child: const Icon(Icons.copy_rounded, size: 16, color: Color(0xFF1877F2)),
                                              ),
                                            ),
                                          ],
                                        ),
                                      )
                                    else if (notif.sourceUrl != null && notif.sourceUrl!.startsWith('http'))
                                      Expanded(
                                        child: InkWell(
                                          borderRadius: BorderRadius.circular(12),
                                          onTap: () => _openSourceUrl(notif.sourceUrl!),
                                          child: Container(
                                            height: 36,
                                            decoration: BoxDecoration(
                                              color: const Color(0xFF007AFF).withValues(alpha: 0.08),
                                              borderRadius: BorderRadius.circular(12),
                                              border: Border.all(color: const Color(0xFF007AFF).withValues(alpha: 0.25)),
                                            ),
                                            child: const Row(
                                              mainAxisAlignment: MainAxisAlignment.center,
                                              children: [
                                                Icon(Icons.link_rounded, size: 16, color: Color(0xFF007AFF)),
                                                SizedBox(width: 6),
                                                Text(
                                                  'Mở liên kết gốc',
                                                  style: TextStyle(
                                                    fontSize: 12,
                                                    fontWeight: FontWeight.w600,
                                                    color: Color(0xFF007AFF),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ),
                                  ],
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

  String _getChannelLabel(String channel) {
    switch (channel) {
      case 'DUT_GENERAL':
        return 'Thông báo chung';
      case 'DUT_COURSE_CLASS':
        return 'Lớp học phần';
      case 'DUT_TRAINING':
        return 'Đào tạo';
      case 'DUT_TUITION_FEE':
        return 'Học phí';
      case 'DUT_TESTING_QA':
        return 'Khảo thí';
      case 'DUT_STUDENT_AFFAIRS':
        return 'Công tác SV';
      case 'DUT_REGULATIONS':
        return 'Quy chế';
      case 'FB_CTSV':
        return 'Fanpage CTSV';
      case 'FB_TUVAN_SV':
        return 'Tư vấn SV';
      default:
        if (channel.startsWith('FB_')) {
          final matched = _customFollowedPages.firstWhere(
            (p) => p['channel_code'] == channel,
            orElse: () => {},
          );
          if (matched.isNotEmpty && matched['page_name'] != null) {
            return matched['page_name'].toString();
          }
          return 'Fanpage FB';
        }
        return 'Thông báo';
    }
  }

  Color _getChannelColor(String channel) {
    if (channel.startsWith('FB_')) {
      return const Color(0xFF1877F2); // Facebook Blue
    }
    switch (channel) {
      case 'DUT_COURSE_CLASS':
        return const Color(0xFF5856D6); // Purple
      case 'DUT_TRAINING':
        return const Color(0xFF007AFF); // Blue
      case 'DUT_TUITION_FEE':
        return const Color(0xFFFF9500); // Orange
      case 'DUT_TESTING_QA':
        return const Color(0xFF34C759); // Green
      case 'DUT_STUDENT_AFFAIRS':
        return const Color(0xFFE91E63); // Pink
      case 'DUT_GENERAL':
        return const Color(0xFF0288D1); // Light Blue
      case 'DUT_REGULATIONS':
        return const Color(0xFF795548); // Brown
      default:
        return const Color(0xFF64748B);
    }
  }

  Color _getCategoryColor(String? category) {
    switch (category?.toUpperCase()) {
      case 'GRADE':
        return const Color(0xFFAF52DE);
      case 'CAREER':
        return const Color(0xFF30B0C7);
      case 'SCHOLARSHIP':
        return const Color(0xFFD97706);
      case 'ADMINISTRATIVE':
        return const Color(0xFFFF9500);
      case 'EVENT':
        return const Color(0xFF34C759);
      case 'ACADEMIC':
      default:
        return const Color(0xFF007AFF);
    }
  }

  Color _getPriorityColor(String priority) {
    switch (priority.toUpperCase()) {
      case 'URGENT':
        return const Color(0xFFFF3B30);
      case 'HIGH':
        return const Color(0xFFFF9500);
      case 'NORMAL':
        return const Color(0xFF007AFF);
      default:
        return const Color(0xFF8E8E93);
    }
  }

  String _formatDate(DateTime dt) {
    return DateFormat('dd/MM HH:mm').format(dt);
  }

  Future<void> _openSourceUrl(String urlString) async {
    final uri = Uri.parse(urlString);
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication, webOnlyWindowName: '_blank');
    } catch (_) {
      try {
        await launchUrl(uri);
      } catch (err) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Không thể mở liên kết: $err')),
          );
        }
      }
    }
  }

  void _showAddReminderDialog(BuildContext context, NotificationItem notif, dynamic session) {
    showAddReminderModal(context, ref, notif, session);
  }

  Future<void> _unfollowFbPage(Map<String, dynamic> customPage) async {
    final pageId = customPage['id'] ?? customPage['page_url'];
    final pageName = customPage['page_name'] ?? 'Fanpage';
    try {
      await ref.read(dioProvider).delete('/api/v1/facebook/unfollow/$pageId');
      if (mounted) {
        AppToast.showSuccess(context, 'Đã bỏ theo dõi Fanpage "$pageName"');
      }
      await _loadFollowedPages();
      ref.read(selectedCategoryProvider.notifier).setCategory('ALL');
      ref.invalidate(notificationFeedProvider);
    } catch (err) {
      if (mounted) {
        AppToast.showError(context, 'Không thể bỏ theo dõi: $err');
      }
    }
  }

  Future<void> _showFollowFbPageDialog(BuildContext context, dynamic session) async {
    final urlCtrl = TextEditingController();
    final nameCtrl = TextEditingController();
    bool isSubmitting = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (modalCtx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                bottom: MediaQuery.of(ctx).viewInsets.bottom,
              ),
              child: LiquidGlassContainer(
                borderRadius: 28,
                blurSigma: 24,
                opacity: 0.95,
                padding: const EdgeInsets.all(22),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1877F2).withValues(alpha: 0.15),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.facebook_rounded, color: Color(0xFF1877F2), size: 26),
                        ),
                        const SizedBox(width: 12),
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Theo dõi Fanpage Facebook',
                                style: TextStyle(
                                  fontSize: 17,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF0F172A),
                                ),
                              ),
                              Text(
                                'Cào và nhận thông báo tự động từ trang',
                                style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.close_rounded, color: Color(0xFF64748B)),
                          onPressed: () => Navigator.pop(ctx),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    // Link Fanpage
                    const Text(
                      'Đường link Fanpage Facebook *',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF1E293B)),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: urlCtrl,
                      decoration: InputDecoration(
                        hintText: 'VD: https://www.facebook.com/clb.guitar.dut',
                        hintStyle: TextStyle(fontSize: 13, color: Colors.blueGrey.shade300),
                        prefixIcon: const Icon(Icons.link_rounded, color: Color(0xFF1877F2), size: 20),
                        filled: true,
                        fillColor: const Color(0xFFF1F5F9),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                    ),
                    const SizedBox(height: 12),

                    // Tên gợi nhớ
                    const Text(
                      'Tên gợi nhớ (Không bắt buộc)',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Color(0xFF1E293B)),
                    ),
                    const SizedBox(height: 6),
                    TextField(
                      controller: nameCtrl,
                      decoration: InputDecoration(
                        hintText: 'VD: CLB Guitar Bách Khoa',
                        hintStyle: TextStyle(fontSize: 13, color: Colors.blueGrey.shade300),
                        prefixIcon: const Icon(Icons.badge_rounded, color: Color(0xFF64748B), size: 20),
                        filled: true,
                        fillColor: const Color(0xFFF1F5F9),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Nút Submit
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF1877F2),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          elevation: 0,
                        ),
                        icon: isSubmitting
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                              )
                            : const Icon(Icons.bookmark_add_rounded, size: 20),
                        label: Text(
                          isSubmitting ? 'Đang phân tích & Cào bài...' : 'Theo dõi & Cào bài ngay',
                          style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700),
                        ),
                        onPressed: isSubmitting
                            ? null
                            : () async {
                                final inputUrl = urlCtrl.text.trim();
                                if (inputUrl.isEmpty) {
                                  AppToast.showError(context, 'Vui lòng dán link Fanpage Facebook');
                                  return;
                                }

                                setModalState(() {
                                  isSubmitting = true;
                                });

                                try {
                                  final res = await ref.read(dioProvider).post(
                                    '/api/v1/facebook/follow',
                                    data: {
                                      'student_id': session?.studentCode ?? '102230026',
                                      'page_url': inputUrl,
                                      'page_name': nameCtrl.text.trim(),
                                    },
                                  );

                                  final scrapedCount = res.data?['data']?['scraped_posts_count'] ?? 0;
                                  final pageName = res.data?['data']?['page_name'] ?? 'Fanpage';

                                  if (context.mounted) {
                                    Navigator.pop(ctx);
                                    AppToast.showSuccess(
                                      context,
                                      'Đã theo dõi "$pageName"! Đã cào được $scrapedCount bài viết mới.',
                                    );
                                  }

                                  await _loadFollowedPages();
                                  ref.invalidate(notificationFeedProvider);
                                } catch (err) {
                                  setModalState(() {
                                    isSubmitting = false;
                                  });
                                  if (context.mounted) {
                                    AppToast.showError(context, 'Lỗi: $err');
                                  }
                                }
                              },
                      ),
                    ),
                    const SizedBox(height: 10),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }
}
