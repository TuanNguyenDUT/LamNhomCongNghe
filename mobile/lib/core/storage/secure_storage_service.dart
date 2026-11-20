import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final secureStorageServiceProvider = Provider<SecureStorageService>((ref) {
  return SecureStorageService(const FlutterSecureStorage());
});

class SecureStorageService {
  SecureStorageService(this._storage);

  static const _accessTokenKey = 'access_token';
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
