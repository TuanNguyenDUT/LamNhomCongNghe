import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_storage_service.dart';
import '../domain/user_session.dart';

class AuthState {
  const AuthState({
    this.session,
    this.isLoading = false,
    this.errorMessage,
  });

  final UserSession? session;
  final bool isLoading;
  final String? errorMessage;

  bool get isAuthenticated => session != null;

  AuthState copyWith({
    UserSession? session,
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
  }) {
    return AuthState(
      session: session ?? this.session,
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    Future.microtask(() => checkSavedSession());
    return const AuthState();
  }

  Dio get _dio => ref.read(dioProvider);
  SecureStorageService get _storage => ref.read(secureStorageServiceProvider);

  Future<void> checkSavedSession() async {
    try {
      final savedToken = await _storage.readAccessToken();
      final savedStudentCode = await _storage.readStudentCode();

      if (savedToken == null ||
          savedToken.isEmpty ||
          savedStudentCode == null ||
          savedStudentCode.isEmpty) {
        state = const AuthState();
        return;
      }

      final res = await _dio.get<dynamic>(
        '/api/v1/auth/me',
        queryParameters: {'student_id': savedStudentCode},
      );

      final body = res.data;
      if (body is Map && body['status'] == 'success' && body['data'] is Map) {
        final data = Map<String, dynamic>.from(body['data'] as Map);
        final studentRaw = data['student'];
        if (studentRaw is Map) {
          final parsed = UserSession.fromJson(data);
          final session = parsed.copyWith(
            token: savedToken,
            studentCode: parsed.studentCode.isNotEmpty
                ? parsed.studentCode
                : savedStudentCode,
          );
          state = state.copyWith(
            session: session,
            isLoading: false,
            clearError: true,
          );
          return;
        }
      }

      state = const AuthState();
    } on DioException catch (err) {
      final statusCode = err.response?.statusCode;
      if (statusCode == 401 || statusCode == 404) {
        await _storage.clearSession();
      }
      state = const AuthState();
    } catch (_) {
      state = const AuthState();
    }
  }

  Future<bool> login(String studentCode, String password) async {
    state = state.copyWith(isLoading: true, clearError: true);
    final cleanCode = studentCode.trim();
    final cleanPass = password.trim();

    try {
      final response = await _dio.post<dynamic>(
        '/api/v1/auth/login',
        data: {
          'student_code': cleanCode,
          'password': cleanPass,
        },
      );

      final body = response.data as Map<String, dynamic>;
      final data = Map<String, dynamic>.from(body['data'] as Map);
      final parsed = UserSession.fromJson(data);
      final persistedCode =
          parsed.studentCode.isNotEmpty ? parsed.studentCode : cleanCode;
      final session = parsed.copyWith(studentCode: persistedCode);

      await _storage.saveAccessToken(session.token);
      await _storage.saveStudentCode(persistedCode);

      state = state.copyWith(
        session: session,
        isLoading: false,
        clearError: true,
      );
      return true;
    } on DioException catch (dioErr) {
      String msg =
          'Tên đăng nhập hoặc mật khẩu sv.dut.udn.vn không chính xác!';
      final errData = dioErr.response?.data;
      if (errData is Map) {
        msg = (errData['message'] ?? msg).toString();
      } else if (dioErr.type == DioExceptionType.connectionTimeout ||
          dioErr.type == DioExceptionType.receiveTimeout ||
          dioErr.type == DioExceptionType.sendTimeout ||
          dioErr.type == DioExceptionType.connectionError) {
        final errDetails = dioErr.error?.toString() ?? dioErr.message ?? '';
        msg = errDetails.isNotEmpty && !errDetails.contains('DioException')
            ? 'Lỗi kết nối máy chủ ($errDetails). Vui lòng thử lại!'
            : 'Không thể kết nối đến máy chủ xác thực. Vui lòng kiểm tra kết nối mạng!';
      }
      state = state.copyWith(isLoading: false, errorMessage: msg);
      return false;
    } catch (err) {
      state = state.copyWith(isLoading: false, errorMessage: err.toString());
      return false;
    }
  }

  Future<void> logout() async {
    await _storage.clearSession();
    state = const AuthState();
  }
}

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);
