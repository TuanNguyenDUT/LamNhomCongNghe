import 'package:dut_student_notifications/core/config/app_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('development defaults point Android emulator to local Node API', () {
    expect(AppConfig.environment, AppEnvironment.development);
    expect(AppConfig.apiBaseUrl, 'http://10.0.2.2:3000');
    expect(AppConfig.enableFirebase, isFalse);
  });

  test('environment parser accepts short and full names', () {
    expect(AppEnvironment.parse('prod'), AppEnvironment.production);
    expect(AppEnvironment.parse('staging'), AppEnvironment.staging);
    expect(AppEnvironment.parse('unknown'), AppEnvironment.development);
  });
}
