import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../core/network/api_client.dart';
import '../../../auth/presentation/auth_controller.dart';
import '../../../deadlines/presentation/deadlines_screen.dart';
import '../../../notifications/presentation/notification_providers.dart';

class InterestTopicsCard extends ConsumerStatefulWidget {
  const InterestTopicsCard({super.key});

  @override
  ConsumerState<InterestTopicsCard> createState() => _InterestTopicsCardState();
}

class _InterestTopicsCardState extends ConsumerState<InterestTopicsCard> {
  bool _isPersonalizedEnabled = true;
  List<String> _selectedTopics = [
    'ACADEMIC',
    'GRADE',
    'ADMINISTRATIVE',
    'EVENT',
    'CAREER',
    'SCHOLARSHIP',
  ];
  bool _isSaving = false;

  final List<Map<String, String>> _topicOptions = const [
    {'id': 'ACADEMIC', 'label': '📖 Thông báo học tập'},
    {'id': 'GRADE', 'label': '📊 Thông báo điểm số'},
    {'id': 'ADMINISTRATIVE', 'label': '📑 Thông báo hành chính'},
    {'id': 'EVENT', 'label': '🎉 Hoạt động sự kiện'},
    {'id': 'CAREER', 'label': '💼 Thông báo nghề nghiệp'},
    {'id': 'SCHOLARSHIP', 'label': '🎓 Học bổng'},
  ];

  List<String> _normalizeTopics(List<String> raw) {
    final mapped = <String>{};
    for (final item in raw) {
      switch (item.trim().toUpperCase()) {
        case 'HOC_VU':
          mapped.addAll(['ACADEMIC', 'GRADE', 'ADMINISTRATIVE']);
          break;
        case 'HOC_TAP':
        case 'ACADEMIC':
          mapped.add('ACADEMIC');
          break;
        case 'DIEM_SO':
        case 'GRADE':
          mapped.add('GRADE');
          break;
        case 'HANH_CHINH':
        case 'ADMINISTRATIVE':
          mapped.add('ADMINISTRATIVE');
          break;
        case 'HOAT_DONG_SV':
        case 'SU_KIEN':
        case 'EVENT':
          mapped.add('EVENT');
          break;
        case 'TUYEN_DUNG':
        case 'NGHE_NGHIEP':
        case 'CAREER':
          mapped.add('CAREER');
          break;
        case 'HOC_BONG':
        case 'SCHOLARSHIP':
          mapped.add('SCHOLARSHIP');
          break;
      }
    }
    return mapped.toList();
  }

  @override
  void initState() {
    super.initState();
    _loadPreferences();
  }

  Future<void> _loadPreferences() async {
    final authState = ref.read(authControllerProvider);
    final session = authState.session;
    if (session != null) {
      setState(() {
        _isPersonalizedEnabled = session.isPersonalizedEnabled;
        _selectedTopics = _normalizeTopics(session.interestedTopics);
      });
    }

    try {
      final dio = ref.read(dioProvider);
      final studentCode = session?.studentCode ?? '';
      if (studentCode.isEmpty) return;
      final res = await dio.get(
        '/api/v1/students/preferences',
        queryParameters: {'student_code': studentCode},
      );
      if (res.data != null && res.data['data'] != null && mounted) {
        final data = res.data['data'] as Map<String, dynamic>;
        setState(() {
          _isPersonalizedEnabled = data['is_personalized_enabled'] != false;
          if (data['interested_topics'] is List) {
            _selectedTopics = _normalizeTopics(
              (data['interested_topics'] as List).map((e) => e.toString()).toList(),
            );
          }
        });
      }
    } catch (_) {}
  }

  Future<void> _savePreferences() async {
    if (_isSaving) return;
    setState(() => _isSaving = true);
    final authState = ref.read(authControllerProvider);
    final session = authState.session;
    final studentCode = session?.studentCode ?? '';
    final studentId = session?.studentId ?? studentCode;
    final dio = ref.read(dioProvider);

    try {
      await dio.put(
        '/api/v1/students/preferences',
        data: {
          'student_code': studentCode,
          'student_id': studentId,
          'is_personalized_enabled': _isPersonalizedEnabled,
          'interested_topics': _selectedTopics,
        },
      );

      // Làm mới dữ liệu bảng tin và hạn chót để áp dụng ngay cá nhân hóa theo 6 loại
      ref.invalidate(notificationFeedProvider);
      ref.invalidate(deadlinesListProvider);
    } catch (_) {
    } finally {
      if (mounted) {
        setState(() => _isSaving = false);
      }
    }
  }

  void _toggleTopic(String topicId) {
    setState(() {
      if (_selectedTopics.contains(topicId)) {
        _selectedTopics.remove(topicId);
      } else {
        _selectedTopics.add(topicId);
      }
    });
    _savePreferences();
  }

  void _togglePersonalized(bool value) {
    setState(() {
      _isPersonalizedEnabled = value;
    });
    _savePreferences();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: const Color(0xFFE2E8F0),
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 16,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Tiêu đề với biểu tượng hashtag màu xanh
          Row(
            children: [
              const Text(
                '#',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: Color(0xFF2563EB),
                ),
              ),
              const SizedBox(width: 8),
              const Text(
                'Chủ đề quan tâm',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF0F172A),
                  letterSpacing: -0.3,
                ),
              ),
              const Spacer(),
              if (_isSaving)
                const SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF2563EB)),
                ),
            ],
          ),
          const SizedBox(height: 6),
          const Text(
            'Chọn các chủ đề bạn muốn ưu tiên nhận thông báo.',
            style: TextStyle(
              fontSize: 14,
              color: Color(0xFF64748B),
              height: 1.3,
            ),
          ),
          const SizedBox(height: 18),

          // Danh sách các FilterChips theo thiết kế chuẩn
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: _topicOptions.map((topic) {
              final isSelected = _selectedTopics.contains(topic['id']);
              return Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => _toggleTopic(topic['id']!),
                  borderRadius: BorderRadius.circular(24),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    curve: Curves.easeInOut,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
                    decoration: BoxDecoration(
                      color: isSelected ? const Color(0xFF2563EB) : Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: isSelected ? const Color(0xFF2563EB) : const Color(0xFFCBD5E1),
                        width: 1.2,
                      ),
                      boxShadow: isSelected
                          ? [
                              BoxShadow(
                                color: const Color(0xFF2563EB).withValues(alpha: 0.28),
                                blurRadius: 8,
                                offset: const Offset(0, 3),
                              ),
                            ]
                          : null,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (isSelected) ...[
                          const Icon(
                            Icons.check_rounded,
                            size: 18,
                            color: Colors.white,
                          ),
                          const SizedBox(width: 6),
                        ],
                        Text(
                          topic['label']!,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w600,
                            color: isSelected ? Colors.white : const Color(0xFF1E293B),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              );
            }).toList(),
          ),

          const SizedBox(height: 20),
          const Divider(
            height: 1,
            thickness: 1,
            color: Color(0xFFF1F5F9),
          ),
          const SizedBox(height: 18),

          // Dòng Switch: Thông báo được cá nhân hóa
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'Thông báo được cá nhân hóa',
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    SizedBox(height: 3),
                    Text(
                      'Ưu tiên nội dung phù hợp với tùy chọn trên.',
                      style: TextStyle(
                        fontSize: 13,
                        color: Color(0xFF64748B),
                      ),
                    ),
                  ],
                ),
              ),
              Switch.adaptive(
                value: _isPersonalizedEnabled,
                onChanged: _togglePersonalized,
                activeTrackColor: const Color(0xFF2563EB),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
