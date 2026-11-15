import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../domain/deadline_item.dart';

final deadlinesListProvider = FutureProvider<List<DeadlineItem>>((ref) async {
  // Mock fallback dữ liệu deadlines
  final now = DateTime.now();
  return [
    DeadlineItem(
      deadlineId: 'd1',
      studentId: '102200001',
      title: 'Hạn nộp học phí học kỳ 2 (2025-2026)',
      description: 'Hoàn thành học phí qua BIDV/VietinBank để không bị khóa tài khoản',
      dueDate: now.add(const Duration(days: 3)),
      status: 'DUE_SOON',
    ),
    DeadlineItem(
      deadlineId: 'd2',
      studentId: '102200001',
      courseCode: 'IT401',
      title: 'Nộp báo cáo đồ án môn CNPM (IT401)',
      description: 'Nộp tài liệu đặc tả SRS và slide thuyết trình sprint 2',
      dueDate: now.add(const Duration(days: 7)),
      status: 'PENDING',
    ),
    DeadlineItem(
      deadlineId: 'd3',
      studentId: '102200001',
      title: 'Nộp chứng chỉ ngoại ngữ TOEIC/IELTS tốt nghiệp',
      description: 'Nộp bản sao công chứng tại Phòng Khảo thí',
      dueDate: now.subtract(const Duration(days: 1)),
      status: 'OVERDUE',
    ),
  ];
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

    return Scaffold(
      appBar: AppBar(
        title: const Text('Quản Lý Hạn Chót (Deadlines)'),
        actions: [
          IconButton(
            icon: const Icon(Icons.calendar_month),
            tooltip: 'Đồng bộ Google Calendar',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Đang đồng bộ hạn chót lên Google Calendar (OAuth 2.0)...'),
                  backgroundColor: Colors.blue,
                ),
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.download),
            tooltip: 'Xuất tệp iCalendar (.ics)',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('Đã tải tệp lịch dut_deadlines.ics thành công!'),
                  backgroundColor: Colors.green,
                ),
              );
            },
          ),
        ],
      ),
      body: Column(
        children: [
          // Filter Chips
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            child: Row(
              children: [
                _buildFilterChip('ALL', 'Tất cả'),
                const SizedBox(width: 8),
                _buildFilterChip('DUE_SOON', '⏳ Sắp đến hạn'),
                const SizedBox(width: 8),
                _buildFilterChip('PENDING', 'Đang chờ'),
                const SizedBox(width: 8),
                _buildFilterChip('OVERDUE', '⚠️ Quá hạn'),
                const SizedBox(width: 8),
                _buildFilterChip('COMPLETED', '✅ Đã xong'),
              ],
            ),
          ),
          const SizedBox(height: 4),

          // Danh sách Deadlines
          Expanded(
            child: deadlinesAsync.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (err, stack) => Center(child: Text('Lỗi: $err')),
              data: (items) {
                var filtered = items;
                if (_selectedFilter != 'ALL') {
                  filtered = items.where((d) => d.status == _selectedFilter).toList();
                }

                if (filtered.isEmpty) {
                  return const Center(child: Text('Không có hạn chót nào trong danh mục này.'));
                }

                return ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final item = filtered[index];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                _buildStatusBadge(item.status),
                                const Spacer(),
                                if (item.courseCode != null)
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.blue.shade50,
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      item.courseCode!,
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.bold,
                                        color: Colors.blue.shade800,
                                      ),
                                    ),
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
                              ),
                            ),
                            if (item.description != null && item.description!.isNotEmpty) ...[
                              const SizedBox(height: 6),
                              Text(
                                item.description!,
                                style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
                              ),
                            ],
                            const SizedBox(height: 12),
                            Row(
                              children: [
                                Icon(Icons.event, size: 16, color: Colors.grey.shade600),
                                const SizedBox(width: 6),
                                Text(
                                  'Hạn: ${DateFormat('dd/MM/yyyy HH:mm').format(item.dueDate.toLocal())}',
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w500,
                                    color: item.isOverdue ? Colors.red : Colors.black87,
                                  ),
                                ),
                                const Spacer(),
                                if (!item.isCompleted)
                                  OutlinedButton.icon(
                                    icon: const Icon(Icons.check, size: 16),
                                    label: const Text('Xong'),
                                    onPressed: () {
                                      ScaffoldMessenger.of(context).showSnackBar(
                                        SnackBar(content: Text('Đã đánh dấu hoàn thành: ${item.title}')),
                                      );
                                    },
                                  ),
                              ],
                            ),
                          ],
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

  Widget _buildFilterChip(String code, String label) {
    final isSelected = _selectedFilter == code;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (val) {
        if (val) setState(() => _selectedFilter = code);
      },
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bg = Colors.grey.shade100;
    Color fg = Colors.grey.shade800;
    String label = status;

    switch (status) {
      case 'DUE_SOON':
        bg = Colors.amber.shade100;
        fg = Colors.amber.shade900;
        label = 'SẮP ĐẾN HẠN';
        break;
      case 'OVERDUE':
        bg = Colors.red.shade100;
        fg = Colors.red.shade900;
        label = 'QUÁ HẠN';
        break;
      case 'COMPLETED':
        bg = Colors.green.shade100;
        fg = Colors.green.shade900;
        label = 'ĐÃ HOÀN THÀNH';
        break;
      case 'PENDING':
        bg = Colors.blue.shade50;
        fg = Colors.blue.shade900;
        label = 'ĐANG CHỜ';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(6)),
      child: Text(label, style: TextStyle(color: fg, fontSize: 11, fontWeight: FontWeight.bold)),
    );
  }
}

