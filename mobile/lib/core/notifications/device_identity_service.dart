import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';

import '../storage/secure_storage_service.dart';

final deviceIdentityServiceProvider = Provider<DeviceIdentityService>((ref) {
  return DeviceIdentityService(
    ref.watch(secureStorageServiceProvider),
    const Uuid(),
  );
});

class DeviceIdentityService {
  DeviceIdentityService(this._secureStorage, this._uuid);

  final SecureStorageService _secureStorage;
  final Uuid _uuid;

  Future<String> getOrCreateDeviceId() async {
    final existing = await _secureStorage.readDeviceId();
    if (existing != null && existing.isNotEmpty) {
      return existing;
    }

    final created = _uuid.v4();
    await _secureStorage.saveDeviceId(created);
    return created;
  }
}
