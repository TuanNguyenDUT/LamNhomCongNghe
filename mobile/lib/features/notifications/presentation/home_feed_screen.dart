import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../domain/notification_item.dart';
import 'emergency_alert_modal.dart';
import 'notification_providers.dart';

final selectedCategoryProvider = StateProvider<String>((ref) => 'ALL');
final searchQueryProvider = StateProvider<String>((ref) => '');

class HomeFeedScreen extends ConsumerStatefulWidget {
  const HomeFeedScreen({super.key});

  @override
  ConsumerState<HomeFeedScreen> createState() => _HomeFeedScreenState();
}

class _HomeFeedScreenState extends ConsumerState<HomeFeedScreen> {
  final TextEditingController _searchController = TextEditingController();

  final List<Map<String, String>> _categories = const [
    {'code': 'ALL', 'label': '🌟 Tất cả'},
    {'code': 'DUT_COURSE_CLASS', 'label': '📚 Lớp học phần'},
    {'code': 'DUT_TRAINING', 'label': '🎓 Đào tạo'},
    {'code': 'DUT_TUITION_FEE', 'label': '💰 Học phí, lệ phí'},
    {'code': 'DUT_TESTING_QA', 'label': '📝 Khảo thí & ĐBCL'},
    {'code': 'DUT_STUDENT_AFFAIRS', 'label': '🤝 Công tác SV'},
    {'code': 'DUT_GENERAL', 'label': '📢 Thông báo chung'},
    {'code': 'DUT_REGULATIONS', 'label': '⚖️ Quy chế - Quy định'},
    {'code': 'FB_CTSV', 'label': '🔵 Fanpage CTSV'},
    {'code': 'FB_TUVAN_SV', 'label': '💬 Tư vấn SV DUT'},
  ];

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final selectedCategory = ref.watch(selectedCategoryProvider);
    final searchQuery = ref.watch(searchQueryProvider);
    final feedAsync = ref.watch(notificationListProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Bảng Tin Sinh Viên DUT'),
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: () => ref.refresh(notificationListProvider),
          ),
        ],
      ),
      body: Column(
        children: [
          // 1. Thanh tìm kiếm
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: 'Tìm kiếm thông báo, mã môn, giảng viên...',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _searchController.text.isNotEmpty
                    ? IconButton(
                        icon: const Icon(Icons.clear),
                        onPressed: () {
                          _searchController.clear();
                          ref.read(searchQueryProvider.notifier).state = '';
                        },
                      )
                    : null,
                filled: true,
                fillColor: Colors.grey.shade100,
                contentPadding: const EdgeInsets.symmetric(vertical: 0),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide.none,
                ),
              ),
              onChanged: (val) {
                ref.read(searchQueryProvider.notifier).state = val;
              },
            ),
          ),

          // 2. Thanh lọc 7 chuyên mục web trường & 2 Fanpage Facebook
          SizedBox(
            height: 44,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _categories.length,
              separatorBuilder: (context, index) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final cat = _categories[index];
                final isSelected = cat['code'] == selectedCategory;
                return ChoiceChip(
                  label: Text(cat['label']!),
                  selected: isSelected,
                  selectedColor: Theme.of(context).primaryColor.withOpacity(0.15),
                  onSelected: (selected) {
                    if (selected) {
                      ref.read(selectedCategoryProvider.notifier).state = cat['code']!;
                    }
                  },
                );
              },
            ),
          ),
          const SizedBox(height: 8),

          // 3. Danh sách thông báo & Banner khẩn cấp
          Expanded(
            child: feedAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, stack) => Center(
                child: Padding(
                  padding: const EdgeInsets.all(20),
                  child: Text('Lỗi tải bảng tin: $err'),
                ),
              ),
              data: (page) {
                var items = page.items;

                // Lọc theo Category
                if (selectedCategory != 'ALL') {
                  items = items.where((item) {
                    return item.sourceChannel == selectedCategory ||
                        item.sourceType == selectedCategory;
                  }).toList();
                }

                // Lọc theo Search Query
                if (searchQuery.isNotEmpty) {
                  final q = searchQuery.toLowerCase();
                  items = items.where((item) {
                    return item.title.toLowerCase().includes(q) ||
                        item.content.toLowerCase().includes(q) ||
                        item.summary.toLowerCase().includes(q) ||
                        (item.courseCode != null && item.courseCode!.toLowerCase().includes(q));
                  }).toList();
                }

                // Tìm thông báo khẩn cấp chưa xác nhận để ghim lên đầu
                final unacknowledgedEmergency = items.where((i) => i.isEmergency && !i.isAcknowledged).toList();

                if (items.isEmpty) {
                  return const Center(
                    child: Text('Không có thông báo nào phù hợp bộ lọc.'),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  itemCount: items.length + (unacknowledgedEmergency.isNotEmpty ? 1 : 0),
                  itemBuilder: (context, index) {
                    // Hiển thị Banner Ghim Cảnh Báo Khẩn Cấp (FR-08)
                    if (unacknowledgedEmergency.isNotEmpty && index == 0) {
                      final emergencyItem = unacknowledgedEmergency.first;
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: Colors.red.shade400, width: 1.5),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.emergency, color: Colors.red, size: 22),
                                const SizedBox(width: 8),
                                const Text(
                                  'CẢNH BÁO NGHỈ HỌC / ĐỔI LỊCH ĐỘT XUẤT',
                                  style: TextStyle(
                                    color: Colors.red,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              emergencyItem.title,
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                            const SizedBox(height: 8),
                            ElevatedButton(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.red.shade700,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              ),
                              onPressed: () {
                                showDialog(
                                  context: context,
                                  builder: (ctx) => EmergencyAlertModal(
                                    notification: emergencyItem,
                                    onAcknowledge: () {
                                      Navigator.of(ctx).pop();
                                      ref.refresh(notificationListProvider);
                                    },
                                  ),
                                );
                              },
                              child: const Text('Xem & Xác nhận "Đã nhận tin"'),
                            ),
                          ],
                        ),
                      );
                    }

                    final actualIndex = unacknowledgedEmergency.isNotEmpty ? index - 1 : index;
                    final item = items[actualIndex];

                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                        side: BorderSide(
                          color: item.isEmergency
                              ? Colors.red.shade300
                              : (item.isRead ? Colors.grey.shade200 : Colors.blue.shade200),
                        ),
                      ),
                      elevation: item.isRead ? 0.5 : 2,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(12),
                        onTap: () {
                          if (item.isEmergency && !item.isAcknowledged) {
                            showDialog(
                              context: context,
                              builder: (ctx) => EmergencyAlertModal(
                                notification: item,
                                onAcknowledge: () {
                                  Navigator.of(ctx).pop();
                                  ref.refresh(notificationListProvider);
                                },
                              ),
                            );
                          } else {
                            context.push('/notifications/${item.id}');
                          }
                        },
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Header: Tags & Priority Badge
                              Row(
                                children: [
                                  if (item.courseCode != null)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: Colors.blue.shade50,
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                      child: Text(
                                        item.courseCode!,
                                        style: TextStyle(
                                          color: Colors.blue.shade800,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ),
                                  const Spacer(),
                                  _buildPriorityChip(item.priority),
                                ],
                              ),
                              const SizedBox(height: 8),
                              // Title
                              Text(
                                item.title,
                                style: TextStyle(
                                  fontWeight: item.isRead ? FontWeight.normal : FontWeight.bold,
                                  fontSize: 15,
                                  color: Colors.black87,
                                ),
                              ),
                              const SizedBox(height: 6),
                              // Summary
                              Text(
                                item.summary.isNotEmpty ? item.summary : item.content,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
                              ),
                              const SizedBox(height: 10),
                              // Footer: Date & Tags
                              Row(
                                children: [
                                  Icon(Icons.access_time, size: 14, color: Colors.grey.shade500),
                                  const SizedBox(width: 4),
                                  Text(
                                    DateFormat('dd/MM HH:mm').format(item.publishedAt.toLocal()),
                                    style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                                  ),
                                  const Spacer(),
                                  if (item.tags.isNotEmpty)
                                    Text(
                                      item.tags.take(2).join(' '),
                                      style: TextStyle(fontSize: 11, color: Colors.blue.shade700),
                                    ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPriorityChip(String priority) {
    Color bg = Colors.grey.shade100;
    Color fg = Colors.grey.shade800;

    switch (priority.toUpperCase()) {
      case 'URGENT':
        bg = Colors.red.shade100;
        fg = Colors.red.shade800;
        break;
      case 'HIGH':
        bg = Colors.orange.shade100;
        fg = Colors.orange.shade800;
        break;
      case 'NORMAL':
      case 'MEDIUM':
        bg = Colors.blue.shade50;
        fg = Colors.blue.shade800;
        break;
      case 'LOW':
        bg = Colors.grey.shade100;
        fg = Colors.grey.shade600;
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(
        priority.toUpperCase(),
        style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.bold),
      ),
    );
  }
}

