import 'package:flutter/foundation.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../core/presentation/warm_pearl_tokens.dart';
import '../../../auth/domain/user_session.dart';

/// 3D Holographic Liquid Glass Student Pass.
/// Interactively tilts with pointer hover (Web/Desktop) or touch drag (Mobile).
class HoloStudentPass extends StatefulWidget {
  const HoloStudentPass({super.key, required this.session});

  final UserSession? session;

  @override
  State<HoloStudentPass> createState() => _HoloStudentPassState();
}

class _HoloStudentPassState extends State<HoloStudentPass> {
  double _rotateX = 0.0;
  double _rotateY = 0.0;
  Offset _pointerOffset = const Offset(0.5, 0.5);

  void _onPointerMove(PointerEvent details, Size size) {
    if (size.width == 0 || size.height == 0) return;
    final px = (details.localPosition.dx / size.width).clamp(0.0, 1.0);
    final py = (details.localPosition.dy / size.height).clamp(0.0, 1.0);

    setState(() {
      _pointerOffset = Offset(px, py);
      // Perspective tilt range: +/- 6 degrees (~0.10 rad)
      _rotateX = (0.5 - py) * 0.16;
      _rotateY = (px - 0.5) * 0.16;
    });
  }

  void _onPointerExit() {
    setState(() {
      _rotateX = 0.0;
      _rotateY = 0.0;
      _pointerOffset = const Offset(0.5, 0.5);
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.session;
    final fullName = s?.fullName.isNotEmpty == true ? s!.fullName : 'Sinh viên';
    final studentCode = s?.studentCode.isNotEmpty == true ? s!.studentCode : '—';
    final className = s?.className.isNotEmpty == true ? s!.className : '—';
    final cohort = s?.cohort.isNotEmpty == true ? s!.cohort : 'K2023';

    return LayoutBuilder(
      builder: (context, constraints) {
        final size = Size(constraints.maxWidth, 210);

        final cardContent = AnimatedContainer(
          duration: const Duration(milliseconds: 140),
          curve: Curves.easeOut,
          transform: Matrix4.identity()
            ..setEntry(3, 2, 0.001) // perspective
            ..rotateX(_rotateX)
            ..rotateY(_rotateY),
          transformAlignment: Alignment.center,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            color: WarmPearlColors.glassBgStrong,
            gradient: RadialGradient(
              center: Alignment(
                (_pointerOffset.dx - 0.5) * 2.0,
                (_pointerOffset.dy - 0.5) * 2.0,
              ),
              radius: 1.1,
              colors: const [
                Color(0x73A6F0DC), // Mint sheen
                Color(0x73FFC2A6), // Coral sheen
                Color(0x66C9C3FF), // Violet sheen
                Color(0xB8FFFFFF),
              ],
              stops: const [0.0, 0.38, 0.72, 1.0],
            ),
            border: Border.all(
              color: Colors.white,
              width: 1.5,
            ),
            boxShadow: const [
              BoxShadow(
                color: Color(0x1F182036),
                blurRadius: 32,
                offset: Offset(0, 14),
              ),
            ],
          ),
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Top row: DUT STUDENT PASS + sv.dut.udn.vn verified
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(5),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.8),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(
                          Icons.school_rounded,
                          size: 16,
                          color: WarmPearlColors.coralInk,
                        ),
                      ),
                      const SizedBox(width: 8),
                      const Text(
                        'DUT STUDENT PASS',
                        style: TextStyle(
                          fontFamily: WarmPearlTypography.displayFont,
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          letterSpacing: 0.8,
                          color: WarmPearlColors.inkPrimary,
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      color: WarmPearlColors.mintSoft,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: WarmPearlColors.mintBorder),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        Icon(
                          Icons.check_circle_rounded,
                          size: 11,
                          color: WarmPearlColors.mint,
                        ),
                        SizedBox(width: 4),
                        Text(
                          'sv.dut.udn.vn',
                          style: TextStyle(
                            fontFamily: WarmPearlTypography.displayFont,
                            fontSize: 10,
                            fontWeight: FontWeight.w700,
                            color: WarmPearlColors.mint,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              const Spacer(),

              // Middle Row: Avatar + Name & Info
              Row(
                children: [
                  Container(
                    width: 58,
                    height: 58,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: const Color(0xFFDBEAFE),
                      border: Border.all(color: Colors.white, width: 2),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x29182036),
                          blurRadius: 14,
                          offset: Offset(0, 4),
                        ),
                      ],
                    ),
                    child: ClipOval(
                      child: s?.avatarUrl != null && s!.avatarUrl!.isNotEmpty
                          ? Image.network(
                              s.avatarUrl!,
                              fit: BoxFit.cover,
                              errorBuilder: (context, error, stackTrace) =>
                                  _buildAvatarFallback(fullName),
                            )
                          : _buildAvatarFallback(fullName),
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          fullName,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontFamily: WarmPearlTypography.displayFont,
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.4,
                            color: WarmPearlColors.inkPrimary,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          'MSSV: $studentCode',
                          style: const TextStyle(
                            fontFamily: WarmPearlTypography.displayFont,
                            fontSize: 13,
                            fontWeight: FontWeight.w700,
                            color: WarmPearlColors.coralInk,
                          ),
                        ),
                        const SizedBox(height: 1),
                        Text(
                          'Lớp: $className • Khóa: $cohort',
                          style: const TextStyle(
                            fontFamily: WarmPearlTypography.bodyFont,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w500,
                            color: WarmPearlColors.inkSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              const Spacer(),

              // Bottom subline
              Row(
                children: const [
                  Icon(
                    Icons.verified_user_outlined,
                    size: 13,
                    color: WarmPearlColors.inkMuted,
                  ),
                  SizedBox(width: 5),
                  Text(
                    'Dữ liệu thực tế từ sv.dut.udn.vn/PageCaNhan.aspx',
                    style: TextStyle(
                      fontFamily: WarmPearlTypography.bodyFont,
                      fontSize: 10.5,
                      color: WarmPearlColors.inkMuted,
                    ),
                  ),
                ],
              ),
            ],
          ),
        );

        if (kIsWeb) {
          return MouseRegion(
            onHover: (e) => _onPointerMove(e, size),
            onExit: (_) => _onPointerExit(),
            child: SizedBox(height: size.height, child: cardContent),
          );
        }

        return Listener(
          onPointerMove: (e) => _onPointerMove(e, size),
          onPointerUp: (_) => _onPointerExit(),
          onPointerCancel: (_) => _onPointerExit(),
          child: SizedBox(height: size.height, child: cardContent),
        );
      },
    );
  }

  Widget _buildAvatarFallback(String name) {
    final initials = name.trim().split(' ').map((e) => e.isNotEmpty ? e[0] : '').take(2).join();
    return Center(
      child: Text(
        initials.isNotEmpty ? initials.toUpperCase() : 'SV',
        style: const TextStyle(
          fontFamily: WarmPearlTypography.displayFont,
          fontSize: 18,
          fontWeight: FontWeight.w800,
          color: Color(0xFF1E40AF),
        ),
      ),
    );
  }
}
