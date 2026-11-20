import 'dart:async';
import 'dart:ui' as ui;

import 'package:material_ui/material_ui.dart';

import 'warm_pearl_tokens.dart';

/// AppToast: Warm Pearl Liquid Glass floating capsule toast at top of screen.
/// Preserves legacy `AppToast.show(backgroundColor: ...)` override for unmigrated
/// M2–M4 callers while rendering `.toast-bar` glass capsule by default.
class AppToast {
  static OverlayEntry? _currentEntry;
  static Timer? _dismissTimer;

  static void show(
    BuildContext context, {
    required String message,
    Widget? icon,
    Color? backgroundColor,
    Color? textColor,
    Duration duration = WarmPearlMotion.toastAutoDismiss,
    String? actionLabel,
    VoidCallback? onAction,
    bool isError = false,
  }) {
    dismiss();

    final overlay =
        Overlay.maybeOf(context, rootOverlay: true) ?? Overlay.of(context);

    late OverlayEntry entry;
    entry = OverlayEntry(
      builder: (ctx) => _TopToastWidget(
        message: message,
        icon: icon,
        backgroundColor: backgroundColor,
        textColor: textColor,
        duration: duration,
        actionLabel: actionLabel,
        isError: isError,
        onAction: onAction != null
            ? () {
                dismiss();
                onAction();
              }
            : null,
        onDismiss: () => dismiss(),
      ),
    );

    _currentEntry = entry;
    overlay.insert(entry);

    _dismissTimer = Timer(duration, () {
      dismiss();
    });
  }

  static void showSuccess(
    BuildContext context,
    String message, {
    Duration duration = WarmPearlMotion.toastAutoDismiss,
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    show(
      context,
      message: message,
      duration: duration,
      actionLabel: actionLabel,
      onAction: onAction,
      isError: false,
    );
  }

  static void showError(
    BuildContext context,
    String message, {
    Duration duration = WarmPearlMotion.toastAutoDismiss,
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    show(
      context,
      message: message,
      duration: duration,
      actionLabel: actionLabel,
      onAction: onAction,
      isError: true,
    );
  }

  static void showInfo(
    BuildContext context,
    String message, {
    Duration duration = WarmPearlMotion.toastAutoDismiss,
    String? actionLabel,
    VoidCallback? onAction,
  }) {
    show(
      context,
      message: message,
      duration: duration,
      actionLabel: actionLabel,
      onAction: onAction,
      isError: false,
    );
  }

  static void dismiss() {
    _dismissTimer?.cancel();
    _dismissTimer = null;
    try {
      _currentEntry?.remove();
    } catch (_) {}
    _currentEntry = null;
  }
}

class _TopToastWidget extends StatefulWidget {
  const _TopToastWidget({
    required this.message,
    this.icon,
    this.backgroundColor,
    this.textColor,
    required this.duration,
    this.actionLabel,
    this.onAction,
    required this.onDismiss,
    required this.isError,
  });

  final String message;
  final Widget? icon;
  final Color? backgroundColor;
  final Color? textColor;
  final Duration duration;
  final String? actionLabel;
  final VoidCallback? onAction;
  final VoidCallback onDismiss;
  final bool isError;

  @override
  State<_TopToastWidget> createState() => _TopToastWidgetState();
}

class _TopToastWidgetState extends State<_TopToastWidget>
    with SingleTickerProviderStateMixin {
  late final AnimationController _animCtrl;
  late final Animation<double> _fadeAnim;
  late final Animation<double> _scaleAnim;
  late final Animation<Offset> _slideAnim;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync: this,
      duration: WarmPearlMotion.toast350,
    );
    _fadeAnim = CurvedAnimation(parent: _animCtrl, curve: Curves.easeOut);
    _scaleAnim = Tween<double>(begin: 0.95, end: 1.0).animate(
      CurvedAnimation(parent: _animCtrl, curve: WarmPearlMotion.spring),
    );
    _slideAnim = Tween<Offset>(
      begin: const Offset(0, -0.5),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(parent: _animCtrl, curve: WarmPearlMotion.spring),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _animCtrl.value = 1.0;
    } else if (_animCtrl.status == AnimationStatus.dismissed) {
      _animCtrl.forward();
    }
  }

  @override
  void dispose() {
    _animCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final mediaQuery = MediaQuery.of(context);
    final topPadding =
        mediaQuery.padding.top > 0 ? mediaQuery.padding.top + 14.0 : 14.0;

    final bool isLegacySolid = widget.backgroundColor != null;
    final Color resolvedTextColor = widget.textColor ??
        (isLegacySolid ? WarmPearlColors.white : WarmPearlColors.inkPrimary);

    final Widget leadingIndicator = widget.icon ??
        Container(
          width: 7,
          height: 7,
          decoration: BoxDecoration(
            color: widget.isError
                ? WarmPearlColors.rose
                : WarmPearlColors.mintBright,
            shape: BoxShape.circle,
            boxShadow: widget.isError
                ? WarmPearlShadows.errorDotRing
                : WarmPearlShadows.liveDotRing,
          ),
        );

    final Widget contentRow = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        leadingIndicator,
        const SizedBox(width: 9),
        Expanded(
          child: Text(
            widget.message,
            style: TextStyle(
              fontFamily: WarmPearlTypography.bodyFont,
              fontFamilyFallback: WarmPearlTypography.fontFallback,
              color: resolvedTextColor,
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              height: 1.35,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        if (widget.actionLabel != null && widget.onAction != null) ...[
          const SizedBox(width: 8),
          GestureDetector(
            onTap: widget.onAction,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 5),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(WarmPearlRadii.pill),
                gradient: WarmPearlGradients.coralButton,
                boxShadow: WarmPearlShadows.coralButton,
              ),
              child: Text(
                widget.actionLabel!,
                style: const TextStyle(
                  fontFamily: WarmPearlTypography.displayFont,
                  fontFamilyFallback: WarmPearlTypography.fontFallback,
                  color: WarmPearlColors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 11.5,
                ),
              ),
            ),
          ),
        ],
      ],
    );

    final Widget capsule = isLegacySolid
        ? Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
            decoration: BoxDecoration(
              color: widget.backgroundColor,
              borderRadius: BorderRadius.circular(WarmPearlRadii.pill),
              boxShadow: WarmPearlShadows.toast,
            ),
            child: contentRow,
          )
        : Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(WarmPearlRadii.pill),
              boxShadow: WarmPearlShadows.toast,
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(WarmPearlRadii.pill),
              child: BackdropFilter(
                filter: ui.ImageFilter.blur(
                  sigmaX: WarmPearlBlurs.toast,
                  sigmaY: WarmPearlBlurs.toast,
                ),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                  decoration: BoxDecoration(
                    color: WarmPearlColors.toastBg,
                    borderRadius: BorderRadius.circular(WarmPearlRadii.pill),
                    border: Border.all(
                      color: WarmPearlColors.white,
                      width: WarmPearlBorders.thin,
                    ),
                  ),
                  child: contentRow,
                ),
              ),
            ),
          );

    return Positioned(
      top: topPadding,
      left: WarmPearlSpacing.viewportH,
      right: WarmPearlSpacing.viewportH,
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 388),
          child: SlideTransition(
            position: _slideAnim,
            child: ScaleTransition(
              scale: _scaleAnim,
              child: FadeTransition(
                opacity: _fadeAnim,
                child: Material(
                  color: Colors.transparent,
                  child: GestureDetector(
                    onTap: widget.onDismiss,
                    child: capsule,
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
