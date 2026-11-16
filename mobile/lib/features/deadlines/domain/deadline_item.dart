class DeadlineItem {
  const DeadlineItem({
    required this.deadlineId,
    required this.studentId,
    required this.title,
    required this.dueDate,
    this.description,
    this.courseCode,
    this.notificationId,
    this.status = 'PENDING',
    this.itemType = 'DEADLINE',
    this.googleEventId,
    this.lastSyncedAt,
  });

  final String deadlineId;
  final String studentId;
  final String title;
  final String? description;
  final String? courseCode;
  final String? notificationId;
  final DateTime dueDate;
  final String status;
  final String itemType;
  final String? googleEventId;
  final DateTime? lastSyncedAt;

  bool get isReminder => itemType == 'REMINDER' || title.startsWith('[Nhắc nhở]');
  bool get isAcademicDeadline => !isReminder;
  bool get isCompleted => status == 'COMPLETED';
  bool get isOverdue => status == 'OVERDUE';
  bool get isDueSoon => status == 'DUE_SOON';

  factory DeadlineItem.fromJson(Map<String, dynamic> json) {
    final titleStr = json['title']?.toString() ?? '';
    final rawType = json['item_type']?.toString();
    final inferredType = rawType ?? (titleStr.startsWith('[Nhắc nhở]') ? 'REMINDER' : 'DEADLINE');

    return DeadlineItem(
      deadlineId: (json['deadline_id'] ?? json['id'] ?? '').toString(),
      studentId: json['student_id']?.toString() ?? '',
      title: titleStr,
      description: json['description']?.toString(),
      courseCode: json['course_code']?.toString(),
      notificationId: json['notification_id']?.toString(),
      dueDate: DateTime.tryParse(json['due_date']?.toString() ?? '') ?? DateTime.now(),
      status: json['status']?.toString() ?? 'PENDING',
      itemType: inferredType,
      googleEventId: json['google_event_id']?.toString(),
      lastSyncedAt: json['last_synced_at'] != null
          ? DateTime.tryParse(json['last_synced_at'].toString())
          : null,
    );
  }
}
