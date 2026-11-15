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
    // Chỉ khởi động ở trạng thái chưa đăng nhập để người dùng chủ động đăng nhập sv.dut.udn.vn
    state = const AuthState();
  }

  Future<bool> login(String studentCode, String password) async {
    state = state.copyWith(isLoading: true, clearError: true);
    final cleanCode = studentCode.trim();
    final cleanPass = password.trim();

    try {
      final response = await _dio.post(
        '/api/v1/auth/login',
        data: {
          'student_code': cleanCode,
          'password': cleanPass,
        },
      );

      final data = response.data['data'] as Map<String, dynamic>;
      final session = UserSession.fromJson(data);

      await _storage.saveAccessToken(session.token);

      state = state.copyWith(
        session: session,
        isLoading: false,
        clearError: true,
      );
      return true;
    } on DioException catch (dioErr) {
      String msg = 'Tên đăng nhập hoặc mật khẩu sv.dut.udn.vn không chính xác!';
      if (dioErr.response?.data is Map) {
        msg = (dioErr.response?.data['message'] ?? msg).toString();
      } else if (dioErr.type == DioExceptionType.connectionTimeout ||
          dioErr.type == DioExceptionType.connectionError) {
        msg = 'Không thể kết nối đến máy chủ xác thực. Vui lòng kiểm tra kết nối mạng!';
      }
      state = state.copyWith(isLoading: false, errorMessage: msg);
      return false;
    } catch (err) {
      state = state.copyWith(isLoading: false, errorMessage: err.toString());
      return false;
    }
  }

  Future<void> logout() async {
    await _storage.clearAccessToken();
    state = const AuthState();
  }
}

final authControllerProvider =
    NotifierProvider<AuthController, AuthState>(AuthController.new);
