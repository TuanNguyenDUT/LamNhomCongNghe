class UserSession {
  const UserSession({
    required this.studentCode,
    required this.fullName,
    required this.className,
    required this.faculty,
    required this.cohort,
    required this.token,
    this.studentId,
    this.major,
    this.program,
    this.avatarUrl,
    this.dob,
    this.gender,
    this.schoolEmail,
    this.personalEmail,
    this.phone,
    this.dutLastSyncedAt,
    this.totalCourses = 0,
    this.isPersonalizedEnabled = true,
    this.interestedTopics = defaultInterestedTopics,
  });

  static const List<String> defaultInterestedTopics = [
    'ACADEMIC',
    'GRADE',
    'ADMINISTRATIVE',
    'EVENT',
    'CAREER',
    'SCHOLARSHIP',
  ];

  final String studentCode;
  final String fullName;
  final String className;
  final String faculty;
  final String cohort;
  final String token;
  final String? studentId;
  final String? major;
  final String? program;
  final String? avatarUrl;
  final String? dob;
  final String? gender;
  final String? schoolEmail;
  final String? personalEmail;
  final String? phone;
  final String? dutLastSyncedAt;
  final int totalCourses;
  final bool isPersonalizedEnabled;
  final List<String> interestedTopics;

  factory UserSession.fromJson(Map<String, dynamic> json) {
    final rawStudent = json['student'];
    final Map<String, dynamic> student = rawStudent is Map<String, dynamic>
        ? rawStudent
        : (rawStudent is Map
            ? Map<String, dynamic>.from(rawStudent)
            : json);

    List<String> topics = defaultInterestedTopics;
    if (student['interested_topics'] is List) {
      topics = (student['interested_topics'] as List)
          .map((e) => e.toString())
          .toList();
    } else if (json['interested_topics'] is List) {
      topics = (json['interested_topics'] as List)
          .map((e) => e.toString())
          .toList();
    }

    final rawTotalCourses = student['total_courses'] ?? json['total_courses'];
    final int parsedTotalCourses;
    if (rawTotalCourses is num) {
      parsedTotalCourses = rawTotalCourses.toInt();
    } else if (rawTotalCourses is String) {
      parsedTotalCourses = int.tryParse(rawTotalCourses) ??
          (json['courses'] as List?)?.length ??
          0;
    } else {
      parsedTotalCourses = (json['courses'] as List?)?.length ?? 0;
    }

    return UserSession(
      studentCode:
          (student['student_code'] ?? json['student_code'] ?? '').toString(),
      studentId:
          (student['id'] ?? json['student_id'] ?? json['id'])?.toString(),
      fullName: (student['full_name'] ?? json['full_name'] ?? '').toString(),
      className:
          (student['class_name'] ?? json['class_name'] ?? '').toString(),
      faculty: (student['faculty'] ?? json['faculty'] ?? '').toString(),
      cohort: (student['cohort'] ?? json['cohort'] ?? '').toString(),
      token: (json['token'] ?? '').toString(),
      major: (student['major'] ?? json['major'])?.toString(),
      program: (student['program'] ?? json['program'])?.toString(),
      avatarUrl: (student['avatar_url'] ?? json['avatar_url'])?.toString(),
      dob: (student['dob'] ?? json['dob'])?.toString(),
      gender: (student['gender'] ?? json['gender'])?.toString(),
      schoolEmail:
          (student['school_email'] ?? json['school_email'])?.toString(),
      personalEmail:
          (student['personal_email'] ?? json['personal_email'])?.toString(),
      phone: (student['phone'] ?? json['phone'])?.toString(),
      dutLastSyncedAt:
          (student['dut_last_synced_at'] ?? json['dut_last_synced_at'])
              ?.toString(),
      totalCourses: parsedTotalCourses,
      isPersonalizedEnabled: student['is_personalized_enabled'] != null
          ? student['is_personalized_enabled'] == true
          : (json['is_personalized_enabled'] != null
              ? json['is_personalized_enabled'] == true
              : true),
      interestedTopics: topics,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'student_code': studentCode,
      'student_id': studentId,
      'full_name': fullName,
      'class_name': className,
      'faculty': faculty,
      'cohort': cohort,
      'token': token,
      'major': major,
      'program': program,
      'avatar_url': avatarUrl,
      'dob': dob,
      'gender': gender,
      'school_email': schoolEmail,
      'personal_email': personalEmail,
      'phone': phone,
      'dut_last_synced_at': dutLastSyncedAt,
      'total_courses': totalCourses,
      'is_personalized_enabled': isPersonalizedEnabled,
      'interested_topics': interestedTopics,
    };
  }

  UserSession copyWith({
    String? studentCode,
    String? studentId,
    String? fullName,
    String? className,
    String? faculty,
    String? cohort,
    String? token,
    String? major,
    String? program,
    String? avatarUrl,
    String? dob,
    String? gender,
    String? schoolEmail,
    String? personalEmail,
    String? phone,
    String? dutLastSyncedAt,
    int? totalCourses,
    bool? isPersonalizedEnabled,
    List<String>? interestedTopics,
  }) {
    return UserSession(
      studentCode: studentCode ?? this.studentCode,
      studentId: studentId ?? this.studentId,
      fullName: fullName ?? this.fullName,
      className: className ?? this.className,
      faculty: faculty ?? this.faculty,
      cohort: cohort ?? this.cohort,
      token: token ?? this.token,
      major: major ?? this.major,
      program: program ?? this.program,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      dob: dob ?? this.dob,
      gender: gender ?? this.gender,
      schoolEmail: schoolEmail ?? this.schoolEmail,
      personalEmail: personalEmail ?? this.personalEmail,
      phone: phone ?? this.phone,
      dutLastSyncedAt: dutLastSyncedAt ?? this.dutLastSyncedAt,
      totalCourses: totalCourses ?? this.totalCourses,
      isPersonalizedEnabled:
          isPersonalizedEnabled ?? this.isPersonalizedEnabled,
      interestedTopics: interestedTopics ?? this.interestedTopics,
    );
  }
}
