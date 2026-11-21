import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:material_ui/material_ui.dart';

import 'warm_pearl_tokens.dart';

/// Persistent Warm Pearl canvas (`#F6F4EF`) with 3 slowly drifting blurred orbs
/// and optional `#EFECE6` desktop/web stage framing (`width >= 480`).
class WarmPearlAmbientBackground extends StatefulWidget {
  const WarmPearlAmbientBackground({
    super.key,
    required this.child,
    this.showThirdOrb = true,
    this.enableStageFrame = true,
    this.animate = true,
    this.orbBlurSigma = WarmPearlBlurs.orb,
  });

  final Widget child;
  final bool showThirdOrb;
  final bool enableStageFrame;
  final bool animate;
  final double orbBlurSigma;

  @override
  State<WarmPearlAmbientBackground> createState() =>
      _WarmPearlAmbientBackgroundState();
}

class _WarmPearlAmbientBackgroundState extends State<WarmPearlAmbientBackground>
    with TickerProviderStateMixin {
  late final AnimationController _orb1Ctrl;
  late final AnimationController _orb2Ctrl;
  late final AnimationController _orb3Ctrl;

  late final Animation<double> _orb1Anim;
  late final Animation<double> _orb2Anim;
  late final Animation<double> _orb3Anim;

  bool _isAnimating = false;

  @override
  void initState() {
    super.initState();
    _orb1Ctrl = AnimationController(
      vsync: this,
      duration: WarmPearlMotion.orb1,
    );
    _orb2Ctrl = AnimationController(
      vsync: this,
      duration: WarmPearlMotion.orb2,
    );
    _orb3Ctrl = AnimationController(
      vsync: this,
      duration: WarmPearlMotion.orb3,
    );

    _orb1Anim = CurvedAnimation(parent: _orb1Ctrl, curve: Curves.easeInOut);
    _orb2Anim = CurvedAnimation(parent: _orb2Ctrl, curve: Curves.easeInOut);
    _orb3Anim = CurvedAnimation(parent: _orb3Ctrl, curve: Curves.easeInOut);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncAnimationState();
  }

  @override
  void didUpdateWidget(covariant WarmPearlAmbientBackground oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.animate != widget.animate) {
      _syncAnimationState();
    }
  }

  void _syncAnimationState() {
    final disableSystemAnims = MediaQuery.disableAnimationsOf(context);
    final shouldAnimate = widget.animate && !disableSystemAnims;
    if (shouldAnimate == _isAnimating) {
      return;
    }
    _isAnimating = shouldAnimate;
    if (shouldAnimate) {
      _orb1Ctrl.repeat(reverse: true);
      _orb2Ctrl.repeat(reverse: true);
      _orb3Ctrl.repeat(reverse: true);
    } else {
      _orb1Ctrl.stop();
      _orb2Ctrl.stop();
      _orb3Ctrl.stop();
    }
  }

  @override
  void dispose() {
    _orb1Ctrl.dispose();
    _orb2Ctrl.dispose();
    _orb3Ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Full 100vw x 100vh fluid Aurora Warm Pearl background without any phone mockup frame.
    return ColoredBox(
      color: WarmPearlColors.canvasBg,
      child: Stack(
        fit: StackFit.expand,
        children: [
          Positioned.fill(
            child: IgnorePointer(
              child: ClipRect(
                child: _AmbientOrbLayer(
                  orb1Anim: _orb1Anim,
                  orb2Anim: _orb2Anim,
                  orb3Anim: _orb3Anim,
                  showThirdOrb: widget.showThirdOrb,
                  blurSigma: widget.orbBlurSigma,
                ),
              ),
            ),
          ),
          widget.child,
        ],
      ),
    );
  }
}

class _AmbientOrbLayer extends StatelessWidget {
  const _AmbientOrbLayer({
    required this.orb1Anim,
    required this.orb2Anim,
    required this.orb3Anim,
    required this.showThirdOrb,
    required this.blurSigma,
  });

  final Animation<double> orb1Anim;
  final Animation<double> orb2Anim;
  final Animation<double> orb3Anim;
  final bool showThirdOrb;
  final double blurSigma;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final w = constraints.maxWidth;
        final h = constraints.maxHeight;

        // Proportional orb sizes covering viewport gracefully on both Mobile & Desktop
        final orbSize1 = math.max(340.0, w * 0.42).clamp(340.0, 720.0);
        final orbSize2 = math.max(360.0, w * 0.44).clamp(360.0, 760.0);
        final orbSize3 = math.max(380.0, w * 0.46).clamp(380.0, 800.0);

        return Stack(
          fit: StackFit.expand,
          children: [
            // Top-Left Coral Ambient Orb
            Positioned(
              top: -orbSize1 * 0.28,
              left: -orbSize1 * 0.22,
              child: _DriftingOrb(
                animation: orb1Anim,
                size: orbSize1,
                color: WarmPearlColors.orbCoral,
                maxOffset: const Offset(70, 85),
                maxScale: 1.15,
                blurSigma: blurSigma,
              ),
            ),
            // Middle-Right Mint Ambient Orb
            Positioned(
              top: (h * 0.22).clamp(80.0, 360.0),
              right: -orbSize2 * 0.25,
              child: _DriftingOrb(
                animation: orb2Anim,
                size: orbSize2,
                color: WarmPearlColors.orbMint,
                maxOffset: const Offset(-80, -65),
                maxScale: 1.15,
                blurSigma: blurSigma,
              ),
            ),
            // Bottom-Left Violet Ambient Orb
            if (showThirdOrb)
              Positioned(
                bottom: -orbSize3 * 0.18,
                left: (w * 0.10).clamp(-40.0, 240.0),
                child: _DriftingOrb(
                  animation: orb3Anim,
                  size: orbSize3,
                  color: WarmPearlColors.orbViolet,
                  maxOffset: const Offset(85, -60),
                  maxScale: 1.10,
                  blurSigma: blurSigma,
                ),
              ),
          ],
        );
      },
    );
  }
}

class _DriftingOrb extends StatelessWidget {
  const _DriftingOrb({
    required this.animation,
    required this.size,
    required this.color,
    required this.maxOffset,
    required this.maxScale,
    required this.blurSigma,
  });

  final Animation<double> animation;
  final double size;
  final Color color;
  final Offset maxOffset;
  final double maxScale;
  final double blurSigma;

  @override
  Widget build(BuildContext context) {
    final orbVisual = ImageFiltered(
      imageFilter: ui.ImageFilter.blur(sigmaX: blurSigma, sigmaY: blurSigma),
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [color, color.withValues(alpha: 0.0)],
            stops: const [0.0, 0.72],
          ),
        ),
      ),
    );

    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: animation,
        builder: (context, child) {
          final t = animation.value;
          final dx = maxOffset.dx * t;
          final dy = maxOffset.dy * t;
          final scale = 1.0 + (maxScale - 1.0) * t;
          return Transform.translate(
            offset: Offset(dx, dy),
            child: Transform.scale(
              scale: scale,
              child: child,
            ),
          );
        },
        child: orbVisual,
      ),
    );
  }
}
