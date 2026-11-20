import 'dart:ui' as ui;

import 'package:material_ui/material_ui.dart';

import 'warm_pearl_tokens.dart';

enum LiquidGlassButtonVariant {
  coral,
  ghost,
  rose,
  slate,
  mintSoft,
}

enum LiquidGlassBadgeVariant {
  coral,
  mint,
  violet,
  rose,
  neutral,
}

enum WarmPearlSwitchVariant {
  mint,
  coral,
}

/// Reusable pressable wrapper providing spring scale feedback on tap.
class WarmPearlPressable extends StatefulWidget {
  const WarmPearlPressable({
    super.key,
    required this.child,
    this.onTap,
    this.scale = WarmPearlMotion.pressCard,
    this.enabled = true,
  });

  final Widget child;
  final VoidCallback? onTap;
  final double scale;
  final bool enabled;

  @override
  State<WarmPearlPressable> createState() => _WarmPearlPressableState();
}

class _WarmPearlPressableState extends State<WarmPearlPressable> {
  bool _pressed = false;

  void _setPressed(bool value) {
    if (!widget.enabled || widget.onTap == null) return;
    if (_pressed != value) {
      setState(() => _pressed = value);
    }
  }

  @override
  Widget build(BuildContext context) {
    final disableAnimations = MediaQuery.disableAnimationsOf(context);
    final activeScale = (_pressed && !disableAnimations) ? widget.scale : 1.0;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: widget.enabled ? widget.onTap : null,
      onTapDown: (_) => _setPressed(true),
      onTapUp: (_) => _setPressed(false),
      onTapCancel: () => _setPressed(false),
      child: AnimatedScale(
        scale: activeScale,
        duration: WarmPearlMotion.press250,
        curve: WarmPearlMotion.spring,
        child: widget.child,
      ),
    );
  }
}

/// Warm Pearl frosted Liquid Glass container with specular sheen & crisp border.
/// Preserves all v1 named parameters for backward compatibility across M2–M4.
class LiquidGlassContainer extends StatelessWidget {
  const LiquidGlassContainer({
    super.key,
    required this.child,
    this.borderRadius = WarmPearlRadii.glassCard,
    this.blurSigma = WarmPearlBlurs.glass,
    this.opacity = 0.58,
    this.borderOpacity = 0.85,
    this.padding,
    this.margin,
    this.gradientColors,
    this.boxShadow,
    this.width,
    this.height,
    this.borderColor,
    this.borderWidth = WarmPearlBorders.thin,
    this.showSpecularSheen = true,
    this.radialTint,
    this.radialCenter = const Alignment(0.92, -0.84),
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
  final Color? borderColor;
  final double borderWidth;
  final bool showSpecularSheen;
  final Color? radialTint;
  final Alignment radialCenter;

  @override
  Widget build(BuildContext context) {
    final resolvedRadius = BorderRadius.circular(borderRadius);
    final resolvedBorderColor =
        borderColor ?? Colors.white.withValues(alpha: borderOpacity);

    final BoxDecoration surfaceDecoration;
    if (gradientColors != null && gradientColors!.isNotEmpty) {
      surfaceDecoration = BoxDecoration(
        borderRadius: resolvedRadius,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: gradientColors!,
        ),
        border: Border.all(
          color: resolvedBorderColor,
          width: borderWidth,
        ),
      );
    } else {
      surfaceDecoration = BoxDecoration(
        borderRadius: resolvedRadius,
        color: Colors.white.withValues(alpha: opacity),
        border: Border.all(
          color: resolvedBorderColor,
          width: borderWidth,
        ),
      );
    }

    final Widget contentWithPadding = padding != null
        ? Padding(padding: padding!, child: child)
        : child;

    final bool hasOverlay = showSpecularSheen || radialTint != null;

    final Widget innerBody = hasOverlay
        ? Stack(
            fit: StackFit.loose,
            children: [
              if (radialTint != null)
                Positioned.fill(
                  child: IgnorePointer(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: resolvedRadius,
                        gradient: RadialGradient(
                          center: radialCenter,
                          radius: 1.24,
                          colors: [
                            radialTint!,
                            radialTint!.withValues(alpha: 0.0),
                          ],
                          stops: const [0.0, 0.62],
                        ),
                      ),
                    ),
                  ),
                ),
              if (showSpecularSheen)
                Positioned.fill(
                  child: IgnorePointer(
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: resolvedRadius,
                        gradient: WarmPearlGradients.specularSheen,
                      ),
                    ),
                  ),
                ),
              contentWithPadding,
            ],
          )
        : contentWithPadding;

    return Container(
      width: width,
      height: height,
      margin: margin,
      decoration: BoxDecoration(
        borderRadius: resolvedRadius,
        boxShadow: boxShadow ?? WarmPearlShadows.glass,
      ),
      child: ClipRRect(
        borderRadius: resolvedRadius,
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: blurSigma, sigmaY: blurSigma),
          child: DecoratedBox(
            decoration: surfaceDecoration,
            child: innerBody,
          ),
        ),
      ),
    );
  }
}

/// Interactive Warm Pearl Liquid Glass card with optional pressable scale.
class LiquidGlassCard extends StatelessWidget {
  const LiquidGlassCard({
    super.key,
    required this.child,
    this.onTap,
    this.padding = const EdgeInsets.all(18),
    this.margin = const EdgeInsets.only(bottom: 14),
    this.borderRadius = WarmPearlRadii.glassCard,
    this.accentColor,
    this.radialTint,
    this.radialCenter = const Alignment(0.92, -0.84),
    this.enablePressScale = true,
    this.borderColor,
    this.boxShadow,
    this.gradientColors,
    this.opacity = 0.58,
  });

  final Widget child;
  final VoidCallback? onTap;
  final EdgeInsetsGeometry padding;
  final EdgeInsetsGeometry margin;
  final double borderRadius;
  final Color? accentColor;
  final Color? radialTint;
  final Alignment radialCenter;
  final bool enablePressScale;
  final Color? borderColor;
  final List<BoxShadow>? boxShadow;
  final List<Color>? gradientColors;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    final resolvedGradient = gradientColors ??
        (accentColor != null
            ? [
                accentColor!.withValues(alpha: 0.12),
                Colors.white.withValues(alpha: 0.84),
              ]
            : null);

    final card = LiquidGlassContainer(
      margin: margin,
      padding: padding,
      borderRadius: borderRadius,
      opacity: opacity,
      gradientColors: resolvedGradient,
      radialTint: radialTint,
      radialCenter: radialCenter,
      borderColor: borderColor,
      boxShadow: boxShadow,
      child: child,
    );

    if (onTap == null) {
      return card;
    }

    if (enablePressScale) {
      return WarmPearlPressable(
        onTap: onTap,
        scale: WarmPearlMotion.pressCard,
        child: card,
      );
    }

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: card,
    );
  }
}

/// Warm Pearl CTA pill button supporting coral, ghost, rose, slate, and mintSoft variants.
/// Preserves all v1 constructor parameters for backward compatibility.
class LiquidGlassButton extends StatelessWidget {
  const LiquidGlassButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.isLoading = false,
    this.isPrimary = true,
    this.height = WarmPearlSizes.sheetCtaHeight,
    this.variant,
    this.borderRadius = WarmPearlRadii.pill,
    this.width,
    this.padding = const EdgeInsets.symmetric(horizontal: 20),
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData? icon;
  final bool isLoading;
  final bool isPrimary;
  final double height;
  final LiquidGlassButtonVariant? variant;
  final double borderRadius;
  final double? width;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final resolvedVariant = variant ??
        (isPrimary
            ? LiquidGlassButtonVariant.coral
            : LiquidGlassButtonVariant.ghost);
    final isEnabled = !isLoading && onPressed != null;

    final Color textColor;
    final FontWeight fontWeight;
    final Gradient? gradient;
    final Color? solidColor;
    final Border border;
    final List<BoxShadow> shadow;
    final double pressScale;

    switch (resolvedVariant) {
      case LiquidGlassButtonVariant.coral:
        textColor = WarmPearlColors.white;
        fontWeight = FontWeight.w700;
        gradient = WarmPearlGradients.coralButton;
        solidColor = null;
        border = Border.all(
          color: WarmPearlColors.white.withValues(alpha: 0.45),
          width: 1.0,
        );
        shadow = WarmPearlShadows.coralButton;
        pressScale = WarmPearlMotion.pressCoralBtn;
      case LiquidGlassButtonVariant.ghost:
        textColor = WarmPearlColors.inkPrimary;
        fontWeight = FontWeight.w600;
        gradient = null;
        solidColor = WarmPearlColors.ghostBtnBg;
        border = WarmPearlBorders.glassStrong;
        shadow = WarmPearlShadows.glassSm;
        pressScale = WarmPearlMotion.pressGhostBtn;
      case LiquidGlassButtonVariant.rose:
        textColor = WarmPearlColors.white;
        fontWeight = FontWeight.w700;
        gradient = WarmPearlGradients.roseButton;
        solidColor = null;
        border = Border.all(
          color: WarmPearlColors.white.withValues(alpha: 0.45),
          width: 1.0,
        );
        shadow = WarmPearlShadows.roseButton;
        pressScale = WarmPearlMotion.pressCoralBtn;
      case LiquidGlassButtonVariant.slate:
        textColor = WarmPearlColors.white;
        fontWeight = FontWeight.w700;
        gradient = WarmPearlGradients.slateMarkRead;
        solidColor = null;
        border = Border.all(
          color: WarmPearlColors.white.withValues(alpha: 0.25),
          width: 1.0,
        );
        shadow = WarmPearlShadows.glassSm;
        pressScale = WarmPearlMotion.pressCoralBtn;
      case LiquidGlassButtonVariant.mintSoft:
        textColor = WarmPearlColors.mint;
        fontWeight = FontWeight.w700;
        gradient = null;
        solidColor = WarmPearlColors.mintSoft;
        border = WarmPearlBorders.mint;
        shadow = const [];
        pressScale = WarmPearlMotion.pressGhostBtn;
    }

    final resolvedRadius = BorderRadius.circular(borderRadius);

    final Widget buttonBody = AnimatedOpacity(
      opacity: (onPressed == null && !isLoading) ? 0.52 : 1.0,
      duration: WarmPearlMotion.fast200,
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          borderRadius: resolvedRadius,
          boxShadow: isEnabled ? shadow : const [],
        ),
        child: ClipRRect(
          borderRadius: resolvedRadius,
          child: BackdropFilter(
            filter: ui.ImageFilter.blur(sigmaX: 16, sigmaY: 16),
            child: Container(
              padding: padding,
              decoration: BoxDecoration(
                borderRadius: resolvedRadius,
                gradient: gradient,
                color: solidColor,
                border: border,
              ),
              child: Center(
                child: isLoading
                    ? SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.3,
                          valueColor: AlwaysStoppedAnimation<Color>(textColor),
                        ),
                      )
                    : Row(
                        mainAxisSize: MainAxisSize.min,
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          if (icon != null) ...[
                            Icon(icon, size: 18, color: textColor),
                            const SizedBox(width: 7),
                          ],
                          Flexible(
                            child: Text(
                              label,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontFamily: WarmPearlTypography.displayFont,
                                fontFamilyFallback:
                                    WarmPearlTypography.fontFallback,
                                fontSize: 13.5,
                                fontWeight: fontWeight,
                                letterSpacing: -0.1,
                                color: textColor,
                              ),
                            ),
                          ),
                        ],
                      ),
              ),
            ),
          ),
        ),
      ),
    );

    return Semantics(
      button: true,
      enabled: isEnabled,
      label: label,
      child: WarmPearlPressable(
        onTap: isEnabled ? onPressed : null,
        enabled: isEnabled,
        scale: pressScale,
        child: buttonBody,
      ),
    );
  }
}

/// Warm Pearl capsule badge (const constructor preserved for unmigrated M2–M4 callers).
class LiquidGlassBadge extends StatelessWidget {
  const LiquidGlassBadge({
    super.key,
    required this.text,
    this.color = WarmPearlColors.coralInk,
    this.icon,
    this.variant,
    this.backgroundColor,
    this.borderColor,
    this.showDot = false,
  });

  final String text;
  final Color color;
  final IconData? icon;
  final LiquidGlassBadgeVariant? variant;
  final Color? backgroundColor;
  final Color? borderColor;
  final bool showDot;

  @override
  Widget build(BuildContext context) {
    final Color fg;
    final Color bg;
    final Color bd;

    if (variant != null) {
      switch (variant!) {
        case LiquidGlassBadgeVariant.coral:
          fg = WarmPearlColors.coralInk;
          bg = backgroundColor ?? WarmPearlColors.coralSoft;
          bd = borderColor ?? WarmPearlColors.coralBorder;
        case LiquidGlassBadgeVariant.mint:
          fg = WarmPearlColors.mint;
          bg = backgroundColor ?? WarmPearlColors.mintSoft;
          bd = borderColor ?? WarmPearlColors.mintBorder;
        case LiquidGlassBadgeVariant.violet:
          fg = WarmPearlColors.violet;
          bg = backgroundColor ?? WarmPearlColors.violetSoft;
          bd = borderColor ?? WarmPearlColors.violetBorder;
        case LiquidGlassBadgeVariant.rose:
          fg = WarmPearlColors.rose;
          bg = backgroundColor ?? WarmPearlColors.roseSoft;
          bd = borderColor ?? WarmPearlColors.roseBorder;
        case LiquidGlassBadgeVariant.neutral:
          fg = WarmPearlColors.inkSecondary;
          bg = backgroundColor ?? WarmPearlColors.trackBg;
          bd = borderColor ?? WarmPearlColors.glassDivider;
      }
    } else {
      fg = color;
      bg = backgroundColor ?? color.withValues(alpha: 0.12);
      bd = borderColor ?? color.withValues(alpha: 0.30);
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(WarmPearlRadii.pill),
        border: Border.all(color: bd, width: WarmPearlBorders.thin),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (showDot) ...[
            Container(
              width: 6,
              height: 6,
              decoration: BoxDecoration(color: fg, shape: BoxShape.circle),
            ),
            const SizedBox(width: 5),
          ] else if (icon != null) ...[
            Icon(icon, size: 12.5, color: fg),
            const SizedBox(width: 4),
          ],
          Flexible(
            child: Text(
              text,
              maxLines: 1,
              softWrap: false,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontFamily: WarmPearlTypography.bodyFont,
                fontFamilyFallback: WarmPearlTypography.fontFallback,
                color: fg,
                fontSize: 11.0,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.11,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Segment descriptor for [WarmPearlSegmentedControl].
class WarmPearlSegment<T> {
  const WarmPearlSegment({
    required this.value,
    required this.label,
    this.useVioletLens = false,
  });

  final T value;
  final String label;
  final bool useVioletLens;
}

/// 2- or 3-segment frosted glass pill switcher with spring-animated sliding lens.
class WarmPearlSegmentedControl<T> extends StatelessWidget {
  const WarmPearlSegmentedControl({
    super.key,
    required this.segments,
    required this.selectedValue,
    required this.onChanged,
    this.height = 42.0,
    this.useVioletLens = false,
  });

  final List<WarmPearlSegment<T>> segments;
  final T selectedValue;
  final ValueChanged<T> onChanged;
  final double height;
  final bool useVioletLens;

  @override
  Widget build(BuildContext context) {
    if (segments.isEmpty) {
      return const SizedBox.shrink();
    }

    final selectedIndex = segments
        .indexWhere((segment) => segment.value == selectedValue)
        .clamp(0, segments.length - 1);
    final activeSegment = segments[selectedIndex];
    final isViolet = useVioletLens || activeSegment.useVioletLens;

    return Container(
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(WarmPearlRadii.pill),
        boxShadow: WarmPearlShadows.glassSm,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(WarmPearlRadii.pill),
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(
            sigmaX: WarmPearlBlurs.glass,
            sigmaY: WarmPearlBlurs.glass,
          ),
          child: Container(
            decoration: BoxDecoration(
              color: WarmPearlColors.segSwitcherBg,
              borderRadius: BorderRadius.circular(WarmPearlRadii.pill),
              border: WarmPearlBorders.glassStrong,
            ),
            child: LayoutBuilder(
              builder: (context, constraints) {
                const pad = 4.0;
                final innerWidth =
                    (constraints.maxWidth - pad * 2).clamp(0.0, double.infinity);
                final segmentWidth = innerWidth / segments.length;

                return Stack(
                  children: [
                    AnimatedPositioned(
                      duration: WarmPearlMotion.segLens360,
                      curve: WarmPearlMotion.spring,
                      left: pad + selectedIndex * segmentWidth,
                      top: pad,
                      bottom: pad,
                      width: segmentWidth,
                      child: AnimatedContainer(
                        duration: WarmPearlMotion.drawer300,
                        curve: Curves.ease,
                        decoration: BoxDecoration(
                          borderRadius:
                              BorderRadius.circular(WarmPearlRadii.pill),
                          gradient: isViolet
                              ? WarmPearlGradients.violetLens
                              : WarmPearlGradients.coralButton,
                          boxShadow: isViolet
                              ? WarmPearlShadows.violetLens
                              : WarmPearlShadows.coralButton,
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(pad),
                      child: Row(
                        children: [
                          for (var i = 0; i < segments.length; i++)
                            Expanded(
                              child: GestureDetector(
                                behavior: HitTestBehavior.opaque,
                                onTap: () => onChanged(segments[i].value),
                                child: SizedBox(
                                  height: height - pad * 2,
                                  child: Center(
                                    child: AnimatedDefaultTextStyle(
                                      duration: WarmPearlMotion.fast200,
                                      style: TextStyle(
                                        fontFamily: WarmPearlTypography.bodyFont,
                                        fontFamilyFallback:
                                            WarmPearlTypography.fontFallback,
                                        fontSize: 12.2,
                                        fontWeight: FontWeight.w700,
                                        color: i == selectedIndex
                                            ? WarmPearlColors.white
                                            : WarmPearlColors.inkSecondary,
                                      ),
                                      child: Text(
                                        segments[i].label,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

/// Spec `.ios-switch` `48x28` pill toggle with Mint or Coral active gradient.
class WarmPearlSwitch extends StatelessWidget {
  const WarmPearlSwitch({
    super.key,
    required this.value,
    required this.onChanged,
    this.activeVariant = WarmPearlSwitchVariant.mint,
    this.semanticLabel,
  });

  final bool value;
  final ValueChanged<bool>? onChanged;
  final WarmPearlSwitchVariant activeVariant;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    final enabled = onChanged != null;
    final activeGradient = activeVariant == WarmPearlSwitchVariant.mint
        ? WarmPearlGradients.mintSwitch
        : WarmPearlGradients.coralButton;
    final activeShadow = activeVariant == WarmPearlSwitchVariant.mint
        ? WarmPearlShadows.mintSwitch
        : WarmPearlShadows.coralSwitch;

    return Semantics(
      toggled: value,
      enabled: enabled,
      label: semanticLabel,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: enabled ? () => onChanged!(!value) : null,
        child: AnimatedOpacity(
          opacity: enabled ? 1.0 : 0.5,
          duration: WarmPearlMotion.fast200,
          child: AnimatedContainer(
            duration: WarmPearlMotion.switchTrack280,
            curve: WarmPearlMotion.smooth,
            width: WarmPearlSizes.switchW,
            height: WarmPearlSizes.switchH,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(WarmPearlRadii.pill),
              color: value ? null : WarmPearlColors.switchOffTrack,
              gradient: value ? activeGradient : null,
              border: value
                  ? null
                  : Border.all(
                      color: WarmPearlColors.white.withValues(alpha: 0.70),
                      width: WarmPearlBorders.thin,
                    ),
              boxShadow: value ? activeShadow : const [],
            ),
            child: Stack(
              children: [
                AnimatedPositioned(
                  duration: WarmPearlMotion.switchThumb320,
                  curve: WarmPearlMotion.spring,
                  top: 3,
                  left: value ? 23 : 3,
                  child: Container(
                    width: WarmPearlSizes.switchThumb,
                    height: WarmPearlSizes.switchThumb,
                    decoration: const BoxDecoration(
                      color: WarmPearlColors.white,
                      shape: BoxShape.circle,
                      boxShadow: WarmPearlShadows.switchThumb,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Spec `.glass-input-wrap` input field with focus glow ring and inline error state.
class WarmPearlInputBox extends StatefulWidget {
  const WarmPearlInputBox({
    super.key,
    this.controller,
    this.focusNode,
    this.hintText,
    this.prefixIcon,
    this.suffix,
    this.obscureText = false,
    this.keyboardType,
    this.textInputAction,
    this.onChanged,
    this.onSubmitted,
    this.errorText,
    this.height = WarmPearlSizes.inputHeight,
    this.borderRadius = WarmPearlRadii.inputBox,
    this.fillColor,
    this.autofocus = false,
    this.enabled = true,
  });

  final TextEditingController? controller;
  final FocusNode? focusNode;
  final String? hintText;
  final Widget? prefixIcon;
  final Widget? suffix;
  final bool obscureText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final String? errorText;
  final double height;
  final double borderRadius;
  final Color? fillColor;
  final bool autofocus;
  final bool enabled;

  @override
  State<WarmPearlInputBox> createState() => _WarmPearlInputBoxState();
}

class _WarmPearlInputBoxState extends State<WarmPearlInputBox> {
  FocusNode? _ownedFocusNode;
  bool _hasFocus = false;

  FocusNode get _effectiveFocusNode => widget.focusNode ?? _ownedFocusNode!;

  @override
  void initState() {
    super.initState();
    if (widget.focusNode == null) {
      _ownedFocusNode = FocusNode();
    }
    _hasFocus = _effectiveFocusNode.hasFocus;
    _effectiveFocusNode.addListener(_handleFocusChange);
  }

  @override
  void didUpdateWidget(covariant WarmPearlInputBox oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.focusNode != widget.focusNode) {
      oldWidget.focusNode?.removeListener(_handleFocusChange);
      if (widget.focusNode == null && _ownedFocusNode == null) {
        _ownedFocusNode = FocusNode();
      } else if (widget.focusNode != null && _ownedFocusNode != null) {
        _ownedFocusNode!.removeListener(_handleFocusChange);
        _ownedFocusNode!.dispose();
        _ownedFocusNode = null;
      }
      _hasFocus = _effectiveFocusNode.hasFocus;
      _effectiveFocusNode.addListener(_handleFocusChange);
    }
  }

  void _handleFocusChange() {
    final focused = _effectiveFocusNode.hasFocus;
    if (focused != _hasFocus && mounted) {
      setState(() => _hasFocus = focused);
    }
  }

  @override
  void dispose() {
    _effectiveFocusNode.removeListener(_handleFocusChange);
    _ownedFocusNode?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasError = widget.errorText != null && widget.errorText!.isNotEmpty;
    final restingColor = widget.fillColor ?? WarmPearlColors.inputBg;
    final bgColor = _hasFocus ? WarmPearlColors.white : restingColor;
    final border = hasError
        ? WarmPearlBorders.inputError
        : (_hasFocus
            ? WarmPearlBorders.inputFocused
            : WarmPearlBorders.input);
    final shadows = (_hasFocus && !hasError)
        ? WarmPearlShadows.inputFocusRing
        : const <BoxShadow>[];

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AnimatedContainer(
          duration: WarmPearlMotion.fast200,
          curve: Curves.ease,
          height: widget.height,
          padding: const EdgeInsets.symmetric(horizontal: 13),
          decoration: BoxDecoration(
            color: bgColor,
            borderRadius: BorderRadius.circular(widget.borderRadius),
            border: border,
            boxShadow: shadows,
          ),
          child: Row(
            children: [
              if (widget.prefixIcon != null) ...[
                widget.prefixIcon!,
                const SizedBox(width: 9),
              ],
              Expanded(
                child: TextField(
                  controller: widget.controller,
                  focusNode: _effectiveFocusNode,
                  obscureText: widget.obscureText,
                  keyboardType: widget.keyboardType,
                  textInputAction: widget.textInputAction,
                  onChanged: widget.onChanged,
                  onSubmitted: widget.onSubmitted,
                  autofocus: widget.autofocus,
                  enabled: widget.enabled,
                  style: const TextStyle(
                    fontFamily: WarmPearlTypography.bodyFont,
                    fontFamilyFallback: WarmPearlTypography.fontFallback,
                    fontSize: 13.5,
                    fontWeight: FontWeight.w500,
                    color: WarmPearlColors.inkPrimary,
                  ),
                  decoration: InputDecoration(
                    hintText: widget.hintText,
                    hintStyle: const TextStyle(
                      fontFamily: WarmPearlTypography.bodyFont,
                      fontFamilyFallback: WarmPearlTypography.fontFallback,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w400,
                      color: WarmPearlColors.inkMuted,
                    ),
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    errorBorder: InputBorder.none,
                    disabledBorder: InputBorder.none,
                    isDense: true,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ),
              if (widget.suffix != null) ...[
                const SizedBox(width: 8),
                widget.suffix!,
              ],
            ],
          ),
        ),
        if (hasError)
          Padding(
            padding: const EdgeInsets.only(top: 5, left: 4),
            child: Text(
              widget.errorText!,
              style: const TextStyle(
                fontFamily: WarmPearlTypography.bodyFont,
                fontFamilyFallback: WarmPearlTypography.fontFallback,
                fontSize: 11.5,
                fontWeight: FontWeight.w600,
                color: WarmPearlColors.rose,
              ),
            ),
          ),
      ],
    );
  }
}
