import 'package:dio/dio.dart';

import '../../../core/config/app_config.dart';
import '../domain/notification_item.dart';

class NotificationApiService {
  const NotificationApiService(this._dio);

  final Dio _dio;

  Future<NotificationPage> fetchNotifications({
    int page = 1,
    int limit = 20,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/notifications',
      queryParameters: {
        'page': page,
        'limit': limit,
        'student_id': AppConfig.developmentStudentId,
      },
    );
    final payload = _successData(response.data);
    final itemsJson = payload['items'] as List<dynamic>? ?? const [];
    final pagination = _asMap(payload['pagination']);

    return NotificationPage(
      items: itemsJson
          .map((item) => NotificationItem.fromJson(_asMap(item)))
          .toList(growable: false),
      page: (pagination['page'] as num?)?.toInt() ?? page,
      totalPages:
          (pagination['total_pages'] as num?)?.toInt() ??
          (((pagination['total'] as num?)?.toInt() ?? itemsJson.length) /
                  limit)
              .ceil()
              .clamp(1, 1 << 31),
      total: (pagination['total'] as num?)?.toInt() ?? itemsJson.length,
    );
  }

  Future<NotificationItem> fetchNotification(int id) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/notifications/$id',
      queryParameters: {'student_id': AppConfig.developmentStudentId},
    );
    return NotificationItem.fromJson(_successData(response.data));
  }

  Future<void> setReadStatus(int id, {required bool isRead}) async {
    await _dio.patch<void>(
      '/api/v1/notifications/$id/read',
      data: {
        'student_id': AppConfig.developmentStudentId,
        'is_read': isRead,
      },
    );
  }

  Map<String, dynamic> _successData(Map<String, dynamic>? response) {
    if (response == null || response['status'] != 'success') {
      throw const FormatException('API trả về dữ liệu không hợp lệ');
    }
    return _asMap(response['data']);
  }

  Map<String, dynamic> _asMap(Object? value) {
    if (value is Map<String, dynamic>) {
      return value;
    }
    if (value is Map) {
      return Map<String, dynamic>.from(value);
    }
    throw const FormatException('Dữ liệu JSON không đúng định dạng');
  }
}
