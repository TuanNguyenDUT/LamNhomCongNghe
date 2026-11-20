import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/network/api_client.dart';
import '../../../core/presentation/app_toast.dart';
import '../../../core/presentation/warm_pearl_tokens.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../courses/presentation/enrolled_courses_screen.dart';
import 'widgets/followed_fanpages_card.dart';
import 'widgets/gcal_settings_card.dart';
import 'widgets/holo_student_pass.dart';
import 'widgets/interest_topics_card.dart';
import 'widgets/quick_reminders_settings_card.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  String _currentSubTab = 'info'; // 'info' | 'settings'
  bool _focusGcal = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    try {
      final uri = GoRouterState.of(context).uri;
      final tabParam = uri.queryParameters['tab'];
      if (tabParam == 'settings') {
        _currentSubTab = 'settings';
      } else if (tabParam == 'info') {
        _currentSubTab = 'info';
      }

      final focusParam = uri.queryParameters['focus'];
      if (focusParam == 'gcal') {
        _currentSubTab = 'settings';
        _focusGcal = true;
      }
    } catch (_) {}
  }

  Future<void> _handleReSyncCourses() async {
    final session = ref.read(authControllerProvider).session;
    final studentId = session?.studentCode ?? '';

    try {
      final dio = ref.read(dioProvider);
      await dio.post(
        '/api/v1/dut/sync-courses',
        data: {'student_id': studentId},
      );
      ref.invalidate(enrolledCoursesProvider);

      if (mounted) {
        AppToast.showSuccess(
          context,
          'Đã đồng bộ lại danh sách học phần từ cổng sv.dut.udn.vn',
        );
      }
    } catch (_) {
      if (mounted) {
        AppToast.showError(context, 'Lỗi đồng bộ học phần từ sv.dut.udn.vn');
      }
    }
  }

  void _showLogoutConfirmation(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Align(
        alignment: Alignment.bottomCenter,
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 720),
          child: Container(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 32),
            decoration: const BoxDecoration(
              color: WarmPearlColors.sheetBg,
              borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
              border: Border(
                top: BorderSide(color: Colors.white, width: 1.5),
              ),
              boxShadow: [
                BoxShadow(
                  color: Color(0x29182036),
                  blurRadius: 48,
                  offset: Offset(0, -18),
                ),
              ],
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Handle
                Center(
                  child: Container(
                    width: 40,
                    height: 4.5,
                    decoration: BoxDecoration(
                      color: WarmPearlColors.sheetHandle,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                ),
                const SizedBox(height: 18),

                // Icon & Title
                Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: WarmPearlColors.roseSoft,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: WarmPearlColors.roseBorder),
                      ),
                      child: const Icon(
                        Icons.logout_rounded,
                        color: WarmPearlColors.rose,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            'Đăng xuất khỏi thiết bị?',
                            style: TextStyle(
                              fontFamily: WarmPearlTypography.displayFont,
                              fontSize: 16.5,
                              fontWeight: FontWeight.w800,
                              color: WarmPearlColors.inkPrimary,
                            ),
                          ),
                          SizedBox(height: 2),
                          Text(
                            'Phiên đăng nhập trên thiết bị này sẽ kết thúc.',
                            style: TextStyle(
                              fontFamily: WarmPearlTypography.bodyFont,
                              fontSize: 12,
                              color: WarmPearlColors.inkSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Buttons
                Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () => Navigator.of(ctx).pop(),
                        child: Container(
                          height: 44,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.8),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: WarmPearlColors.glassBorderStrong,
                            ),
                          ),
                          alignment: Alignment.center,
                          child: const Text(
                            'Hủy',
                            style: TextStyle(
                              fontFamily: WarmPearlTypography.displayFont,
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                              color: WarmPearlColors.inkPrimary,
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: GestureDetector(
                        onTap: () async {
                          Navigator.of(ctx).pop();
                          await ref
                              .read(authControllerProvider.notifier)
                              .logout();
                          if (context.mounted) {
                            context.go('/login');
                          }
                        },
                        child: Container(
                          height: 44,
                          decoration: BoxDecoration(
                            gradient: WarmPearlGradients.roseButton,
                            borderRadius: BorderRadius.circular(999),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x3DE11D48),
                                blurRadius: 16,
                                offset: Offset(0, 4),
                              ),
                            ],
                          ),
                          alignment: Alignment.center,
                          child: const Text(
                            'Đăng xuất',
                            style: TextStyle(
                              fontFamily: WarmPearlTypography.displayFont,
                              fontSize: 13.5,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
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
    );
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authControllerProvider).session;

    return ListView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(14, 6, 14, 120),
      children: [
        // 2-Segment Switcher (Hồ sơ sinh viên | Cài đặt & Đồng bộ)
        Container(
          height: 42,
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: WarmPearlColors.segSwitcherBg,
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: WarmPearlColors.glassBorderStrong,
              width: 1,
            ),
            boxShadow: WarmPearlShadows.glassSm,
          ),
          child: Row(
            children: [
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _currentSubTab = 'info'),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    curve: WarmPearlMotion.spring,
                    decoration: BoxDecoration(
                      gradient: _currentSubTab == 'info'
                          ? WarmPearlGradients.coralButton
                          : null,
                      borderRadius: BorderRadius.circular(999),
                      boxShadow: _currentSubTab == 'info'
                          ? const [
                              BoxShadow(
                                color: Color(0x33182036),
                                blurRadius: 8,
                                offset: Offset(0, 2),
                              ),
                            ]
                          : null,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      'Hồ sơ sinh viên',
                      style: TextStyle(
                        fontFamily: WarmPearlTypography.displayFont,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: _currentSubTab == 'info'
                            ? Colors.white
                            : WarmPearlColors.inkSecondary,
                      ),
                    ),
                  ),
                ),
              ),
              Expanded(
                child: GestureDetector(
                  onTap: () => setState(() => _currentSubTab = 'settings'),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 220),
                    curve: WarmPearlMotion.spring,
                    decoration: BoxDecoration(
                      gradient: _currentSubTab == 'settings'
                          ? WarmPearlGradients.coralButton
                          : null,
                      borderRadius: BorderRadius.circular(999),
                      boxShadow: _currentSubTab == 'settings'
                          ? const [
                              BoxShadow(
                                color: Color(0x33182036),
                                blurRadius: 8,
                                offset: Offset(0, 2),
                              ),
                            ]
                          : null,
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      'Cài đặt & Đồng bộ',
                      style: TextStyle(
                        fontFamily: WarmPearlTypography.displayFont,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w700,
                        color: _currentSubTab == 'settings'
                            ? Colors.white
                            : WarmPearlColors.inkSecondary,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // SUB-VIEW 1: HỒ SƠ SINH VIÊN
        if (_currentSubTab == 'info') ...[
          // 3D Holographic Pass
          HoloStudentPass(session: session),

          const SizedBox(height: 14),

          // 7-Row Structured Detail Glass Card
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            decoration: BoxDecoration(
              color: WarmPearlColors.glassBgStrong,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: WarmPearlColors.glassBorderStrong,
                width: 1,
              ),
              boxShadow: WarmPearlShadows.glassSm,
            ),
            child: Column(
              children: [
                _buildProfileDetailRow(
                  icon: Icons.person_outline_rounded,
                  label: 'Họ và tên đầy đủ',
                  value: session?.fullName ?? '—',
                ),
                const Divider(height: 1, color: WarmPearlColors.glassDivider),
                _buildProfileDetailRow(
                  icon: Icons.badge_outlined,
                  label: 'Lớp sinh hoạt & Khóa',
                  value: '${session?.className ?? '—'} • ${session?.cohort ?? '—'}',
                ),
                const Divider(height: 1, color: WarmPearlColors.glassDivider),
                _buildProfileDetailRow(
                  icon: Icons.account_balance_outlined,
                  label: 'Khoa quản lý & Ngành',
                  value: '${session?.faculty ?? '—'}\n${session?.major ?? '—'}',
                ),
                const Divider(height: 1, color: WarmPearlColors.glassDivider),
                _buildProfileDetailRow(
                  icon: Icons.school_outlined,
                  label: 'Chương trình đào tạo',
                  value: session?.program ?? '—',
                ),
                const Divider(height: 1, color: WarmPearlColors.glassDivider),
                _buildProfileDetailRow(
                  icon: Icons.cake_outlined,
                  label: 'Ngày sinh & Giới tính',
                  value: '${session?.dob ?? '—'} • ${session?.gender ?? '—'}',
                ),
                const Divider(height: 1, color: WarmPearlColors.glassDivider),
                GestureDetector(
                  onTap: () => context.go('/courses'),
                  behavior: HitTestBehavior.opaque,
                  child: _buildProfileDetailRow(
                    icon: Icons.menu_book_rounded,
                    label: 'Học phần học kỳ hiện tại',
                    value: '${session?.totalCourses ?? 0} môn (Xem chi tiết →)',
                    valueColor: WarmPearlColors.coralInk,
                  ),
                ),
                const Divider(height: 1, color: WarmPearlColors.glassDivider),
                _buildProfileDetailRow(
                  icon: Icons.history_rounded,
                  label: 'Thời gian đồng bộ cổng trường',
                  value: session?.dutLastSyncedAt ?? 'Hôm nay',
                ),
              ],
            ),
          ),

          const SizedBox(height: 14),

          // Office365 Email Box
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.8),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: WarmPearlColors.glassBorder),
            ),
            child: Row(
              children: [
                Container(
                  width: 36,
                  height: 36,
                  decoration: BoxDecoration(
                    color: const Color(0xFFD97706).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(
                    Icons.alternate_email_rounded,
                    color: Color(0xFFD97706),
                    size: 18,
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Email trường cấp (Office365)',
                        style: TextStyle(
                          fontFamily: WarmPearlTypography.bodyFont,
                          fontSize: 11,
                          color: WarmPearlColors.inkMuted,
                        ),
                      ),
                      Text(
                        session?.schoolEmail?.isNotEmpty == true
                            ? session!.schoolEmail!
                            : '${session?.studentCode ?? 'sv'}@sv1.dut.udn.vn',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontFamily: WarmPearlTypography.displayFont,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: WarmPearlColors.inkPrimary,
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(
                    Icons.copy_rounded,
                    size: 16,
                    color: WarmPearlColors.inkMuted,
                  ),
                  onPressed: () {
                    final email = session?.schoolEmail ??
                        '${session?.studentCode ?? 'sv'}@sv1.dut.udn.vn';
                    Clipboard.setData(ClipboardData(text: email));
                    AppToast.showSuccess(context, 'Đã sao chép email sinh viên');
                  },
                ),
              ],
            ),
          ),
        ]

        // SUB-VIEW 2: CÀI ĐẶT & ĐỒNG BỘ
        else ...[
          // Google Calendar Card
          GCalSettingsCard(highlightPulse: _focusGcal),

          const SizedBox(height: 12),

          // Quick Reminders Settings Card
          const QuickRemindersSettingsCard(),

          const SizedBox(height: 12),

          // Interest Topics Card
          const InterestTopicsCard(),

          const SizedBox(height: 12),

          // Followed Fanpages Card
          const FollowedFanpagesCard(),

          const SizedBox(height: 14),

          // Re-sync Courses Utility Row
          GestureDetector(
            onTap: _handleReSyncCourses,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.75),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: WarmPearlColors.glassBorder),
              ),
              child: Row(
                children: const [
                  Icon(
                    Icons.sync_rounded,
                    size: 20,
                    color: WarmPearlColors.mint,
                  ),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Đồng bộ lại danh sách học phần từ cổng',
                      style: TextStyle(
                        fontFamily: WarmPearlTypography.displayFont,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: WarmPearlColors.inkPrimary,
                      ),
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    size: 18,
                    color: WarmPearlColors.inkMuted,
                  ),
                ],
              ),
            ),
          ),

          const SizedBox(height: 10),

          // Logout Utility Row (Rose border)
          GestureDetector(
            onTap: () => _showLogoutConfirmation(context),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              decoration: BoxDecoration(
                color: WarmPearlColors.roseSoft,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: WarmPearlColors.roseBorder),
              ),
              child: Row(
                children: const [
                  Icon(
                    Icons.logout_rounded,
                    size: 20,
                    color: WarmPearlColors.rose,
                  ),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Đăng xuất khỏi thiết bị',
                      style: TextStyle(
                        fontFamily: WarmPearlTypography.displayFont,
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: WarmPearlColors.rose,
                      ),
                    ),
                  ),
                  Icon(
                    Icons.chevron_right_rounded,
                    size: 18,
                    color: WarmPearlColors.rose,
                  ),
                ],
              ),
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildProfileDetailRow({
    required IconData icon,
    required String label,
    required String value,
    Color? valueColor,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 11),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.8),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, size: 16, color: WarmPearlColors.inkSecondary),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontFamily: WarmPearlTypography.bodyFont,
                    fontSize: 11,
                    color: WarmPearlColors.inkMuted,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: TextStyle(
                    fontFamily: WarmPearlTypography.displayFont,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: valueColor ?? WarmPearlColors.inkPrimary,
                    height: 1.25,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
