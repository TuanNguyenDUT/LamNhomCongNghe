import 'dart:math' as math;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/network/api_client.dart';
import '../../features/auth/presentation/auth_controller.dart';
import '../../features/courses/presentation/enrolled_courses_screen.dart';
import '../../features/deadlines/presentation/deadlines_screen.dart';
import '../../features/notifications/presentation/follow_fanpage_sheet.dart';
import '../../features/notifications/presentation/notification_providers.dart';
import 'app_toast.dart';
import 'warm_pearl_tokens.dart';

/// Floating Top Dynamic Glass Pill (Warm Pearl Liquid Glass spec).
/// Displays student identity on the left and 3 quick action buttons on the right.
class TopDynamicBar extends ConsumerStatefulWidget {
  const TopDynamicBar({super.key});

  @override
  ConsumerState<TopDynamicBar> createState() => _TopDynamicBarState();
}

class _TopDynamicBarState extends ConsumerState<TopDynamicBar>
    with SingleTickerProviderStateMixin {
  late final AnimationController _spinController;
  bool _isSyncing = false;

  @override
  void initState() {
    super.initState();
    _spinController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 720),
    );
  }

  @override
  void dispose() {
    _spinController.dispose();
    super.dispose();
  }

  Future<void> _handleSyncPortal() async {
    if (_isSyncing) return;
    setState(() => _isSyncing = true);
    _spinController.repeat();

    try {
      final dio = ref.read(dioProvider);
      final studentCode =
          ref.read(authControllerProvider).session?.studentCode ?? '';

      await dio.post(
        '/api/v1/dut/sync-courses',
        data: {'student_id': studentCode},
      );

      // Invalidate providers to reload fresh data
      ref.invalidate(enrolledCoursesProvider);
      ref.invalidate(notificationFeedProvider);
      ref.invalidate(deadlinesListProvider);

      if (mounted) {
        AppToast.showSuccess(
          context,
          'Đã đồng bộ dữ liệu mới nhất từ sv.dut.udn.vn',
        );
      }
    } catch (e) {
      if (mounted) {
        AppToast.showError(
          context,
          'Không thể kết nối cổng sv.dut.udn.vn để đồng bộ',
        );
      }
    } finally {
      if (mounted) {
        _spinController.stop();
        _spinController.reset();
        setState(() => _isSyncing = false);
      }
    }
  }

  void _openFollowFanpage() {
    showFollowFanpageSheet(context);
  }

  void _openSettings() {
    context.go('/profile?tab=settings');
  }

  void _openProfileInfo() {
    context.go('/profile?tab=info');
  }

  @override
  Widget build(BuildContext context) {
    final session = ref.watch(authControllerProvider).session;
    final fullName = session?.fullName.isNotEmpty == true
        ? session!.fullName
        : 'Sinh viên DUT';
    final className = session?.className.isNotEmpty == true
        ? session!.className
        : 'DUT';
    final studentCode = session?.studentCode.isNotEmpty == true
        ? session!.studentCode
        : 'sv.dut';

    return Container(
      padding: const EdgeInsets.fromLTRB(14, 14, 14, 8),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: WarmPearlColors.topPillBg,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: WarmPearlColors.glassBorderStrong, width: 1),
          boxShadow: WarmPearlShadows.glass,
        ),
        child: Row(
          children: [
            // Left identity block (tap -> profile info)
            Expanded(
              child: GestureDetector(
                onTap: _openProfileInfo,
                behavior: HitTestBehavior.opaque,
                child: Row(
                  children: [
                    // Student Avatar (36x36 circular)
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: const Color(0xFFDBEAFE),
                        border: Border.all(color: Colors.white, width: 1.5),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x24182036),
                            blurRadius: 12,
                            offset: Offset(0, 4),
                          ),
                        ],
                      ),
                      child: ClipOval(
                        child: session?.avatarUrl != null &&
                                session!.avatarUrl!.isNotEmpty
                            ? Image.network(
                                session.avatarUrl!,
                                fit: BoxFit.cover,
                                errorBuilder: (context, error, stackTrace) =>
                                    _buildAvatarFallback(fullName),
                              )
                            : _buildAvatarFallback(fullName),
                      ),
                    ),
                    const SizedBox(width: 9),
                    // Name & Class + Subline
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            '$fullName • $className',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontFamily: WarmPearlTypography.displayFont,
                              fontSize: 13.5,
                              fontWeight: FontWeight.w800,
                              color: WarmPearlColors.inkPrimary,
                              height: 1.2,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              Container(
                                width: 7,
                                height: 7,
                                decoration: const BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: WarmPearlColors.mintBright,
                                  boxShadow: [
                                    BoxShadow(
                                      color: Color(0x3310B981),
                                      blurRadius: 3,
                                      spreadRadius: 1,
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 5),
                              Flexible(
                                child: Text(
                                  '$studentCode • sv.dut.udn.vn',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(
                                    fontFamily: WarmPearlTypography.bodyFont,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                    color: WarmPearlColors.inkSecondary,
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
              ),
            ),

            const SizedBox(width: 8),

            // Right action buttons
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                // 1. Follow FB Fanpage
                _GlassCircularIconButton(
                  tooltip: 'Theo dõi Fanpage Facebook',
                  onTap: _openFollowFanpage,
                  icon: const Icon(
                    Icons.link_rounded,
                    size: 17,
                    color: WarmPearlColors.fbBlue,
                  ),
                ),
                const SizedBox(width: 6),

                // 2. Sync Portal
                _GlassCircularIconButton(
                  tooltip: 'Đồng bộ cổng trường',
                  onTap: _handleSyncPortal,
                  child: AnimatedBuilder(
                    animation: _spinController,
                    builder: (context, child) {
                      return Transform.rotate(
                        angle: _spinController.value * 2 * math.pi,
                        child: child,
                      );
                    },
                    child: const Icon(
                      Icons.sync_rounded,
                      size: 17,
                      color: WarmPearlColors.mint,
                    ),
                  ),
                ),
                const SizedBox(width: 6),

                // 3. Settings Gear
                _GlassCircularIconButton(
                  tooltip: 'Cài đặt & Đồng bộ',
                  onTap: _openSettings,
                  icon: const Icon(
                    Icons.settings_outlined,
                    size: 17,
                    color: WarmPearlColors.inkPrimary,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAvatarFallback(String name) {
    final initials = name.trim().split(' ').map((e) => e.isNotEmpty ? e[0] : '').take(2).join();
    return Center(
      child: Text(
        initials.isNotEmpty ? initials.toUpperCase() : 'SV',
        style: const TextStyle(
          fontFamily: WarmPearlTypography.displayFont,
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: Color(0xFF1E40AF),
        ),
      ),
    );
  }
}

class _GlassCircularIconButton extends StatefulWidget {
  const _GlassCircularIconButton({
    required this.onTap,
    this.icon,
    this.child,
    this.tooltip,
  });

  final VoidCallback onTap;
  final Widget? icon;
  final Widget? child;
  final String? tooltip;

  @override
  State<_GlassCircularIconButton> createState() =>
      _GlassCircularIconButtonState();
}

class _GlassCircularIconButtonState extends State<_GlassCircularIconButton> {
  bool _isPressed = false;

  @override
  Widget build(BuildContext context) {
    final content = AnimatedScale(
      scale: _isPressed ? 0.89 : 1.0,
      duration: const Duration(milliseconds: 140),
      curve: WarmPearlMotion.spring,
      child: GestureDetector(
        onTapDown: (_) => setState(() => _isPressed = true),
        onTapUp: (_) => setState(() => _isPressed = false),
        onTapCancel: () => setState(() => _isPressed = false),
        onTap: widget.onTap,
        child: Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: const Color(0xADFFFFFF), // 0.68
            border: Border.all(
              color: const Color(0xEBFFFFFF), // 0.92
              width: 1,
            ),
            boxShadow: WarmPearlShadows.glassSm,
          ),
          alignment: Alignment.center,
          child: widget.child ?? widget.icon,
        ),
      ),
    );

    if (widget.tooltip != null) {
      return Tooltip(message: widget.tooltip!, child: content);
    }
    return content;
  }
}
