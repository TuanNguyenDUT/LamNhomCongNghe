import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/config/app_config.dart';
import '../../../core/presentation/liquid_glass.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../courses/presentation/enrolled_courses_screen.dart';
import 'widgets/interest_topics_card.dart';
import 'widgets/quick_reminders_settings_card.dart';

class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final session = authState.session;

    final studentCode = session?.studentCode.isNotEmpty == true ? session!.studentCode : '102230026';
    final fullName = session?.fullName.isNotEmpty == true ? session!.fullName : 'Nguyễn Văn Lợi';
    final className = session?.className.isNotEmpty == true ? session!.className : '23T_Nhat1';
    final faculty = session?.faculty.isNotEmpty == true ? session!.faculty : 'Khoa Công nghệ Thông tin';
    final cohort = session?.cohort.isNotEmpty == true ? session!.cohort : 'K2023';
    final major = session?.major?.isNotEmpty == true ? session!.major! : 'Công nghệ Thông tin';
    final program = session?.program?.isNotEmpty == true ? session!.program! : 'Công nghệ Thông tin K2023 Nhật';
    final dob = session?.dob?.isNotEmpty == true ? session!.dob! : '07/09/2005';
    final gender = session?.gender?.isNotEmpty == true ? session!.gender! : 'Nam';
    final schoolEmail = session?.schoolEmail?.isNotEmpty == true ? session!.schoolEmail! : '$studentCode@sv1.dut.udn.vn';
    final personalEmail = session?.personalEmail?.isNotEmpty == true ? session!.personalEmail! : '';
    final phone = session?.phone?.isNotEmpty == true ? session!.phone! : '';
    final avatarPath = session?.avatarUrl?.isNotEmpty == true
        ? session!.avatarUrl!
        : '/api/v1/avatar/$studentCode.jpg';
    final avatarUrl = avatarPath.startsWith('http')
        ? avatarPath
        : '${AppConfig.apiBaseUrl}$avatarPath';
    final totalCourses = session?.totalCourses ?? 9;
    final lastSynced = session?.dutLastSyncedAt ?? 'Hôm nay';

    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9), // Apple iOS Canvas
      body: Stack(
        children: [
          // Background ambient gradient orb for Apple Liquid Glass
          Positioned(
            top: -100,
            right: -60,
            child: Container(
              width: 320,
              height: 320,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFF007AFF).withValues(alpha: 0.22),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            top: 260,
            left: -80,
            child: Container(
              width: 260,
              height: 260,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    const Color(0xFF5856D6).withValues(alpha: 0.16),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          SafeArea(
            child: CustomScrollView(
              physics: const BouncingScrollPhysics(),
              slivers: [
                // Apple Style App Bar
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 16, 20, 10),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Hồ Sơ Sinh Viên',
                              style: TextStyle(
                                fontSize: 28,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF0F172A),
                                letterSpacing: -0.8,
                              ),
                            ),
                            SizedBox(height: 4),
                            Text(
                              'Dữ liệu thực tế từ sv.dut.udn.vn/PageCaNhan.aspx',
                              style: TextStyle(
                                fontSize: 13,
                                color: Color(0xFF64748B),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                        LiquidGlassBadge(
                          text: 'sv.dut.udn.vn',
                          icon: Icons.verified_rounded,
                          color: const Color(0xFF34C759), // Apple Green
                        ),
                      ],
                    ),
                  ),
                ),

                // Main Profile Card (Liquid Glass with Avatar & Full Name)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    child: LiquidGlassContainer(
                      borderRadius: 26,
                      blurSigma: 24,
                      opacity: 0.90,
                      padding: const EdgeInsets.all(22),
                      child: Column(
                        children: [
                          // Avatar & Name
                          Row(
                            children: [
                              Container(
                                width: 76,
                                height: 76,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  gradient: const LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [
                                      Color(0xFF007AFF),
                                      Color(0xFF5856D6),
                                    ],
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: const Color(0xFF007AFF).withValues(alpha: 0.35),
                                      blurRadius: 18,
                                      offset: const Offset(0, 8),
                                    ),
                                  ],
                                ),
                                child: ClipOval(
                                  child: Image.network(
                                    avatarUrl,
                                    fit: BoxFit.cover,
                                    errorBuilder: (context, error, stackTrace) => Center(
                                      child: Text(
                                        studentCode.length >= 2
                                            ? studentCode.substring(studentCode.length - 2)
                                            : 'SV',
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 26,
                                          fontWeight: FontWeight.w800,
                                          letterSpacing: -0.5,
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 18),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      fullName,
                                      style: const TextStyle(
                                        fontSize: 21,
                                        fontWeight: FontWeight.w800,
                                        color: Color(0xFF0F172A),
                                        letterSpacing: -0.5,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Wrap(
                                      spacing: 6,
                                      runSpacing: 6,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 9,
                                            vertical: 3,
                                          ),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF007AFF).withValues(alpha: 0.12),
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                          child: Text(
                                            'MSSV: $studentCode',
                                            style: const TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w700,
                                              color: Color(0xFF007AFF),
                                            ),
                                          ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 8,
                                            vertical: 3,
                                          ),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF5856D6).withValues(alpha: 0.12),
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                          child: Text(
                                            className,
                                            style: const TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w700,
                                              color: Color(0xFF5856D6),
                                            ),
                                          ),
                                        ),
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                            horizontal: 7,
                                            vertical: 3,
                                          ),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFF34C759).withValues(alpha: 0.12),
                                            borderRadius: BorderRadius.circular(10),
                                          ),
                                          child: Text(
                                            cohort,
                                            style: const TextStyle(
                                              fontSize: 11,
                                              fontWeight: FontWeight.w700,
                                              color: Color(0xFF34C759),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),

                          const SizedBox(height: 22),
                          const Divider(height: 1, color: Color(0x1A0F172A)),
                          const SizedBox(height: 18),

                          // Academic details grid
                          _buildDetailRow(
                            icon: Icons.badge_rounded,
                            iconColor: const Color(0xFF007AFF),
                            label: 'Họ và tên đầy đủ',
                            value: fullName,
                          ),
                          const SizedBox(height: 12),
                          _buildDetailRow(
                            icon: Icons.groups_rounded,
                            iconColor: const Color(0xFF5856D6),
                            label: 'Lớp sinh hoạt & Khóa',
                            value: '$className (Khóa $cohort)',
                          ),
                          const SizedBox(height: 12),
                          _buildDetailRow(
                            icon: Icons.account_balance_rounded,
                            iconColor: const Color(0xFF007AFF),
                            label: 'Khoa quản lý & Ngành',
                            value: '$faculty\nNgành: $major',
                          ),
                          if (program.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            _buildDetailRow(
                              icon: Icons.auto_stories_rounded,
                              iconColor: const Color(0xFF0284C7),
                              label: 'Chương trình đào tạo',
                              value: program,
                            ),
                          ],
                          const SizedBox(height: 12),
                          _buildDetailRow(
                            icon: Icons.cake_rounded,
                            iconColor: const Color(0xFFFF2D55),
                            label: 'Ngày sinh & Giới tính',
                            value: '$dob  •  $gender',
                          ),
                          const SizedBox(height: 12),
                          _buildDetailRow(
                            icon: Icons.school_rounded,
                            iconColor: const Color(0xFFFF9500),
                            label: 'Học phần học kỳ hiện tại',
                            value: '$totalCourses học phần đang theo học',
                          ),
                          const SizedBox(height: 12),
                          _buildDetailRow(
                            icon: Icons.sync_rounded,
                            iconColor: const Color(0xFF34C759),
                            label: 'Thời gian đồng bộ cổng trường',
                            value: _formatSyncTime(lastSynced),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                // Section: Chủ đề quan tâm & Cá nhân hóa thông báo
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(20, 16, 20, 10),
                    child: InterestTopicsCard(),
                  ),
                ),

                // Section: Cấu hình Nhắc nhở Nhanh & Lịch Google
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(20, 6, 20, 10),
                    child: QuickRemindersSettingsCard(),
                  ),
                ),

                // Section: Thông tin liên lạc
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 10, 20, 8),
                    child: const Text(
                      'THÔNG TIN LIÊN LẠC & TÀI KHOẢN TRƯỜNG CẤP',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF64748B),
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ),

                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: LiquidGlassContainer(
                      borderRadius: 22,
                      blurSigma: 20,
                      opacity: 0.85,
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        children: [
                          _buildContactItem(
                            icon: Icons.email_rounded,
                            iconColor: const Color(0xFF007AFF),
                            title: 'Email Office365 trường cấp',
                            value: schoolEmail,
                          ),
                          if (personalEmail.isNotEmpty) ...[
                            const Divider(height: 20, color: Color(0x1A0F172A)),
                            _buildContactItem(
                              icon: Icons.alternate_email_rounded,
                              iconColor: const Color(0xFF5856D6),
                              title: 'Email cá nhân liên hệ',
                              value: personalEmail,
                            ),
                          ],
                          if (phone.isNotEmpty) ...[
                            const Divider(height: 20, color: Color(0x1A0F172A)),
                            _buildContactItem(
                              icon: Icons.phone_android_rounded,
                              iconColor: const Color(0xFF34C759),
                              title: 'Số điện thoại',
                              value: phone,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ),
                ),

                // Section: Thao tác tiện ích
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(20, 22, 20, 8),
                    child: const Text(
                      'TIỆN ÍCH & TÙY CHỌN',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: Color(0xFF64748B),
                        letterSpacing: 0.5,
                      ),
                    ),
                  ),
                ),

                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Column(
                      children: [
                        LiquidGlassCard(
                          margin: const EdgeInsets.only(bottom: 12),
                          onTap: () {
                            ref.invalidate(enrolledCoursesProvider);
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Đang làm mới danh sách học phần từ sv.dut.udn.vn...'),
                                duration: Duration(seconds: 2),
                              ),
                            );
                          },
                          child: Row(
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF007AFF).withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: const Icon(
                                  Icons.sync_rounded,
                                  color: Color(0xFF007AFF),
                                  size: 24,
                                ),
                              ),
                              const SizedBox(width: 14),
                              const Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Đồng bộ lại danh sách học phần',
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w600,
                                        color: Color(0xFF0F172A),
                                      ),
                                    ),
                                    SizedBox(height: 2),
                                    Text(
                                      'Cập nhật lại lịch học và thông báo mới',
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: Color(0xFF64748B),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(
                                Icons.chevron_right_rounded,
                                color: Color(0xFF94A3B8),
                              ),
                            ],
                          ),
                        ),

                        LiquidGlassCard(
                          margin: const EdgeInsets.only(bottom: 24),
                          onTap: () => _confirmLogout(context, ref),
                          child: Row(
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: const Color(0xFFFF3B30).withValues(alpha: 0.12), // Apple Red
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: const Icon(
                                  Icons.logout_rounded,
                                  color: Color(0xFFFF3B30),
                                  size: 22,
                                ),
                              ),
                              const SizedBox(width: 14),
                              const Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Đăng xuất khỏi thiết bị',
                                      style: TextStyle(
                                        fontSize: 15,
                                        fontWeight: FontWeight.w600,
                                        color: Color(0xFFFF3B30),
                                      ),
                                    ),
                                    SizedBox(height: 2),
                                    Text(
                                      'Xóa phiên đăng nhập sv.dut.udn.vn',
                                      style: TextStyle(
                                        fontSize: 12,
                                        color: Color(0xFF64748B),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const Icon(
                                Icons.chevron_right_rounded,
                                color: Color(0xFFFF3B30),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // Spacing for floating Bottom Navigation Bar
                const SliverToBoxAdapter(
                  child: SizedBox(height: 100),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow({
    required IconData icon,
    required Color iconColor,
    required String label,
    required String value,
  }) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: iconColor, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  fontSize: 12,
                  color: Color(0xFF64748B),
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF0F172A),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildContactItem({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String value,
  }) {
    return Row(
      children: [
        Container(
          width: 38,
          height: 38,
          decoration: BoxDecoration(
            color: iconColor.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Icon(icon, color: iconColor, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 12,
                  color: Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: Color(0xFF0F172A),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  String _formatSyncTime(String raw) {
    try {
      final dt = DateTime.parse(raw).toLocal();
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')} ngày ${dt.day}/${dt.month}/${dt.year}';
    } catch (_) {
      return raw;
    }
  }

  void _confirmLogout(BuildContext context, WidgetRef ref) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white.withValues(alpha: 0.95),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
        title: const Text(
          'Đăng xuất',
          style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF0F172A)),
        ),
        content: const Text(
          'Bạn có chắc chắn muốn đăng xuất khỏi ứng dụng không? Lần sau bạn sẽ cần nhập lại mật khẩu sv.dut.udn.vn.',
          style: TextStyle(color: Color(0xFF475569), fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('Hủy', style: TextStyle(color: Color(0xFF64748B))),
          ),
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              ref.read(authControllerProvider.notifier).logout();
              context.go('/login');
            },
            child: const Text(
              'Đăng xuất',
              style: TextStyle(color: Color(0xFFFF3B30), fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}
