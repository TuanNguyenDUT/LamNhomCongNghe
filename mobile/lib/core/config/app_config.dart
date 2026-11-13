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

  static const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:3000',
  );

  static const enableFirebase = bool.fromEnvironment(
    'ENABLE_FIREBASE',
    defaultValue: false,
  );

  static const developmentStudentId = String.fromEnvironment(
    'STUDENT_ID',
    defaultValue: '102230099',
  );

  static AppEnvironment get environment =>
      AppEnvironment.parse(appEnvironmentName);

  static bool get isProduction => environment == AppEnvironment.production;
}
