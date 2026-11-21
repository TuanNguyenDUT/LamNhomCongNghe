import 'package:dio/dio.dart';
import 'package:dut_student_notifications/core/network/api_client.dart';
import 'package:dut_student_notifications/core/storage/secure_storage_service.dart';
import 'package:dut_student_notifications/features/auth/domain/user_session.dart';
import 'package:dut_student_notifications/features/auth/presentation/auth_controller.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

class MockDio extends Mock implements Dio {}

class MockSecureStorageService extends Mock implements SecureStorageService {}

void main() {
  late MockDio mockDio;
  late MockSecureStorageService mockStorage;

  const testStudentCode = '102240001';
  const testToken = 'dut_token_test_102240001';

  setUp(() {
    mockDio = MockDio();
    mockStorage = MockSecureStorageService();

    when(() => mockStorage.readAccessToken()).thenAnswer((_) async => null);
    when(() => mockStorage.readStudentCode()).thenAnswer((_) async => null);
    when(() => mockStorage.saveAccessToken(any())).thenAnswer((_) async {});
    when(() => mockStorage.saveStudentCode(any())).thenAnswer((_) async {});
    when(() => mockStorage.clearSession()).thenAnswer((_) async {});
  });

  ProviderContainer createContainer() {
    final container = ProviderContainer(
      overrides: [
        dioProvider.overrideWithValue(mockDio),
        secureStorageServiceProvider.overrideWithValue(mockStorage),
      ],
    );
    addTearDown(container.dispose);
    return container;
  }

  group('AuthController', () {
    test(
      'checkSavedSession() with no token or missing student_code stays unauthenticated without calling /api/v1/auth/me',
      () async {
        when(() => mockStorage.readAccessToken()).thenAnswer((_) async => null);
        when(() => mockStorage.readStudentCode()).thenAnswer((_) async => testStudentCode);

        final container = createContainer();
        final notifier = container.read(authControllerProvider.notifier);
        await Future<void>.delayed(Duration.zero);

        expect(container.read(authControllerProvider).isAuthenticated, isFalse);
        expect(container.read(authControllerProvider).session, isNull);

        when(() => mockStorage.readAccessToken()).thenAnswer((_) async => testToken);
        when(() => mockStorage.readStudentCode()).thenAnswer((_) async => '');
        await notifier.checkSavedSession();

        expect(container.read(authControllerProvider).isAuthenticated, isFalse);
        verifyNever(
          () => mockDio.get<dynamic>(
            any(),
            queryParameters: any(named: 'queryParameters'),
          ),
        );
      },
    );

    test(
      'checkSavedSession() with valid token and student_code hydrates full UserSession from /api/v1/auth/me',
      () async {
        when(() => mockStorage.readAccessToken())
            .thenAnswer((_) async => testToken);
        when(() => mockStorage.readStudentCode())
            .thenAnswer((_) async => testStudentCode);
        when(
          () => mockDio.get<dynamic>(
            '/api/v1/auth/me',
            queryParameters: {'student_id': testStudentCode},
          ),
        ).thenAnswer(
          (_) async => Response<dynamic>(
            requestOptions: RequestOptions(path: '/api/v1/auth/me'),
            statusCode: 200,
            data: {
              'status': 'success',
              'data': {
                'student': {
                  'id': '42',
                  'student_code': testStudentCode,
                  'full_name': 'Trần Minh Quân',
                  'faculty': 'Khoa Công nghệ Thông tin',
                  'cohort': 'K24',
                  'class_name': '24T_CLC1',
                  'major': 'Công nghệ thông tin',
                  'program': 'Chất lượng cao',
                  'avatar_url': '/api/v1/avatar/$testStudentCode.jpg',
                  'dob': '2006-05-14',
                  'gender': 'Nam',
                  'school_email': '$testStudentCode@sv1.dut.udn.vn',
                  'personal_email': 'quan.tran@example.com',
                  'phone': '0905123456',
                  'dut_last_synced_at': '2026-11-20T10:00:00.000Z',
                  'is_personalized_enabled': true,
                  'interested_topics': ['ACADEMIC', 'SCHOLARSHIP'],
                  'total_courses': 5,
                },
                'courses': [
                  {'course_code': 'IT101'},
                ],
              },
            },
          ),
        );

        final container = createContainer();
        container.read(authControllerProvider.notifier);
        await Future<void>.delayed(Duration.zero);

        final state = container.read(authControllerProvider);
        expect(state.isAuthenticated, isTrue);
        final session = state.session!;
        expect(session.token, testToken);
        expect(session.studentCode, testStudentCode);
        expect(session.studentId, '42');
        expect(session.fullName, 'Trần Minh Quân');
        expect(session.faculty, 'Khoa Công nghệ Thông tin');
        expect(session.cohort, 'K24');
        expect(session.className, '24T_CLC1');
        expect(session.major, 'Công nghệ thông tin');
        expect(session.program, 'Chất lượng cao');
        expect(session.avatarUrl, '/api/v1/avatar/$testStudentCode.jpg');
        expect(session.dob, '2006-05-14');
        expect(session.gender, 'Nam');
        expect(session.schoolEmail, '$testStudentCode@sv1.dut.udn.vn');
        expect(session.personalEmail, 'quan.tran@example.com');
        expect(session.phone, '0905123456');
        expect(session.totalCourses, 5);
        expect(session.isPersonalizedEnabled, isTrue);
        expect(session.interestedTopics, ['ACADEMIC', 'SCHOLARSHIP']);
      },
    );

    test(
      'checkSavedSession() on /api/v1/auth/me 401 failure clears session and stays unauthenticated',
      () async {
        when(() => mockStorage.readAccessToken())
            .thenAnswer((_) async => testToken);
        when(() => mockStorage.readStudentCode())
            .thenAnswer((_) async => testStudentCode);
        when(
          () => mockDio.get<dynamic>(
            '/api/v1/auth/me',
            queryParameters: {'student_id': testStudentCode},
          ),
        ).thenThrow(
          DioException(
            requestOptions: RequestOptions(path: '/api/v1/auth/me'),
            response: Response<dynamic>(
              requestOptions: RequestOptions(path: '/api/v1/auth/me'),
              statusCode: 401,
            ),
            type: DioExceptionType.badResponse,
          ),
        );

        final container = createContainer();
        container.read(authControllerProvider.notifier);
        await Future<void>.delayed(Duration.zero);

        final state = container.read(authControllerProvider);
        expect(state.isAuthenticated, isFalse);
        expect(state.session, isNull);
        verify(() => mockStorage.clearSession()).called(1);
      },
    );

    test('login() persists both access_token and student_code', () async {
      when(
        () => mockDio.post<dynamic>(
          '/api/v1/auth/login',
          data: {
            'student_code': testStudentCode,
            'password': 'real-password',
          },
        ),
      ).thenAnswer(
        (_) async => Response<dynamic>(
          requestOptions: RequestOptions(path: '/api/v1/auth/login'),
          statusCode: 200,
          data: {
            'status': 'success',
            'data': {
              'token': testToken,
              'student': {
                'id': '42',
                'student_code': testStudentCode,
                'full_name': 'Trần Minh Quân',
                'faculty': 'Khoa Công nghệ Thông tin',
                'cohort': 'K24',
                'class_name': '24T_CLC1',
                'total_courses': 3,
              },
            },
          },
        ),
      );

      final container = createContainer();
      final notifier = container.read(authControllerProvider.notifier);
      await Future<void>.delayed(Duration.zero);

      final ok = await notifier.login(testStudentCode, 'real-password');
      expect(ok, isTrue);
      verify(() => mockStorage.saveAccessToken(testToken)).called(1);
      verify(() => mockStorage.saveStudentCode(testStudentCode)).called(1);
      expect(container.read(authControllerProvider).isAuthenticated, isTrue);
    });

    test('logout() calls clearSession() and resets AuthState', () async {
      when(
        () => mockDio.post<dynamic>(
          '/api/v1/auth/login',
          data: {
            'student_code': testStudentCode,
            'password': 'real-password',
          },
        ),
      ).thenAnswer(
        (_) async => Response<dynamic>(
          requestOptions: RequestOptions(path: '/api/v1/auth/login'),
          statusCode: 200,
          data: {
            'status': 'success',
            'data': {
              'token': testToken,
              'student': {
                'id': '42',
                'student_code': testStudentCode,
                'full_name': 'Trần Minh Quân',
                'faculty': 'Khoa Công nghệ Thông tin',
                'cohort': 'K24',
                'class_name': '24T_CLC1',
              },
            },
          },
        ),
      );

      final container = createContainer();
      final notifier = container.read(authControllerProvider.notifier);
      await Future<void>.delayed(Duration.zero);

      await notifier.login(testStudentCode, 'real-password');
      expect(container.read(authControllerProvider).isAuthenticated, isTrue);

      await notifier.logout();
      verify(() => mockStorage.clearSession()).called(1);
      expect(container.read(authControllerProvider).isAuthenticated, isFalse);
      expect(container.read(authControllerProvider).session, isNull);
    });

    test('UserSession.fromJson uses canonical fallback topics and empty strings instead of hardcoded student defaults', () {
      final session = UserSession.fromJson({
        'student': {
          'student_code': testStudentCode,
        },
        'courses': [
          {'course_code': 'IT101'},
          {'course_code': 'IT102'},
        ],
      });

      expect(session.fullName, '');
      expect(session.className, '');
      expect(session.faculty, '');
      expect(session.cohort, '');
      expect(session.totalCourses, 2);
      expect(
        session.interestedTopics,
        const [
          'ACADEMIC',
          'GRADE',
          'ADMINISTRATIVE',
          'EVENT',
          'CAREER',
          'SCHOLARSHIP',
        ],
      );
    });
  });
}
