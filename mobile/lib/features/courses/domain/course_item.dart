class CourseItem {
  const CourseItem({
    required this.courseCode,
    required this.courseName,
    required this.semester,
    this.lecturerName,
    this.scheduleInfo,
    this.unreadCount = 0,
    this.upcomingDeadlines = 0,
    this.isMuted = false,
  });

  final String courseCode;
  final String courseName;
  final String semester;
  final String? lecturerName;
  final String? scheduleInfo;
  final int unreadCount;
  final int upcomingDeadlines;
  final bool isMuted;

  factory CourseItem.fromJson(Map<String, dynamic> json) {
    return CourseItem(
      courseCode: json['course_code']?.toString() ?? '',
      courseName: json['course_name']?.toString() ?? '',
      semester: json['semester']?.toString() ?? '',
      lecturerName: json['lecturer_name']?.toString(),
      scheduleInfo: json['schedule_info']?.toString(),
      unreadCount: (json['unread_count'] as num?)?.toInt() ?? 0,
      upcomingDeadlines: (json['upcoming_deadlines'] as num?)?.toInt() ?? 0,
      isMuted: json['is_muted'] == true,
    );
  }
}

