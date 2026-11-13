import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final secureStorageServiceProvider = Provider<SecureStorageService>((ref) {
  return const SecureStorageService(FlutterSecureStorage());
});

class SecureStorageService {
  const SecureStorageService(this._storage);

  static const _accessTokenKey = 'access_token';
  static const _deviceIdKey = 'device_id';

  final FlutterSecureStorage _storage;

  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);

  Future<void> saveAccessToken(String value) {
    return _storage.write(key: _accessTokenKey, value: value);
  }

  Future<void> clearAccessToken() => _storage.delete(key: _accessTokenKey);

  Future<String?> readDeviceId() => _storage.read(key: _deviceIdKey);

  Future<void> saveDeviceId(String value) {
    return _storage.write(key: _deviceIdKey, value: value);
  }
}
