import 'package:dio/dio.dart';

import '../../../core/config/app_config.dart';
import '../domain/notification_item.dart';

class NotificationApiService {
  const NotificationApiService(this._dio);

  final Dio _dio;

  Future<NotificationPage> fetchNotifications({
    int page = 1,
    int limit = 50,
    String? studentId,
    String? sourceChannel,
  }) async {
    final query = <String, dynamic>{
      'page': page,
      'limit': limit,
      'student_id': studentId ?? AppConfig.developmentStudentId,
    };
    if (sourceChannel != null && sourceChannel.isNotEmpty && sourceChannel != 'ALL') {
      query['source_channel'] = sourceChannel;
    }

    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/notifications',
      queryParameters: query,
    );
    final payload = _successData(response.data);
    final itemsJson = (payload['notifications'] ?? payload['items']) as List<dynamic>? ?? const [];
    final pagination = _asMap(payload['pagination']);

    final seenKeys = <String>{};
    final dedupedItems = <NotificationItem>[];
    for (final item in itemsJson) {
      final notif = NotificationItem.fromJson(_asMap(item));
      final cleanTitle = notif.title.trim().replaceAll(RegExp(r'\s+'), ' ').toLowerCase();
      final key = '${notif.sourceChannel ?? ''}|$cleanTitle';
      if (seenKeys.add(key)) {
        dedupedItems.add(notif);
      }
    }

    return NotificationPage(
      items: dedupedItems,
      page: (pagination['page'] as num?)?.toInt() ?? page,
      totalPages:
          (pagination['total_pages'] as num?)?.toInt() ??
          (((pagination['total'] as num?)?.toInt() ?? dedupedItems.length) /
                  limit)
              .ceil()
              .clamp(1, 1 << 31),
      total: (pagination['total'] as num?)?.toInt() ?? dedupedItems.length,
    );
  }

  Future<NotificationItem> fetchNotification(
    dynamic id, {
    String? studentId,
  }) async {
    final response = await _dio.get<Map<String, dynamic>>(
      '/api/v1/notifications/$id',
      queryParameters: {
        'student_id': studentId ?? AppConfig.developmentStudentId,
      },
    );
    final data = _successData(response.data);
    final itemData = data['notification'] is Map ? data['notification'] : data;
    return NotificationItem.fromJson(_asMap(itemData));
  }

  Future<void> setReadStatus(
    dynamic id, {
    required bool isRead,
    String? studentId,
  }) async {
    await _dio.patch<void>(
      '/api/v1/notifications/$id/read',
      data: {
        'student_id': studentId ?? '',
        'is_read': isRead,
      },
    );
  }

  Future<void> acknowledgeNotification(
    dynamic id, {
    required String studentId,
  }) async {
    await _dio.post<void>(
      '/api/v1/notifications/$id/ack',
      data: {'student_id': studentId},
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
