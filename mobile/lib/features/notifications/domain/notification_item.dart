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
    this.sourceChannel,
    this.actionRequired,
    this.deadlineAt,
    this.isEmergency = false,
    this.isAcknowledged = false,
    this.attachments = const [],
    this.courseCode,
    this.courseTag,
    this.senderName,
  });

  final dynamic id;
  final String title;
  final String content;
  final String summary;
  final String priority;
  final int priorityScore;
  final String scopeType;
  final String sourceType;
  final String? sourceChannel;
  final String? actionRequired;
  final DateTime? deadlineAt;
  final bool isEmergency;
  final bool isAcknowledged;
  final List<dynamic> attachments;
  final DateTime publishedAt;
  final bool isRead;
  final bool isPinned;
  final List<String> tags;
  final String? courseCode;
  final String? courseTag;
  final String? senderName;

  factory NotificationItem.fromJson(Map<String, dynamic> json) {
    final rawId = json['id'] ?? json['notification_id'] ?? 0;
    return NotificationItem(
      id: rawId,
      title: json['title']?.toString() ?? '',
      content: json['content']?.toString() ?? '',
      summary: json['summary']?.toString() ?? '',
      priority: json['priority']?.toString() ?? 'NORMAL',
      priorityScore: (json['priority_score'] as num?)?.toInt() ?? 0,
      scopeType: json['scope']?.toString() ?? json['scope_type']?.toString() ?? 'GLOBAL',
      sourceType: json['source_channel']?.toString() ?? json['source_type']?.toString() ?? 'DUT_GENERAL',
      sourceChannel: json['source_channel']?.toString() ?? json['source_type']?.toString(),
      actionRequired: json['action_required']?.toString(),
      deadlineAt: json['deadline_at'] != null ? DateTime.tryParse(json['deadline_at'].toString()) : null,
      isEmergency: json['is_emergency'] == true || json['is_emergency'] == 1,
      isAcknowledged: json['is_acknowledged'] == true || json['is_acknowledged'] == 1,
      attachments: (json['attachments'] as List<dynamic>? ?? const []),
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
