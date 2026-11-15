import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../domain/course_item.dart';

final enrolledCoursesProvider = FutureProvider<List<CourseItem>>((ref) async {
  // Mock fallback danh sách học phần đồng bộ từ sv.dut.udn.vn
  return [
    const CourseItem(
      courseCode: 'IT401',
      courseName: 'Công nghệ phần mềm',
      semester: 'Học kỳ 2 (2025-2026)',
      lecturerName: 'TS. Nguyễn Văn B',
      scheduleInfo: 'Thứ 4, Tiết 1-3, Phòng F102',
      unreadCount: 2,
      upcomingDeadlines: 1,
    ),
    const CourseItem(
      courseCode: 'IT302',
      courseName: 'Cơ sở dữ liệu',
      semester: 'Học kỳ 2 (2025-2026)',
      lecturerName: 'ThS. Trần Thị C',
      scheduleInfo: 'Thứ 2, Tiết 7-9, Phòng F301',
      unreadCount: 1,
      upcomingDeadlines: 1,
    ),
    const CourseItem(
      courseCode: 'IT408',
      courseName: 'Trí tuệ nhân tạo',
      semester: 'Học kỳ 2 (2025-2026)',
      lecturerName: 'PGS. TS. Lê Văn D',
      scheduleInfo: 'Thứ 6, Tiết 4-6, Phòng F204',
      unreadCount: 0,
      upcomingDeadlines: 0,
    ),
  ];
});

class EnrolledCoursesScreen extends ConsumerWidget {
  const EnrolledCoursesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final coursesAsync = ref.watch(enrolledCoursesProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Học Phần Đang Học (sv.dut.udn.vn)'),
        actions: [
          IconButton(
            icon: const Icon(Icons.sync),
            tooltip: 'Đồng bộ từ sv.dut.udn.vn',
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Đang đồng bộ thời khóa biểu từ sv.dut.udn.vn...')),
              );
              ref.refresh(enrolledCoursesProvider);
            },
          ),
        ],
      ),
      body: coursesAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (err, stack) => Center(child: Text('Lỗi: $err')),
        data: (courses) {
          if (courses.isEmpty) {
            return const Center(child: Text('Chưa có học phần nào được đồng bộ.'));
          }

          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: courses.length,
            itemBuilder: (context, index) {
              final course = courses[index];
              return Card(
                margin: const EdgeInsets.only(bottom: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 1.5,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: Colors.blue.shade100,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              course.courseCode,
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Colors.blue.shade900,
                              ),
                            ),
                          ),
                          const Spacer(),
                          if (course.unreadCount > 0)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: Colors.red,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                '${course.unreadCount} tin mới',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        course.courseName,
                        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 6),
                      if (course.lecturerName != null)
                        Row(
                          children: [
                            Icon(Icons.person_outline, size: 16, color: Colors.grey.shade600),
                            const SizedBox(width: 6),
                            Text(
                              course.lecturerName!,
                              style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
                            ),
                          ],
                        ),
                      const SizedBox(height: 4),
                      if (course.scheduleInfo != null)
                        Row(
                          children: [
                            Icon(Icons.calendar_today_outlined, size: 15, color: Colors.grey.shade600),
                            const SizedBox(width: 6),
                            Text(
                              course.scheduleInfo!,
                              style: TextStyle(fontSize: 13, color: Colors.grey.shade700),
                            ),
                          ],
                        ),
                      const SizedBox(height: 12),
                      const Divider(height: 1),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          Icon(Icons.assignment_outlined, size: 15, color: Colors.orange.shade800),
                          const SizedBox(width: 6),
                          Text(
                            '${course.upcomingDeadlines} deadline sắp tới',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: Colors.orange.shade900,
                            ),
                          ),
                          const Spacer(),
                          TextButton(
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Xem bảng tin môn: ${course.courseName}')),
                              );
                            },
                            child: const Text('Xem tin môn này →'),
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
    );
  }
}

