import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/presentation/liquid_glass.dart';
import '../../../core/presentation/app_toast.dart';
import 'auth_controller.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  late final TextEditingController _studentCodeController;
  late final TextEditingController _passwordController;
  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    // Gợi ý sẵn tài khoản sinh viên DUT thực tế theo yêu cầu, mật khẩu bắt buộc người dùng tự nhập bảo mật
    _studentCodeController = TextEditingController(text: '102230026');
    _passwordController = TextEditingController();
  }

  @override
  void dispose() {
    _studentCodeController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final code = _studentCodeController.text.trim();
    final pass = _passwordController.text.trim();

    if (code.isEmpty || pass.isEmpty) {
      AppToast.showError(context, 'Vui lòng nhập đầy đủ mã sinh viên và mật khẩu');
      return;
    }

    final success = await ref.read(authControllerProvider.notifier).login(code, pass);
    if (success && mounted) {
      context.go('/notifications');
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);

    return Scaffold(
      body: Stack(
        children: [
          // 1. Apple Wallpaper Style Background Gradient
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFFE2EAF8), // Soft Glacier Blue
                  Color(0xFFEFE9F8), // Soft Lavender
                  Color(0xFFE6EEF9),
                  Color(0xFFF3F7FD),
                ],
              ),
            ),
          ),

          // 2. Background Ambient Glow Orbs (Hiệu ứng ánh sáng xuyên thấu qua lớp kính)
          Positioned(
            top: -60,
            right: -50,
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF007AFF).withValues(alpha: 0.18),
              ),
            ),
          ),
          Positioned(
            bottom: 80,
            left: -40,
            child: Container(
              width: 220,
              height: 220,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFF5856D6).withValues(alpha: 0.14),
              ),
            ),
          ),

          // 3. Nội dung đăng nhập căn giữa
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Biểu tượng Logo DUT Liquid Glass
                    LiquidGlassContainer(
                      borderRadius: 28,
                      blurSigma: 18,
                      opacity: 0.82,
                      padding: const EdgeInsets.all(18),
                      child: Container(
                        width: 72,
                        height: 72,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(20),
                          gradient: const LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [Color(0xFF007AFF), Color(0xFF0049B7)],
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: const Color(0xFF007AFF).withValues(alpha: 0.35),
                              blurRadius: 16,
                              offset: const Offset(0, 6),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.school_rounded,
                          size: 38,
                          color: Colors.white,
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Tiêu đề thương hiệu
                    const Text(
                      'DUT Student Portal',
                      style: TextStyle(
                        fontSize: 26,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.6,
                        color: Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Đăng nhập bằng tài khoản sv.dut.udn.vn',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                        color: const Color(0xFF475569).withValues(alpha: 0.9),
                        letterSpacing: -0.2,
                      ),
                    ),
                    const SizedBox(height: 28),

                    // Thẻ kính Liquid Glass chứa Form Đăng Nhập
                    LiquidGlassContainer(
                      borderRadius: 26,
                      blurSigma: 24,
                      opacity: 0.78,
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Báo lỗi nếu có
                          if (authState.errorMessage != null) ...[
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: const Color(0xFFFF3B30).withValues(alpha: 0.12),
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(
                                  color: const Color(0xFFFF3B30).withValues(alpha: 0.3),
                                ),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.error_outline, size: 18, color: Color(0xFFFF3B30)),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      authState.errorMessage!,
                                      style: const TextStyle(
                                        color: Color(0xFFB91C1C),
                                        fontSize: 13,
                                        fontWeight: FontWeight.w500,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 16),
                          ],

                          // Label Mã Sinh Viên
                          Text(
                            'MÃ SINH VIÊN',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                              color: const Color(0xFF334155).withValues(alpha: 0.85),
                            ),
                          ),
                          const SizedBox(height: 8),

                          // Input Mã Sinh Viên (Glass Input)
                          Container(
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.65),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.85),
                                width: 1.1,
                              ),
                            ),
                            child: TextField(
                              controller: _studentCodeController,
                              keyboardType: TextInputType.number,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF0F172A),
                              ),
                              decoration: const InputDecoration(
                                hintText: 'Nhập mã SV (VD: 102230026)',
                                prefixIcon: Icon(Icons.badge_outlined, color: Color(0xFF007AFF)),
                                border: InputBorder.none,
                                contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                              ),
                            ),
                          ),
                          const SizedBox(height: 18),

                          // Label Mật Khẩu
                          Text(
                            'MẬT KHẨU SV.DUT.UDN.VN',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 0.5,
                              color: const Color(0xFF334155).withValues(alpha: 0.85),
                            ),
                          ),
                          const SizedBox(height: 8),

                          // Input Mật Khẩu (Glass Input)
                          Container(
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.65),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.85),
                                width: 1.1,
                              ),
                            ),
                            child: TextField(
                              controller: _passwordController,
                              obscureText: _obscurePassword,
                              style: const TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                color: Color(0xFF0F172A),
                              ),
                              decoration: InputDecoration(
                                hintText: 'Nhập mật khẩu',
                                prefixIcon: const Icon(Icons.lock_outline, color: Color(0xFF007AFF)),
                                suffixIcon: IconButton(
                                  icon: Icon(
                                    _obscurePassword ? Icons.visibility_outlined : Icons.visibility_off_outlined,
                                    color: const Color(0xFF64748B),
                                  ),
                                  onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                                ),
                                border: InputBorder.none,
                                contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                              ),
                            ),
                          ),
                          const SizedBox(height: 26),

                          // Nút Đăng nhập Liquid Glass
                          LiquidGlassButton(
                            label: 'Đăng nhập & Đồng bộ học phần',
                            icon: Icons.login_rounded,
                            isLoading: authState.isLoading,
                            onPressed: _handleLogin,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 22),

                    // Thông báo bảo mật & tính năng
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.sync_lock_rounded, size: 16, color: Colors.blueGrey.shade700),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            'Tự động đồng bộ môn học & thông báo mới nhất',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: Colors.blueGrey.shade700,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
