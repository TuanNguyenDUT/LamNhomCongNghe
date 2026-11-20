import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/presentation/ambient_background.dart';
import '../../../core/presentation/app_toast.dart';
import '../../../core/presentation/warm_pearl_tokens.dart';
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
    // Tuân thủ nghiêm ngặt GEMINI.md: không điền sẵn MSSV mặc định
    _studentCodeController = TextEditingController();
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
      AppToast.showError(
        context,
        'Vui lòng nhập đầy đủ mã sinh viên và mật khẩu',
      );
      return;
    }

    final success =
        await ref.read(authControllerProvider.notifier).login(code, pass);
    if (success && mounted) {
      context.go('/notifications');
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);

    return WarmPearlAmbientBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 400),
                child: Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: WarmPearlColors.glassBgStrong,
                    borderRadius: BorderRadius.circular(28),
                    border: Border.all(
                      color: WarmPearlColors.glassBorderStrong,
                      width: 1.2,
                    ),
                    boxShadow: WarmPearlShadows.glass,
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Brand Crest / Logo
                      Container(
                        width: 70,
                        height: 70,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(20),
                          gradient: WarmPearlGradients.coralButton,
                          boxShadow: const [
                            BoxShadow(
                              color: WarmPearlColors.coralGlow,
                              blurRadius: 20,
                              offset: Offset(0, 8),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.school_rounded,
                          size: 38,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(height: 18),

                      // Brand Titles
                      const Text(
                        'DUT Student Portal',
                        style: TextStyle(
                          fontFamily: WarmPearlTypography.displayFont,
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.5,
                          color: WarmPearlColors.inkPrimary,
                        ),
                      ),
                      const SizedBox(height: 6),
                      const Text(
                        'Đăng nhập bằng tài khoản sv.dut.udn.vn',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontFamily: WarmPearlTypography.bodyFont,
                          fontSize: 13,
                          fontWeight: FontWeight.w500,
                          color: WarmPearlColors.inkSecondary,
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Error message if any
                      if (authState.errorMessage != null) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: WarmPearlColors.roseSoft,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: WarmPearlColors.roseBorder,
                            ),
                          ),
                          child: Row(
                            children: [
                              const Icon(
                                Icons.error_outline_rounded,
                                size: 16,
                                color: WarmPearlColors.rose,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  authState.errorMessage!,
                                  style: const TextStyle(
                                    fontFamily: WarmPearlTypography.bodyFont,
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w600,
                                    color: WarmPearlColors.rose,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),
                      ],

                      // Student Code input
                      Container(
                        height: 48,
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        decoration: BoxDecoration(
                          color: WarmPearlColors.inputBg,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: WarmPearlColors.inputBorder,
                            width: 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.badge_outlined,
                              size: 19,
                              color: WarmPearlColors.coralFrom,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: TextField(
                                controller: _studentCodeController,
                                style: const TextStyle(
                                  fontFamily: WarmPearlTypography.bodyFont,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: WarmPearlColors.inkPrimary,
                                ),
                                decoration: const InputDecoration(
                                  hintText: 'Mã số sinh viên (VD: 102230xxx)',
                                  hintStyle: TextStyle(
                                    color: WarmPearlColors.inkMuted,
                                    fontSize: 13,
                                    fontWeight: FontWeight.normal,
                                  ),
                                  border: InputBorder.none,
                                  isDense: true,
                                  contentPadding: EdgeInsets.zero,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Password input
                      Container(
                        height: 48,
                        padding: const EdgeInsets.symmetric(horizontal: 14),
                        decoration: BoxDecoration(
                          color: WarmPearlColors.inputBg,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: WarmPearlColors.inputBorder,
                            width: 1,
                          ),
                        ),
                        child: Row(
                          children: [
                            const Icon(
                              Icons.lock_outline_rounded,
                              size: 19,
                              color: WarmPearlColors.inkMuted,
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: TextField(
                                controller: _passwordController,
                                obscureText: _obscurePassword,
                                onSubmitted: (_) => _handleLogin(),
                                style: const TextStyle(
                                  fontFamily: WarmPearlTypography.bodyFont,
                                  fontSize: 14,
                                  fontWeight: FontWeight.w600,
                                  color: WarmPearlColors.inkPrimary,
                                ),
                                decoration: const InputDecoration(
                                  hintText: 'Mật khẩu sinh viên',
                                  hintStyle: TextStyle(
                                    color: WarmPearlColors.inkMuted,
                                    fontSize: 13,
                                    fontWeight: FontWeight.normal,
                                  ),
                                  border: InputBorder.none,
                                  isDense: true,
                                  contentPadding: EdgeInsets.zero,
                                ),
                              ),
                            ),
                            GestureDetector(
                              onTap: () {
                                setState(() {
                                  _obscurePassword = !_obscurePassword;
                                });
                              },
                              child: Icon(
                                _obscurePassword
                                    ? Icons.visibility_off_outlined
                                    : Icons.visibility_outlined,
                                size: 19,
                                color: WarmPearlColors.inkMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Submit Button
                      GestureDetector(
                        onTap: authState.isLoading ? null : _handleLogin,
                        child: Container(
                          height: 46,
                          decoration: BoxDecoration(
                            gradient: WarmPearlGradients.coralButton,
                            borderRadius: BorderRadius.circular(999),
                            boxShadow: const [
                              BoxShadow(
                                color: WarmPearlColors.coralGlow,
                                blurRadius: 20,
                                offset: Offset(0, 6),
                              ),
                            ],
                          ),
                          alignment: Alignment.center,
                          child: authState.isLoading
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.2,
                                    color: Colors.white,
                                  ),
                                )
                              : const Text(
                                  'Đăng nhập hệ thống',
                                  style: TextStyle(
                                    fontFamily: WarmPearlTypography.displayFont,
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                        ),
                      ),
                      const SizedBox(height: 18),

                      // Verification info
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(
                              shape: BoxShape.circle,
                              color: WarmPearlColors.mintBright,
                            ),
                          ),
                          const SizedBox(width: 6),
                          const Flexible(
                            child: Text(
                              'Xác thực trực tiếp HTTP 302 từ sv.dut.udn.vn',
                              style: TextStyle(
                                fontFamily: WarmPearlTypography.bodyFont,
                                fontSize: 11,
                                color: WarmPearlColors.inkMuted,
                              ),
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
