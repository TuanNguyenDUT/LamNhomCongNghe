import 'dart:ui' as ui;
import 'package:material_ui/material_ui.dart';

/// HỆ THỐNG GIAO DIỆN APPLE LIQUID GLASS (GLASSMORPHISM & FROSTED GLASS)
/// Chuẩn Human Interface Guidelines của Apple:
/// - Kính mờ siêu thực (Frosted blur sigma 15-25)
/// - Bề mặt phản chiếu ánh sáng (Specular highlights)
/// - Viền phản xạ kính tinh tế (Thin translucent borders)
/// - Chiều sâu bóng đổ nhiều tầng (Multi-layer soft shadows)

class LiquidGlassContainer extends StatelessWidget {
  const LiquidGlassContainer({
    super.key,
    required this.child,
    this.borderRadius = 22.0,
    this.blurSigma = 20.0,
    this.opacity = 0.72,
    this.borderOpacity = 0.65,
    this.padding,
    this.margin,
    this.gradientColors,
    this.boxShadow,
    this.width,
    this.height,
  });

  final Widget child;
  final double borderRadius;
  final double blurSigma;
  final double opacity;
  final double borderOpacity;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final List<Color>? gradientColors;
  final List<BoxShadow>? boxShadow;
  final double? width;
  final double? height;

  @override
  Widget build(BuildContext context) {
    final colors = gradientColors ??
        [
          Colors.white.withValues(alpha: opacity),
          Colors.white.withValues(alpha: opacity * 0.8),
        ];

    return Container(
      width: width,
      height: height,
      margin: margin,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(borderRadius),
        boxShadow: boxShadow ??
            [
              BoxShadow(
                color: const Color(0xFF0F172A).withValues(alpha: 0.06),
                blurRadius: 24,
                offset: const Offset(0, 10),
                spreadRadius: -2,
              ),
              BoxShadow(
                color: Colors.white.withValues(alpha: 0.8),
                blurRadius: 1,
                offset: const Offset(0, 1),
                spreadRadius: 1,
              ),
            ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(borderRadius),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: blurSigma, sigmaY: blurSigma),
          child: Container(
            padding: padding,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(borderRadius),
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: colors,
              ),
              border: Border.all(
                color: Colors.white.withValues(alpha: borderOpacity),
                width: 1.2,
              ),
            ),
            child: child,
          ),
        ),
      ),
    );
  }
}

class LiquidGlassCard extends StatelessWidget {
  const LiquidGlassCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(18),
    this.margin = const EdgeInsets.only(bottom: 14),
    this.borderRadius = 20.0,
    this.accentColor,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final double borderRadius;
  final Color? accentColor;

  @override
  Widget build(BuildContext context) {
    Widget card = LiquidGlassContainer(
      margin: margin,
      padding: padding,
      borderRadius: borderRadius,
      gradientColors: accentColor != null
          ? [
              accentColor!.withValues(alpha: 0.12),
              Colors.white.withValues(alpha: 0.85),
            ]
          : null,
      child: child,
    );

    if (onTap != null) {
      return GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: card,
      );
    }
    return card;
  }
}

class LiquidGlassButton extends StatelessWidget {
  const LiquidGlassButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.isLoading = false,
    this.isPrimary = true,
    this.height = 50.0,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool isLoading;
  final bool isPrimary;
  final double height;

  @override
  Widget build(BuildContext context) {
    final primaryGradient = [
      const Color(0xFF007AFF), // Apple iOS Blue
      const Color(0xFF0051D5),
    ];

    final secondaryGradient = [
      Colors.white.withValues(alpha: 0.85),
      Colors.white.withValues(alpha: 0.65),
    ];

    return Container(
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(25),
        boxShadow: [
          BoxShadow(
            color: isPrimary
                ? const Color(0xFF007AFF).withValues(alpha: 0.32)
                : const Color(0xFF0F172A).withValues(alpha: 0.08),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(25),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 12, sigmaY: 12),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: isLoading ? null : onPressed,
              borderRadius: BorderRadius.circular(25),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 22),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(25),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: isPrimary ? primaryGradient : secondaryGradient,
                  ),
                  border: Border.all(
                    color: isPrimary
                        ? Colors.white.withValues(alpha: 0.35)
                        : Colors.white.withValues(alpha: 0.8),
                    width: 1.2,
                  ),
                ),
                child: Center(
                  child: isLoading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.4,
                            valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : Row(
                          mainAxisSize: MainAxisSize.min,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            if (icon != null) ...[
                              Icon(
                                icon,
                                size: 19,
                                color: isPrimary ? Colors.white : const Color(0xFF0F172A),
                              ),
                              const SizedBox(width: 8),
                            ],
                            Text(
                              label,
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.w600,
                                letterSpacing: -0.2,
                                color: isPrimary ? Colors.white : const Color(0xFF0F172A),
                              ),
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

class LiquidGlassBadge extends StatelessWidget {
  const LiquidGlassBadge({
    super.key,
    required this.text,
    this.color = const Color(0xFF007AFF),
    this.icon,
  });

  final String text;
  final Color color;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: color.withValues(alpha: 0.35),
          width: 0.9,
        ),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 13, color: color),
            const SizedBox(width: 4),
          ],
          Text(
            text,
            style: TextStyle(
              color: color,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: -0.1,
            ),
          ),
        ],
      ),
    );
  }
}
