class NotificationItem {
  const NotificationItem({
    required this.id,
    required this.title,
    required this.content,
    required this.summary,
    required this.priority,
    required this.priorityScore,
    required this.scopeType,
    required this.sourceType,
    required this.publishedAt,
    required this.isRead,
    required this.isPinned,
    required this.tags,
    this.courseCode,
    this.courseTag,
    this.senderName,
  });

  final int id;
  final String title;
  final String content;
  final String summary;
  final String priority;
  final int priorityScore;
  final String scopeType;
  final String sourceType;
  final DateTime publishedAt;
  final bool isRead;
  final bool isPinned;
  final List<String> tags;
  final String? courseCode;
  final String? courseTag;
  final String? senderName;

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    return NotificationItem(
      id:
          (json['notification_id'] as num?)?.toInt() ??
          (json['id'] as num?)?.toInt() ??
          0,
      title: json['title']?.toString() ?? '',
      content: json['content']?.toString() ?? '',
      summary: json['summary']?.toString() ?? '',
      priority: json['priority']?.toString() ?? 'MEDIUM',
      priorityScore: (json['priority_score'] as num?)?.toInt() ?? 0,
      scopeType: json['scope_type']?.toString() ?? 'GENERAL',
      sourceType: json['source_type']?.toString() ?? 'TRAINING_DEPT',
      publishedAt:
          DateTime.tryParse(json['published_at']?.toString() ?? '') ??
          DateTime.now(),
      isRead: json['is_read'] == true || json['is_read'] == 1,
      isPinned: json['is_pinned'] == true || json['is_pinned'] == 1,
      tags: (json['tags'] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(growable: false),
      courseCode: json['course_code']?.toString(),
      courseTag: json['course_tag']?.toString(),
      senderName: json['sender_name']?.toString(),
    );
  }
}

class NotificationPage {
  const NotificationPage({
    required this.items,
    required this.page,
    required this.totalPages,
    required this.total,
  });

  final List<NotificationItem> items;
  final int page;
  final int totalPages;
  final int total;
}
