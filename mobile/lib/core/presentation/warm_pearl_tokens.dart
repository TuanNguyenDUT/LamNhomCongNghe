import 'package:material_ui/material_ui.dart';

/// Tint presets for 2-column course tiles and semantic accents.
enum CourseTint {
  coral,
  mint,
  violet,
  amber,
}

/// Core Warm Pearl Liquid Glass color palette (Light Mode Only).
abstract final class WarmPearlColors {
  // Base & Ink
  static const Color stageBg = Color(0xFFEFECE6);
  static const Color canvasBg = Color(0xFFF6F4EF);
  static const Color inkPrimary = Color(0xFF141926);
  static const Color inkSecondary = Color(0xFF525C70);
  static const Color inkMuted = Color(0xFF7E8799);
  static const Color white = Color(0xFFFFFFFF);
  static const Color shadowInk = Color(0xFF182036);

  // Ambient Orbs
  static const Color orbCoral = Color(0x8FFFC2A6);
  static const Color orbMint = Color(0x85A6F0DC);
  static const Color orbViolet = Color(0x80C9C3FF);

  // Glass Surfaces & Borders
  static const Color glassBg = Color(0x94FFFFFF); // 0.58
  static const Color glassBgStrong = Color(0xC7FFFFFF); // 0.78
  static const Color glassBgSubtle = Color(0x6BFFFFFF); // 0.42
  static const Color glassBorder = Color(0xD9FFFFFF); // 0.85
  static const Color glassBorderStrong = Color(0xEBFFFFFF); // 0.92
  static const Color glassBorderShell = Color(0xF2FFFFFF); // 0.95
  static const Color glassBorderSoft = Color(0x12141926); // 0.07
  static const Color glassDivider = Color(0x12141926); // 0.07

  // Component Surfaces
  static const Color topPillBg = Color(0xADFFFFFF); // 0.68
  static const Color ghostBtnBg = Color(0xA8FFFFFF); // 0.66
  static const Color segSwitcherBg = Color(0xA3FFFFFF); // 0.64
  static const Color filterPillBg = Color(0x9EFFFFFF); // 0.62
  static const Color chipBg = Color(0x8FFFFFFF); // 0.56
  static const Color dockBg = Color(0xB8FFFFFF); // 0.72
  static const Color toastBg = Color(0xE6FFFFFF); // 0.90
  static const Color sheetBg = Color(0xE6FFFFFF); // 0.90
  static const Color spotlightBg = Color(0xD1F6F4EF); // 0.82
  static const Color spotlightInputBg = Color(0xE0FFFFFF); // 0.88
  static const Color inputBg = Color(0xD9F6F4EF); // 0.85
  static const Color inputBorder = Color(0x1A141926); // 0.10
  static const Color scrim = Color(0x47141926); // 0.28
  static const Color trackBg = Color(0x0E141926); // 0.055
  static const Color switchOffTrack = Color(0x24141926); // 0.14
  static const Color sheetHandle = Color(0x29141926); // 0.16

  // Coral (Primary)
  static const Color coralFrom = Color(0xFFFF5A36);
  static const Color coralTo = Color(0xFFFF8A3D);
  static const Color coralInk = Color(0xFFEA4B28);
  static const Color coralSoft = Color(0x1FFF5A36); // 0.12
  static const Color coralBorder = Color(0x4DFF5A36); // 0.30
  static const Color coralGlow = Color(0x4DFF5A36); // 0.30

  // Mint (Success / Live / G-Cal)
  static const Color mint = Color(0xFF0D9F6E);
  static const Color mintBright = Color(0xFF10B981);
  static const Color mintSoft = Color(0x1F10B981); // 0.12
  static const Color mintBorder = Color(0x4D10B981); // 0.30

  // Violet (Academic / High Priority)
  static const Color violet = Color(0xFF6D4AFF);
  static const Color violetTo = Color(0xFF8B5CF6);
  static const Color violetSoft = Color(0x1C6D4AFF); // 0.11
  static const Color violetBorder = Color(0x476D4AFF); // 0.28

  // Rose (Destructive / Error)
  static const Color rose = Color(0xFFE11D48);
  static const Color roseTo = Color(0xFFF43F5E);
  static const Color roseSoft = Color(0x1AE11D48); // 0.10
  static const Color roseBorder = Color(0x42E11D48); // 0.26

  // Amber
  static const Color amber = Color(0xFFF59E0B);
  static const Color amberTint = Color(0x29F59E0B); // 0.16

  // Facebook Fanpage
  static const Color fbBlue = Color(0xFF1877F2);
  static const Color fbSoft = Color(0x1C1877F2); // 0.11
  static const Color fbPillBg = Color(0x171877F2); // 0.09
  static const Color fbPillBorder = Color(0x6B1877F2); // 0.42

  // Dark Slate (Mark-read CTA)
  static const Color slateFrom = Color(0xFF1E293B);
  static const Color slateTo = Color(0xFF334155);

  // Urgent Receipt Card Surfaces
  static const Color urgentCardSurface = Color(0xC7FFF8F5); // 0.78
  static const Color urgentCardBorder = Color(0x57FF5A36); // 0.34
  static const Color urgentCardConfirmedSurface = Color(0xC7F6FFFB); // 0.78
}

/// Gradients & radial tints matching the Warm Pearl Liquid Glass spec.
abstract final class WarmPearlGradients {
  static const LinearGradient specularSheen = LinearGradient(
    begin: Alignment(-0.42, -1.0),
    end: Alignment(0.42, 1.0),
    colors: [Color(0x85FFFFFF), Color(0x00FFFFFF)],
    stops: [0.0, 0.44],
  );

  static const LinearGradient coralButton = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [WarmPearlColors.coralFrom, WarmPearlColors.coralTo],
  );

  static const LinearGradient violetLens = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [WarmPearlColors.violet, WarmPearlColors.violetTo],
  );

  static const LinearGradient roseButton = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [WarmPearlColors.rose, WarmPearlColors.roseTo],
  );

  static const LinearGradient mintSwitch = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [WarmPearlColors.mint, WarmPearlColors.mintBright],
  );

  static const LinearGradient slateMarkRead = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [WarmPearlColors.slateFrom, WarmPearlColors.slateTo],
  );

  static const LinearGradient dockLens = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [Color(0x24FF5A36), Color(0x24FF8A3D)],
  );

  static const RadialGradient urgentRadialOverlay = RadialGradient(
    center: Alignment(0.90, -1.0),
    radius: 1.2,
    colors: [Color(0x33FF5A36), Color(0x00FF5A36)],
    stops: [0.0, 0.60],
  );

  static const RadialGradient urgentConfirmedRadialOverlay = RadialGradient(
    center: Alignment(0.90, -1.0),
    radius: 1.2,
    colors: [Color(0x2910B981), Color(0x0010B981)],
    stops: [0.0, 0.60],
  );

  static RadialGradient courseRadialTint(CourseTint tint) {
    final color = switch (tint) {
      CourseTint.coral => const Color(0x29FF5A36), // 0.16
      CourseTint.mint => const Color(0x2910B981), // 0.16
      CourseTint.violet => const Color(0x266D4AFF), // 0.15
      CourseTint.amber => const Color(0x29F59E0B), // 0.16
    };
    return RadialGradient(
      center: const Alignment(0.92, -0.84),
      radius: 1.24,
      colors: [color, color.withValues(alpha: 0.0)],
      stops: const [0.0, 0.62],
    );
  }

  static const LinearGradient stickyBarFade = LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    colors: [Color(0x00F6F4EF), Color(0xEBF6F4EF), Color(0xFAF6F4EF)],
    stops: [0.0, 0.32, 1.0],
  );
}

/// BackdropFilter Gaussian blur sigmas.
abstract final class WarmPearlBlurs {
  static const double glass = 26.0;
  static const double dock = 30.0;
  static const double sheet = 34.0;
  static const double spotlight = 32.0;
  static const double toast = 28.0;
  static const double iconBtn = 20.0;
  static const double scrim = 8.0;
  static const double orb = 62.0;
}

/// Border widths and pre-built BorderSide / BoxBorder definitions.
abstract final class WarmPearlBorders {
  static const double thin = 1.0;
  static const double shellWidth = 1.5;

  static final Border glass = Border.all(
    color: WarmPearlColors.glassBorder,
    width: thin,
  );

  static final Border glassStrong = Border.all(
    color: WarmPearlColors.glassBorderStrong,
    width: thin,
  );

  static final Border glassSoft = Border.all(
    color: WarmPearlColors.glassBorderSoft,
    width: thin,
  );

  static final Border shell = Border.all(
    color: WarmPearlColors.glassBorderShell,
    width: shellWidth,
  );

  static final Border input = Border.all(
    color: WarmPearlColors.inputBorder,
    width: thin,
  );

  static final Border inputFocused = Border.all(
    color: WarmPearlColors.coralFrom,
    width: thin,
  );

  static final Border inputError = Border.all(
    color: WarmPearlColors.rose,
    width: thin,
  );

  static final Border coral = Border.all(
    color: WarmPearlColors.coralBorder,
    width: thin,
  );

  static final Border mint = Border.all(
    color: WarmPearlColors.mintBorder,
    width: thin,
  );

  static final Border violet = Border.all(
    color: WarmPearlColors.violetBorder,
    width: thin,
  );

  static final Border rose = Border.all(
    color: WarmPearlColors.roseBorder,
    width: thin,
  );

  static final Border urgent = Border.all(
    color: WarmPearlColors.urgentCardBorder,
    width: thin,
  );

  static final Border fbPill = Border.all(
    color: WarmPearlColors.fbPillBorder,
    width: thin,
  );
}

/// Elevation shadows matching Warm Pearl spec CSS variables.
abstract final class WarmPearlShadows {
  static const List<BoxShadow> glass = [
    BoxShadow(
      color: Color(0x0F182036),
      blurRadius: 30,
      offset: Offset(0, 10),
    ),
  ];

  static const List<BoxShadow> glassSm = [
    BoxShadow(
      color: Color(0x0F182036),
      blurRadius: 18,
      offset: Offset(0, 6),
    ),
  ];

  static const List<BoxShadow> dock = [
    BoxShadow(
      color: Color(0x1F182036),
      blurRadius: 40,
      offset: Offset(0, 16),
    ),
  ];

  static const List<BoxShadow> toast = [
    BoxShadow(
      color: Color(0x29182036),
      blurRadius: 40,
      offset: Offset(0, 16),
    ),
  ];

  static const List<BoxShadow> sheet = [
    BoxShadow(
      color: Color(0x29182036),
      blurRadius: 48,
      offset: Offset(0, -18),
    ),
  ];

  static const List<BoxShadow> appShell = [
    BoxShadow(
      color: Color(0x29182036),
      blurRadius: 72,
      spreadRadius: -18,
      offset: Offset(0, 28),
    ),
    BoxShadow(
      color: Color(0x0D182036),
      blurRadius: 16,
      offset: Offset(0, 4),
    ),
  ];

  static const List<BoxShadow> coralButton = [
    BoxShadow(
      color: Color(0x4DFF5A36),
      blurRadius: 24,
      spreadRadius: -6,
      offset: Offset(0, 10),
    ),
  ];

  static const List<BoxShadow> violetLens = [
    BoxShadow(
      color: Color(0x526D4AFF),
      blurRadius: 16,
      spreadRadius: -4,
      offset: Offset(0, 6),
    ),
  ];

  static const List<BoxShadow> roseButton = [
    BoxShadow(
      color: Color(0x47E11D48),
      blurRadius: 22,
      offset: Offset(0, 10),
    ),
  ];

  static const List<BoxShadow> dockLens = [
    BoxShadow(
      color: Color(0x24FF5A36),
      blurRadius: 12,
      offset: Offset(0, 4),
    ),
  ];

  static const List<BoxShadow> inputFocusRing = [
    BoxShadow(
      color: Color(0x1FFF5A36),
      blurRadius: 0,
      spreadRadius: 3,
    ),
  ];

  static const List<BoxShadow> liveDotRing = [
    BoxShadow(
      color: Color(0x3310B981),
      blurRadius: 0,
      spreadRadius: 3,
    ),
  ];

  static const List<BoxShadow> errorDotRing = [
    BoxShadow(
      color: Color(0x33E11D48),
      blurRadius: 0,
      spreadRadius: 3,
    ),
  ];

  static const List<BoxShadow> unreadDotRing = [
    BoxShadow(
      color: Color(0x1FFF5A36),
      blurRadius: 0,
      spreadRadius: 3,
    ),
  ];

  static const List<BoxShadow> switchThumb = [
    BoxShadow(
      color: Color(0x33141926),
      blurRadius: 6,
      offset: Offset(0, 2),
    ),
  ];

  static const List<BoxShadow> mintSwitch = [
    BoxShadow(
      color: Color(0x4710B981),
      blurRadius: 12,
      offset: Offset(0, 4),
    ),
  ];

  static const List<BoxShadow> coralSwitch = [
    BoxShadow(
      color: Color(0x4DFF5A36),
      blurRadius: 12,
      offset: Offset(0, 4),
    ),
  ];
}

/// Border radii constants.
abstract final class WarmPearlRadii {
  static const double appShellDesktop = 44.0;
  static const double appShellMobileTop = 30.0;
  static const double sheetTop = 32.0;
  static const double emptyGlass = 28.0;
  static const double holoCard = 28.0;
  static const double urgentCard = 26.0;
  static const double glassCard = 24.0;
  static const double courseTile = 24.0;
  static const double taskCard = 22.0;
  static const double utilityRow = 22.0;
  static const double pulseTile = 20.0;
  static const double subbox = 18.0;
  static const double attachRow = 18.0;
  static const double spotlightResult = 18.0;
  static const double inputBox = 16.0;
  static const double fanpageBox = 14.0;
  static const double rowIcon = 12.0;
  static const double smallIcon = 10.0;
  static const double emptyIcon = 18.0;
  static const double pill = 999.0;
}

/// Layout spacing & viewport padding constants.
abstract final class WarmPearlSpacing {
  static const double viewportH = 14.0;
  static const double viewportTop = 6.0;
  static const double viewportBottomDock = 134.0;
  static const double detailBottom = 104.0;
  static const double sectionGap = 13.0;
  static const double feedGap = 12.0;
  static const double taskGap = 10.0;
  static const double courseGap = 10.0;
  static const double pulseGap = 9.0;
  static const double chipGap = 7.0;
  static const double chipGapSmall = 6.0;
}

/// Fixed component dimensions.
abstract final class WarmPearlSizes {
  static const double markReadHeight = 48.0;
  static const double inputHeight = 46.0;
  static const double spotlightInputHeight = 48.0;
  static const double coralBtnHeight = 44.0;
  static const double sheetCtaHeight = 46.0;
  static const double receiptBtnHeight = 42.0;
  static const double ghostBtnHeight = 38.0;
  static const double iconBtn = 36.0;
  static const double detailIconBtn = 40.0;
  static const double spotlightCloseBtn = 44.0;
  static const double deleteBtn = 30.0;
  static const double remindBtnHeight = 36.0;
  static const double presetChipHeight = 35.0;
  static const double filterPillHeight = 34.0;
  static const double segTabHeight = 34.0;
  static const double hashtagHeight = 32.0;
  static const double catChipHeight = 30.0;
  static const double dockItemHeight = 50.0;
  static const double spotlightOrb = 62.0;
  static const double switchW = 48.0;
  static const double switchH = 28.0;
  static const double switchThumb = 22.0;
  static const double checkCircle = 24.0;
  static const double avatarTopBar = 36.0;
  static const double avatarHolo = 66.0;
}

/// Typography font families, fallbacks & text scale helpers.
abstract final class WarmPearlTypography {
  static const String displayFont = 'PlusJakartaSans';
  static const String bodyFont = 'Inter';
  static const List<String> fontFallback = [
    '-apple-system',
    'BlinkMacSystemFont',
    'SF Pro Display',
    'sans-serif',
  ];

  static TextStyle display({
    double fontSize = 19,
    FontWeight fontWeight = FontWeight.w800,
    Color color = WarmPearlColors.inkPrimary,
    double? height,
    double? letterSpacing,
  }) {
    return TextStyle(
      fontFamily: displayFont,
      fontFamilyFallback: fontFallback,
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
    );
  }

  static TextStyle body({
    double fontSize = 13.8,
    FontWeight fontWeight = FontWeight.w400,
    Color color = WarmPearlColors.inkSecondary,
    double? height,
    double? letterSpacing,
  }) {
    return TextStyle(
      fontFamily: bodyFont,
      fontFamilyFallback: fontFallback,
      fontSize: fontSize,
      fontWeight: fontWeight,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
    );
  }
}

/// Motion curves, durations, and pressable scales.
abstract final class WarmPearlMotion {
  static const Curve spring = Cubic(0.34, 1.56, 0.64, 1.0);
  static const Curve smooth = Cubic(0.22, 1.0, 0.36, 1.0);

  static const Duration fast200 = Duration(milliseconds: 200);
  static const Duration press250 = Duration(milliseconds: 250);
  static const Duration sheetFade280 = Duration(milliseconds: 280);
  static const Duration switchTrack280 = Duration(milliseconds: 280);
  static const Duration drawer300 = Duration(milliseconds: 300);
  static const Duration switchThumb320 = Duration(milliseconds: 320);
  static const Duration spotlight340 = Duration(milliseconds: 340);
  static const Duration toast350 = Duration(milliseconds: 350);
  static const Duration screen360 = Duration(milliseconds: 360);
  static const Duration segLens360 = Duration(milliseconds: 360);
  static const Duration slide380 = Duration(milliseconds: 380);
  static const Duration dockLens400 = Duration(milliseconds: 400);
  static const Duration syncSpin720 = Duration(milliseconds: 720);
  static const Duration highlightPulse1400 = Duration(milliseconds: 1400);
  static const Duration toastAutoDismiss = Duration(milliseconds: 3200);

  static const Duration orb1 = Duration(seconds: 22);
  static const Duration orb2 = Duration(seconds: 26);
  static const Duration orb3 = Duration(seconds: 24);
  static const Duration orbitOuter = Duration(seconds: 18);
  static const Duration orbitInner = Duration(seconds: 12);

  static const double pressCard = 0.975;
  static const double pressCoralBtn = 0.96;
  static const double pressGhostBtn = 0.95;
  static const double pressChip = 0.94;
  static const double pressDockItem = 0.92;
  static const double pressSpotlightOrb = 0.90;
  static const double pressIconBtn = 0.89;
}
