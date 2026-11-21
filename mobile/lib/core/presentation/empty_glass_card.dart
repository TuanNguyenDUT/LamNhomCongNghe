import 'dart:math' as math;

import 'package:material_ui/material_ui.dart';

import 'liquid_glass.dart';
import 'warm_pearl_tokens.dart';

/// Reusable Warm Pearl empty-state glass card supporting both tinted icon box
/// mode (`orbitalMode: false`) and dual rotating orbital rings mode (`orbitalMode: true`).
class EmptyGlassCard extends StatefulWidget {
  const EmptyGlassCard({
    super.key,
    required this.title,
    required this.description,
    required this.icon,
    this.orbitalMode = false,
    this.iconBackgroundColor,
    this.iconColor,
    this.actionLabel,
    this.onAction,
    this.isActionLoading = false,
    this.padding = const EdgeInsets.fromLTRB(20, 34, 20, 28),
    this.animate = true,
  });

  final String title;
  final String description;
  final IconData icon;
  final bool orbitalMode;
  final Color? iconBackgroundColor;
  final Color? iconColor;
  final String? actionLabel;
  final VoidCallback? onAction;
  final bool isActionLoading;
  final EdgeInsetsGeometry padding;
  final bool animate;

  @override
  State<EmptyGlassCard> createState() => _EmptyGlassCardState();
}

class _EmptyGlassCardState extends State<EmptyGlassCard>
    with TickerProviderStateMixin {
  AnimationController? _outerOrbitCtrl;
  AnimationController? _innerOrbitCtrl;
  bool _isAnimating = false;

  @override
  void initState() {
    super.initState();
    if (widget.orbitalMode) {
      _initControllers();
    }
  }

  void _initControllers() {
    _outerOrbitCtrl ??= AnimationController(
      vsync: this,
      duration: WarmPearlMotion.orbitOuter,
    );
    _innerOrbitCtrl ??= AnimationController(
      vsync: this,
      duration: WarmPearlMotion.orbitInner,
    );
  }

  void _disposeControllers() {
    _outerOrbitCtrl?.dispose();
    _outerOrbitCtrl = null;
    _innerOrbitCtrl?.dispose();
    _innerOrbitCtrl = null;
    _isAnimating = false;
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncAnimationState();
  }

  @override
  void didUpdateWidget(covariant EmptyGlassCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.orbitalMode && !oldWidget.orbitalMode) {
      _initControllers();
    } else if (!widget.orbitalMode && oldWidget.orbitalMode) {
      _disposeControllers();
    }
    _syncAnimationState();
  }

  void _syncAnimationState() {
    if (!widget.orbitalMode) return;
    final disableSystemAnims = MediaQuery.disableAnimationsOf(context);
    final shouldAnimate = widget.animate && !disableSystemAnims;
    if (shouldAnimate == _isAnimating) return;
    _isAnimating = shouldAnimate;
    if (shouldAnimate) {
      _outerOrbitCtrl?.repeat();
      _innerOrbitCtrl?.repeat();
    } else {
      _outerOrbitCtrl?.stop();
      _innerOrbitCtrl?.stop();
    }
  }

  @override
  void dispose() {
    _disposeControllers();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final Widget graphic = widget.orbitalMode
        ? _buildOrbitalGraphic()
        : Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: widget.iconBackgroundColor ?? WarmPearlColors.violetSoft,
              borderRadius: BorderRadius.circular(WarmPearlRadii.emptyIcon),
            ),
            child: Icon(
              widget.icon,
              size: 28,
              color: widget.iconColor ?? WarmPearlColors.violet,
            ),
          );

    return LiquidGlassContainer(
      borderRadius: WarmPearlRadii.emptyGlass,
      padding: widget.padding,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          graphic,
          const SizedBox(height: 14),
          Text(
            widget.title,
            textAlign: TextAlign.center,
            style: WarmPearlTypography.display(
              fontSize: widget.orbitalMode ? 17.5 : 17.0,
              fontWeight: FontWeight.w800,
              color: WarmPearlColors.inkPrimary,
              letterSpacing: -0.34,
            ),
          ),
          const SizedBox(height: 8),
          ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: widget.orbitalMode ? 305 : 290,
            ),
            child: Text(
              widget.description,
              textAlign: TextAlign.center,
              style: WarmPearlTypography.body(
                fontSize: 13.0,
                fontWeight: FontWeight.w400,
                color: WarmPearlColors.inkSecondary,
                height: 1.56,
              ),
            ),
          ),
          if (widget.actionLabel != null && widget.onAction != null) ...[
            const SizedBox(height: 16),
            LiquidGlassButton(
              label: widget.actionLabel!,
              onPressed: widget.onAction,
              isLoading: widget.isActionLoading,
              variant: LiquidGlassButtonVariant.coral,
              height: WarmPearlSizes.coralBtnHeight,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildOrbitalGraphic() {
    final outerCtrl = _outerOrbitCtrl!;
    final innerCtrl = _innerOrbitCtrl!;

    return SizedBox(
      width: 112,
      height: 112,
      child: Stack(
        alignment: Alignment.center,
        clipBehavior: Clip.none,
        children: [
          RotationTransition(
            turns: outerCtrl,
            child: SizedBox(
              width: 112,
              height: 112,
              child: Stack(
                alignment: Alignment.center,
                clipBehavior: Clip.none,
                children: [
                  const Positioned.fill(
                    child: CustomPaint(
                      painter: _DashedCirclePainter(
                        color: WarmPearlColors.coralBorder,
                        strokeWidth: 1.5,
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: -4,
                    child: Container(
                      width: 8,
                      height: 8,
                      decoration: const BoxDecoration(
                        color: WarmPearlColors.coralFrom,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          RotationTransition(
            turns: Tween<double>(begin: 1.0, end: 0.0).animate(innerCtrl),
            child: SizedBox(
              width: 84,
              height: 84,
              child: Stack(
                alignment: Alignment.center,
                clipBehavior: Clip.none,
                children: [
                  Positioned.fill(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: WarmPearlColors.mintBorder,
                          width: 1.5,
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    top: -3.5,
                    child: Container(
                      width: 7,
                      height: 7,
                      decoration: const BoxDecoration(
                        color: WarmPearlColors.mintBright,
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: WarmPearlColors.white.withValues(alpha: 0.85),
              border: Border.all(color: WarmPearlColors.white, width: 1.0),
              boxShadow: WarmPearlShadows.glass,
            ),
            child: Icon(
              widget.icon,
              size: 26,
              color: widget.iconColor ?? WarmPearlColors.coralFrom,
            ),
          ),
        ],
      ),
    );
  }
}

class _DashedCirclePainter extends CustomPainter {
  const _DashedCirclePainter({
    required this.color,
    required this.strokeWidth,
  });

  final Color color;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final radius = (math.min(size.width, size.height) - strokeWidth) / 2;
    final center = Offset(size.width / 2, size.height / 2);
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth;

    const dashCount = 28;
    const sweepStep = (2 * math.pi) / dashCount;
    const dashSweep = sweepStep * 0.55;

    final rect = Rect.fromCircle(center: center, radius: radius);
    for (var i = 0; i < dashCount; i++) {
      canvas.drawArc(rect, i * sweepStep, dashSweep, false, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _DashedCirclePainter oldDelegate) {
    return oldDelegate.color != color || oldDelegate.strokeWidth != strokeWidth;
  }
}
