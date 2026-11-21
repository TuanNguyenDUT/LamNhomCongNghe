import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final secureStorageServiceProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService(const FlutterSecureStorage());
});

class SecureStorageService {
  SecureStorageService(this._storage);

  static const _accessTokenKey = 'access_token';
  static const _studentCodeKey = 'student_code';
  static const _deviceIdKey = 'device_id';

  final FlutterSecureStorage _storage;
  final Map<String, String> _memFallback = {};

  Future<String?> readAccessToken() async {
    try {
      final val = await _storage.read(key: _accessTokenKey);
      return val ?? _memFallback[_accessTokenKey];
    } catch (_) {
      return _memFallback[_accessTokenKey];
    }
  }

  Future<void> saveAccessToken(String value) async {
    _memFallback[_accessTokenKey] = value;
    try {
      await _storage.write(key: _accessTokenKey, value: value);
    } catch (_) {}
  }

  Future<void> clearAccessToken() async {
    _memFallback.remove(_accessTokenKey);
    try {
      await _storage.delete(key: _accessTokenKey);
    } catch (_) {}
  }

  Future<String?> readStudentCode() async {
    try {
      final val = await _storage.read(key: _studentCodeKey);
      return val ?? _memFallback[_studentCodeKey];
    } catch (_) {
      return _memFallback[_studentCodeKey];
    }
  }

  Future<void> saveStudentCode(String studentCode) async {
    _memFallback[_studentCodeKey] = studentCode;
    try {
      await _storage.write(key: _studentCodeKey, value: studentCode);
    } catch (_) {}
  }

  Future<void> clearStudentCode() async {
    _memFallback.remove(_studentCodeKey);
    try {
      await _storage.delete(key: _studentCodeKey);
    } catch (_) {}
  }

  /// Clears authenticated session keys while preserving device identity.
  Future<void> clearSession() async {
    await clearAccessToken();
    await clearStudentCode();
  }

  Future<String?> readDeviceId() async {
    try {
      final val = await _storage.read(key: _deviceIdKey);
      return val ?? _memFallback[_deviceIdKey];
    } catch (_) {
      return _memFallback[_deviceIdKey];
    }
  }

  Future<void> saveDeviceId(String value) async {
    _memFallback[_deviceIdKey] = value;
    try {
      await _storage.write(key: _deviceIdKey, value: value);
    } catch (_) {}
  }
}
