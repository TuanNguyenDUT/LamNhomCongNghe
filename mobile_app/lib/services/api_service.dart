import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import '../models/deadline.dart';

class DeadlineApiService {
  // Tự động nhận diện IP phù hợp: Android Emulator dùng 10.0.2.2, iOS/Web dùng localhost
  static String get baseUrl {
    if (kIsWeb) return 'http://localhost:3000';
    try {
      if (Platform.isAndroid) return 'http://10.0.2.2:3000';
    } catch (_) {}
    return 'http://localhost:3000';
  }

  // Danh sách môn học mặc định
  final List<String> defaultCourses = [
    'IT401',
    'IT302',
    'IT501',
    'IT305',
    'IT210',
    'MATH201',
  ];

  // Dữ liệu mẫu dự phòng khi chưa kết nối mạng
  List<DeadlineItem> _mockDeadlines = [
    DeadlineItem(
      id: 1,
      title: 'Nộp báo cáo bài tập lớn CNPM',
      subject: 'IT401',
      dueDate: DateTime.now().subtract(const Duration(days: 1)),
      isCompleted: false,
      note: 'Nộp trên hệ thống LMS',
    ),
    DeadlineItem(
      id: 2,
      title: 'Làm bài tập Mạng máy tính tuần 9',
      subject: 'IT302',
      dueDate: DateTime.now().add(const Duration(hours: 20)),
      isCompleted: false,
      note: 'Nộp file Packet Tracer',
    ),
    DeadlineItem(
      id: 3,
      title: 'Nộp đồ án giữa kỳ AI',
      subject: 'IT501',
      dueDate: DateTime.now().add(const Duration(days: 3)),
      isCompleted: false,
      note: 'Báo cáo PDF + Source Code Github',
    ),
    DeadlineItem(
      id: 4,
      title: 'Bài tập HTML/CSS Responsive',
      subject: 'IT210',
      dueDate: DateTime.now().add(const Duration(days: 7)),
      isCompleted: true,
      note: 'Đã hoàn thành sớm',
    ),
  ];

  // Lấy danh sách hạn chót kèm bộ lọc (Task 3 & 4)
  async_fetchDeadlines({String? subject, String? status, String? search}) async {
    try {
      final queryParams = <String, String>{};
      if (subject != null && subject.isNotEmpty) queryParams['subject'] = subject;
      if (status != null && status.isNotEmpty) queryParams['status'] = status;
      if (search != null && search.isNotEmpty) queryParams['search'] = search;

      final uri = Uri.parse('$baseUrl/api/v1/deadlines').replace(queryParameters: queryParams);
      final response = await http.get(uri).timeout(const Duration(seconds: 4));

      if (response.statusCode == 200) {
        final data = json.decode(utf8.decode(response.bodyBytes));
        final list = (data['data'] as List).map((e) => DeadlineItem.fromJson(e)).toList();
        return list;
      }
    } catch (e) {
      debugPrint('⚠️ Không kết nối được Backend Node.js ($e), chuyển sang dữ liệu mẫu.');
    }

    // Fallback dữ liệu nội bộ
    return _mockDeadlines.where((item) {
      if (subject != null && subject.isNotEmpty && item.subject != subject) return false;
      if (status != null && status.isNotEmpty) {
        if (item.status.name.toLowerCase() != status.toLowerCase()) return false;
      }
      if (search != null && search.isNotEmpty) {
        final q = search.toLowerCase();
        final matchTitle = item.title.toLowerCase().contains(q);
        final matchNote = (item.note ?? '').toLowerCase().contains(q);
        if (!matchTitle && !matchNote) return false;
      }
      return true;
    }).toList();
  }

  // Lấy danh sách môn học
  Future<List<String>> fetchCourses() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/api/v1/courses')).timeout(const Duration(seconds: 3));
      if (response.statusCode == 200) {
        final data = json.decode(utf8.decode(response.bodyBytes));
        final list = (data['data'] as List).map((e) => e['course_code'].toString()).toList();
        return list;
      }
    } catch (_) {}
    return defaultCourses;
  }

  // Thêm deadline mới (Task 3)
  Future<bool> createDeadline(DeadlineItem item) async {
    try {
      final response = await http
          .post(
            Uri.parse('$baseUrl/api/v1/deadlines'),
            headers: {'Content-Type': 'application/json'},
            body: json.encode(item.toJson()),
          )
          .timeout(const Duration(seconds: 4));
      if (response.statusCode == 201) return true;
    } catch (_) {}

    // Mock fallback
    _mockDeadlines.add(item.copyWith(id: DateTime.now().millisecondsSinceEpoch));
    return true;
  }

  // Tick hoàn thành / Bỏ hoàn thành (Task 4)
  Future<bool> toggleComplete(int id) async {
    try {
      final response = await http
          .patch(Uri.parse('$baseUrl/api/v1/deadlines/$id/complete'))
          .timeout(const Duration(seconds: 4));
      if (response.statusCode == 200) return true;
    } catch (_) {}

    // Mock fallback
    final idx = _mockDeadlines.indexWhere((e) => e.id == id);
    if (idx != -1) {
      _mockDeadlines[idx] = _mockDeadlines[idx].copyWith(isCompleted: !_mockDeadlines[idx].isCompleted);
    }
    return true;
  }

  // Xóa deadline (Task 3)
  Future<bool> deleteDeadline(int id) async {
    try {
      final response = await http
          .delete(Uri.parse('$baseUrl/api/v1/deadlines/$id'))
          .timeout(const Duration(seconds: 4));
      if (response.statusCode == 200) return true;
    } catch (_) {}

    _mockDeadlines.removeWhere((e) => e.id == id);
    return true;
  }

  // Lưu Device Token cho FCM Push Notification (Task 6)
  Future<bool> registerDeviceToken({required String studentId, required String token, String platform = 'ANDROID'}) async {
    try {
      final response = await http
          .post(
            Uri.parse('$baseUrl/api/v1/device-tokens'),
            headers: {'Content-Type': 'application/json'},
            body: json.encode({
              'student_id': studentId,
              'device_token': token,
              'platform': platform,
            }),
          )
          .timeout(const Duration(seconds: 4));
      return response.statusCode == 201;
    } catch (_) {
      return false;
    }
  }
}
