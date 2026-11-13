import 'package:flutter/material.dart';

enum DeadlineStatus { overdue, dueSoon, upcoming, completed }

class DeadlineItem {
  final int id;
  final String title;
  final String subject;
  final DateTime dueDate;
  final bool isCompleted;
  final String? note;

  DeadlineItem({
    required this.id,
    required this.title,
    required this.subject,
    required this.dueDate,
    this.isCompleted = false,
    this.note,
  });

  // Tự động phân loại trạng thái theo thời gian thực (Task 4)
  DeadlineStatus get status {
    if (isCompleted) return DeadlineStatus.completed;
    final now = DateTime.now();
    final diffHours = dueDate.difference(now).inHours;
    if (diffHours < 0) return DeadlineStatus.overdue;
    if (diffHours <= 48) return DeadlineStatus.dueSoon;
    return DeadlineStatus.upcoming;
  }

  // Nhãn hiển thị tiếng Việt
  String get statusLabel {
    switch (status) {
      case DeadlineStatus.overdue:
        return 'Quá hạn';
      case DeadlineStatus.dueSoon:
        return 'Sắp đến';
      case DeadlineStatus.upcoming:
        return 'Còn hạn';
      case DeadlineStatus.completed:
        return 'Đã xong';
    }
  }

  // Màu sắc đại diện cho từng trạng thái
  Color get statusColor {
    switch (status) {
      case DeadlineStatus.overdue:
        return const Color(0xFFD32F2F); // Đỏ
      case DeadlineStatus.dueSoon:
        return const Color(0xFFF57C00); // Cam
      case DeadlineStatus.upcoming:
        return const Color(0xFF1976D2); // Xanh dương
      case DeadlineStatus.completed:
        return const Color(0xFF388E3C); // Xanh lá
    }
  }

  // Chuỗi đếm ngược thời gian
  String get countdownText {
    if (isCompleted) return '✓ Đã hoàn thành';
    final now = DateTime.now();
    final diff = dueDate.difference(now);
    if (diff.isNegative) {
      final hours = diff.inHours.abs();
      return hours < 24 ? 'Quá hạn $hours giờ' : 'Quá hạn ${diff.inDays.abs()} ngày';
    }
    if (diff.inHours <= 48) {
      return 'Còn ${diff.inHours} giờ nữa';
    }
    return 'Còn ${diff.inDays} ngày nữa';
  }

  factory DeadlineItem.fromJson(Map<String, dynamic> json) {
    return DeadlineItem(
      id: json['deadline_id'] is int ? json['deadline_id'] : int.parse(json['deadline_id'].toString()),
      title: json['title'] ?? '',
      subject: json['subject'] ?? json['course_code'] ?? 'Chung',
      dueDate: DateTime.parse(json['due_date']),
      isCompleted: json['is_completed'] == true,
      note: json['note'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'subject': subject,
      'due_date': dueDate.toIso8601String(),
      'note': note,
    };
  }

  DeadlineItem copyWith({
    int? id,
    String? title,
    String? subject,
    DateTime? dueDate,
    bool? isCompleted,
    String? note,
  }) {
    return DeadlineItem(
      id: id ?? this.id,
      title: title ?? this.title,
      subject: subject ?? this.subject,
      dueDate: dueDate ?? this.dueDate,
      isCompleted: isCompleted ?? this.isCompleted,
      note: note ?? this.note,
    );
  }
}
