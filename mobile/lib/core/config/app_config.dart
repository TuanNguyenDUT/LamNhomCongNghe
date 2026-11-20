import 'package:flutter/foundation.dart';

enum AppEnvironment {
  development,
  staging,
  production;

  static AppEnvironment parse(String value) {
    return switch (value.toLowerCase()) {
      'production' || 'prod' => AppEnvironment.production,
      'staging' || 'stage' => AppEnvironment.staging,
      _ => AppEnvironment.development,
    };
  }
}

abstract final class AppConfig {
  static const appEnvironmentName = String.fromEnvironment(
    'APP_ENV',
    defaultValue: 'development',
  );

  static const _configuredBaseUrl = String.fromEnvironment('API_BASE_URL');

  static String get apiBaseUrl {
    if (_configuredBaseUrl.isNotEmpty) {
      return _configuredBaseUrl;
    }
    if (kIsWeb) return '';
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:3000';
    }
    return 'http://localhost:3000';
  }

  static const enableFirebase = bool.fromEnvironment(
    'ENABLE_FIREBASE',
    defaultValue: false,
  );

  static const developmentStudentId = String.fromEnvironment(
    'STUDENT_ID',
    defaultValue: '',
  );

  static AppEnvironment get environment =>
      AppEnvironment.parse(appEnvironmentName);

  static bool get isProduction => environment == AppEnvironment.production;
}
