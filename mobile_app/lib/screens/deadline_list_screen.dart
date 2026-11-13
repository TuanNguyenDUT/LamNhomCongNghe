import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../models/deadline.dart';
import '../services/api_service.dart';

class DeadlineListScreen extends StatefulWidget {
  const DeadlineListScreen({super.key});

  @override
  State<DeadlineListScreen> createState() => _DeadlineListScreenState();
}

class _DeadlineListScreenState extends State<DeadlineListScreen> {
  final DeadlineApiService _api = DeadlineApiService();
  List<DeadlineItem> _deadlines = [];
  List<String> _courses = [];
  bool _isLoading = true;

  String? _selectedCourse;
  String? _selectedStatus;
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    setState(() => _isLoading = true);
    final courses = await _api.fetchCourses();
    _courses = courses;
    await _fetchData();
  }

  Future<void> _fetchData() async {
    final list = await _api.async_fetchDeadlines(
      subject: _selectedCourse,
      status: _selectedStatus,
      search: _searchController.text.trim(),
    );
    if (mounted) {
      setState(() {
        _deadlines = list;
        _isLoading = false;
      });
    }
  }

  // Toggle checkbox hoàn thành (Task 4)
  Future<void> _handleToggleDone(DeadlineItem item) async {
    // Cập nhật UI ngay lập tức (Optimistic update)
    setState(() {
      final index = _deadlines.indexWhere((e) => e.id == item.id);
      if (index != -1) {
        _deadlines[index] = _deadlines[index].copyWith(isCompleted: !item.isCompleted);
      }
    });

    await _api.toggleComplete(item.id);
    _fetchData();
  }

  // Xóa deadline (Task 3)
  Future<void> _handleDelete(int id) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Xác nhận xóa'),
        content: const Text('Bạn có chắc chắn muốn xóa hạn chót này không?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Hủy')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Xóa'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _api.deleteDeadline(id);
      _fetchData();
    }
  }

  // Mở BottomSheet thêm hạn chót mới (Task 1 & 3)
  void _openAddDeadlineSheet() {
    final titleCtrl = TextEditingController();
    final noteCtrl = TextEditingController();
    String chosenCourse = _courses.isNotEmpty ? _courses.first : 'IT401';
    DateTime chosenDueDate = DateTime.now().add(const Duration(days: 2));

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 20,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('➕ Thêm Deadline Mới', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(ctx)),
                ],
              ),
              const SizedBox(height: 12),
              TextField(
                controller: titleCtrl,
                decoration: const InputDecoration(
                  labelText: 'Tên bài tập / hạn chót *',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.assignment),
                ),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: chosenCourse,
                decoration: const InputDecoration(
                  labelText: 'Môn học (Course) *',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.book),
                ),
                items: _courses
                    .map((c) => DropdownMenuItem(value: c, child: Text(c)))
                    .toList(),
                onChanged: (val) {
                  if (val != null) setModalState(() => chosenCourse = val);
                },
              ),
              const SizedBox(height: 12),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.calendar_today, color: Colors.blue),
                title: const Text('Hạn chót (Due Date)'),
                subtitle: Text(DateFormat('HH:mm - EEEE, dd/MM/yyyy', 'vi').format(chosenDueDate)),
                trailing: TextButton(
                  onPressed: () async {
                    final date = await showDatePicker(
                      context: ctx,
                      initialDate: chosenDueDate,
                      firstDate: DateTime.now().subtract(const Duration(days: 30)),
                      lastDate: DateTime.now().add(const Duration(days: 365)),
                    );
                    if (date != null && ctx.mounted) {
                      final time = await showTimePicker(
                        context: ctx,
                        initialTime: TimeOfDay.fromDateTime(chosenDueDate),
                      );
                      if (time != null) {
                        setModalState(() {
                          chosenDueDate = DateTime(date.year, date.month, date.day, time.hour, time.minute);
                        });
                      }
                    }
                  },
                  child: const Text('Chọn ngày giờ'),
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: noteCtrl,
                maxLines: 2,
                decoration: const InputDecoration(
                  labelText: 'Ghi chú (Tùy chọn)',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.notes),
                ),
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                icon: const Icon(Icons.save),
                label: const Text('Lưu vào Database'),
                onPressed: () async {
                  if (titleCtrl.text.trim().isEmpty) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Vui lòng nhập tên bài tập!')),
                    );
                    return;
                  }
                  final newItem = DeadlineItem(
                    id: 0,
                    title: titleCtrl.text.trim(),
                    subject: chosenCourse,
                    dueDate: chosenDueDate,
                    note: noteCtrl.text.trim(),
                  );
                  Navigator.pop(ctx);
                  await _api.createDeadline(newItem);
                  _fetchData();
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    // Đếm số lượng theo trạng thái
    int cOverdue = 0, cDueSoon = 0, cCompleted = 0;
    for (var d in _deadlines) {
      if (d.status == DeadlineStatus.completed) {
        cCompleted++;
      } else if (d.status == DeadlineStatus.overdue) {
        cOverdue++;
      } else if (d.status == DeadlineStatus.dueSoon) {
        cDueSoon++;
      }
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('DUT Deadline Manager', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
        elevation: 2,
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _fetchData,
            tooltip: 'Làm mới',
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: const Color(0xFF1565C0),
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('Thêm Deadline'),
        onPressed: _openAddDeadlineSheet,
      ),
      body: RefreshIndicator(
        onRefresh: _fetchData,
        child: Column(
          children: [
            // 1. THANH THỐNG KÊ NHANH (Overdue / Due Soon / Completed)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              color: Colors.blue.shade50,
              child: Row(
                children: [
                  _buildStatBadge('🔴 Quá hạn', '$cOverdue', Colors.red),
                  const SizedBox(width: 8),
                  _buildStatBadge('🟡 Sắp đến', '$cDueSoon', Colors.orange),
                  const SizedBox(width: 8),
                  _buildStatBadge('🟢 Đã xong', '$cCompleted', Colors.green),
                  const SizedBox(width: 8),
                  _buildStatBadge('📋 Tổng', '${_deadlines.length}', Colors.blue),
                ],
              ),
            ),

            // 2. BỘ LỌC TÌM KIẾM & MÔN HỌC (Task 1)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      decoration: InputDecoration(
                        hintText: 'Tìm bài tập...',
                        prefixIcon: const Icon(Icons.search, size: 20),
                        contentPadding: const EdgeInsets.symmetric(vertical: 0, horizontal: 12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(24)),
                        isDense: true,
                      ),
                      onChanged: (_) => _fetchData(),
                    ),
                  ),
                  const SizedBox(width: 10),
                  DropdownButton<String>(
                    value: _selectedCourse,
                    hint: const Text('Tất cả môn'),
                    underline: const SizedBox(),
                    items: [
                      const DropdownMenuItem(value: null, child: Text('Tất cả môn')),
                      ..._courses.map((c) => DropdownMenuItem(value: c, child: Text(c))),
                    ],
                    onChanged: (val) {
                      setState(() => _selectedCourse = val);
                      _fetchData();
                    },
                  ),
                ],
              ),
            ),

            // 3. FILTER CHIPS TRẠNG THÁI (Task 4)
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  _buildFilterChip('Tất cả', null),
                  _buildFilterChip('🔴 Quá hạn', 'overdue'),
                  _buildFilterChip('🟡 Sắp đến (<48h)', 'dueSoon'),
                  _buildFilterChip('🔵 Còn hạn', 'upcoming'),
                  _buildFilterChip('✅ Đã xong', 'completed'),
                ],
              ),
            ),

            const Divider(height: 1),

            // 4. DANH SÁCH BÀI TẬP / HẠN CHÓT
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _deadlines.isEmpty
                      ? const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.task_alt, size: 64, color: Colors.grey),
                              SizedBox(height: 12),
                              Text('Không tìm thấy hạn chót nào!', style: TextStyle(color: Colors.grey, fontSize: 16)),
                            ],
                          ),
                        )
                      : ListView.separated(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 80),
                          itemCount: _deadlines.length,
                          separatorBuilder: (_, __) => const SizedBox(height: 8),
                          itemBuilder: (ctx, index) {
                            final item = _deadlines[index];
                            return _buildDeadlineCard(item);
                          },
                        ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatBadge(String label, String count, MaterialColor color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 6),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: color.shade200),
        ),
        child: Column(
          children: [
            Text(count, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: color.shade800)),
            Text(label, style: TextStyle(fontSize: 10, color: Colors.grey.shade700)),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, String? statusKey) {
    final isSelected = _selectedStatus == statusKey;
    return Padding(
      padding: const EdgeInsets.only(right: 6),
      child: FilterChip(
        selected: isSelected,
        label: Text(label, style: TextStyle(fontSize: 12, fontWeight: isSelected ? FontWeight.bold : FontWeight.normal)),
        onSelected: (_) {
          setState(() => _selectedStatus = statusKey);
          _fetchData();
        },
      ),
    );
  }

  Widget _buildDeadlineCard(DeadlineItem item) {
    return Card(
      elevation: 1.5,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: item.statusColor.withOpacity(0.4), width: 1.5),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () => _handleToggleDone(item),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Checkbox đánh dấu hoàn thành (Task 4)
              Checkbox(
                value: item.isCompleted,
                activeColor: Colors.green,
                onChanged: (_) => _handleToggleDone(item),
              ),

              // Thẻ môn học
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.blue.shade50,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Text(
                  item.subject,
                  style: TextStyle(color: Colors.blue.shade800, fontWeight: FontWeight.bold, fontSize: 11),
                ),
              ),
              const SizedBox(width: 10),

              // Nội dung chính
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        decoration: item.isCompleted ? TextDecoration.lineThrough : null,
                        color: item.isCompleted ? Colors.grey : Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(Icons.calendar_month, size: 13, color: Colors.grey.shade600),
                        const SizedBox(width: 4),
                        Text(
                          DateFormat('HH:mm - dd/MM/yyyy').format(item.dueDate),
                          style: TextStyle(fontSize: 11, color: Colors.grey.shade700),
                        ),
                        if (item.note != null && item.note!.isNotEmpty) ...[
                          const SizedBox(width: 8),
                          Icon(Icons.notes, size: 13, color: Colors.grey.shade600),
                          const SizedBox(width: 2),
                          Expanded(
                            child: Text(
                              item.note!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),

              // Nhãn đếm ngược & Badge trạng thái
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: item.statusColor.withOpacity(0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      item.statusLabel,
                      style: TextStyle(color: item.statusColor, fontSize: 11, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.countdownText,
                    style: TextStyle(fontSize: 10, color: item.statusColor, fontWeight: FontWeight.w500),
                  ),
                ],
              ),

              // Nút xóa
              IconButton(
                icon: const Icon(Icons.delete_outline, size: 18, color: Colors.grey),
                onPressed: () => _handleDelete(item.id),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
