import 'package:material_ui/material_ui.dart';

import '../core/presentation/warm_pearl_tokens.dart';

class WarmPearlThemeExtension extends ThemeExtension<WarmPearlThemeExtension> {
  const WarmPearlThemeExtension({
    required this.canvasBg,
    required this.stageBg,
    required this.glassBg,
    required this.glassBorder,
    required this.inkPrimary,
    required this.inkSecondary,
    required this.inkMuted,
    required this.coralFrom,
    required this.coralTo,
    required this.coralInk,
    required this.mint,
    required this.mintBright,
    required this.violet,
    required this.rose,
    required this.fbBlue,
    required this.dockBg,
    required this.scrim,
  });

  static const WarmPearlThemeExtension light = WarmPearlThemeExtension(
    canvasBg: WarmPearlColors.canvasBg,
    stageBg: WarmPearlColors.stageBg,
    glassBg: WarmPearlColors.glassBg,
    glassBorder: WarmPearlColors.glassBorder,
    inkPrimary: WarmPearlColors.inkPrimary,
    inkSecondary: WarmPearlColors.inkSecondary,
    inkMuted: WarmPearlColors.inkMuted,
    coralFrom: WarmPearlColors.coralFrom,
    coralTo: WarmPearlColors.coralTo,
    coralInk: WarmPearlColors.coralInk,
    mint: WarmPearlColors.mint,
    mintBright: WarmPearlColors.mintBright,
    violet: WarmPearlColors.violet,
    rose: WarmPearlColors.rose,
    fbBlue: WarmPearlColors.fbBlue,
    dockBg: WarmPearlColors.dockBg,
    scrim: WarmPearlColors.scrim,
  );

  final Color canvasBg;
  final Color stageBg;
  final Color glassBg;
  final Color glassBorder;
  final Color inkPrimary;
  final Color inkSecondary;
  final Color inkMuted;
  final Color coralFrom;
  final Color coralTo;
  final Color coralInk;
  final Color mint;
  final Color mintBright;
  final Color violet;
  final Color rose;
  final Color fbBlue;
  final Color dockBg;
  final Color scrim;

  @override
  WarmPearlThemeExtension copyWith({
    Color? canvasBg,
    Color? stageBg,
    Color? glassBg,
    Color? glassBorder,
    Color? inkPrimary,
    Color? inkSecondary,
    Color? inkMuted,
    Color? coralFrom,
    Color? coralTo,
    Color? coralInk,
    Color? mint,
    Color? mintBright,
    Color? violet,
    Color? rose,
    Color? fbBlue,
    Color? dockBg,
    Color? scrim,
  }) {
    return WarmPearlThemeExtension(
      canvasBg: canvasBg ?? this.canvasBg,
      stageBg: stageBg ?? this.stageBg,
      glassBg: glassBg ?? this.glassBg,
      glassBorder: glassBorder ?? this.glassBorder,
      inkPrimary: inkPrimary ?? this.inkPrimary,
      inkSecondary: inkSecondary ?? this.inkSecondary,
      inkMuted: inkMuted ?? this.inkMuted,
      coralFrom: coralFrom ?? this.coralFrom,
      coralTo: coralTo ?? this.coralTo,
      coralInk: coralInk ?? this.coralInk,
      mint: mint ?? this.mint,
      mintBright: mintBright ?? this.mintBright,
      violet: violet ?? this.violet,
      rose: rose ?? this.rose,
      fbBlue: fbBlue ?? this.fbBlue,
      dockBg: dockBg ?? this.dockBg,
      scrim: scrim ?? this.scrim,
    );
  }

  @override
  WarmPearlThemeExtension lerp(
    covariant ThemeExtension<WarmPearlThemeExtension>? other,
    double t,
  ) {
    if (other is! WarmPearlThemeExtension) {
      return this;
    }
    return WarmPearlThemeExtension(
      canvasBg: Color.lerp(canvasBg, other.canvasBg, t) ?? canvasBg,
      stageBg: Color.lerp(stageBg, other.stageBg, t) ?? stageBg,
      glassBg: Color.lerp(glassBg, other.glassBg, t) ?? glassBg,
      glassBorder: Color.lerp(glassBorder, other.glassBorder, t) ?? glassBorder,
      inkPrimary: Color.lerp(inkPrimary, other.inkPrimary, t) ?? inkPrimary,
      inkSecondary: Color.lerp(inkSecondary, other.inkSecondary, t) ?? inkSecondary,
      inkMuted: Color.lerp(inkMuted, other.inkMuted, t) ?? inkMuted,
      coralFrom: Color.lerp(coralFrom, other.coralFrom, t) ?? coralFrom,
      coralTo: Color.lerp(coralTo, other.coralTo, t) ?? coralTo,
      coralInk: Color.lerp(coralInk, other.coralInk, t) ?? coralInk,
      mint: Color.lerp(mint, other.mint, t) ?? mint,
      mintBright: Color.lerp(mintBright, other.mintBright, t) ?? mintBright,
      violet: Color.lerp(violet, other.violet, t) ?? violet,
      rose: Color.lerp(rose, other.rose, t) ?? rose,
      fbBlue: Color.lerp(fbBlue, other.fbBlue, t) ?? fbBlue,
      dockBg: Color.lerp(dockBg, other.dockBg, t) ?? dockBg,
      scrim: Color.lerp(scrim, other.scrim, t) ?? scrim,
    );
  }
}

ThemeData buildAppTheme() {
  const colorScheme = ColorScheme.light(
    primary: WarmPearlColors.coralFrom,
    onPrimary: WarmPearlColors.white,
    primaryContainer: WarmPearlColors.coralSoft,
    onPrimaryContainer: WarmPearlColors.coralInk,
    secondary: WarmPearlColors.mint,
    onSecondary: WarmPearlColors.white,
    secondaryContainer: WarmPearlColors.mintSoft,
    onSecondaryContainer: WarmPearlColors.mint,
    tertiary: WarmPearlColors.violet,
    onTertiary: WarmPearlColors.white,
    tertiaryContainer: WarmPearlColors.violetSoft,
    onTertiaryContainer: WarmPearlColors.violet,
    error: WarmPearlColors.rose,
    onError: WarmPearlColors.white,
    errorContainer: WarmPearlColors.roseSoft,
    onErrorContainer: WarmPearlColors.rose,
    surface: WarmPearlColors.white,
    surfaceContainerLowest: WarmPearlColors.canvasBg,
    surfaceContainerLow: WarmPearlColors.stageBg,
    onSurface: WarmPearlColors.inkPrimary,
    onSurfaceVariant: WarmPearlColors.inkSecondary,
    outline: WarmPearlColors.inputBorder,
    outlineVariant: WarmPearlColors.glassDivider,
  );

  const textTheme = TextTheme(
    headlineLarge: TextStyle(
      fontFamily: WarmPearlTypography.displayFont,
      fontFamilyFallback: WarmPearlTypography.fontFallback,
      fontSize: 20.0,
      fontWeight: FontWeight.w800,
      letterSpacing: -0.60,
      color: WarmPearlColors.inkPrimary,
    ),
    headlineMedium: TextStyle(
      fontFamily: WarmPearlTypography.displayFont,
      fontFamilyFallback: WarmPearlTypography.fontFallback,
      fontSize: 19.0,
      fontWeight: FontWeight.w800,
      letterSpacing: -0.38,
      color: WarmPearlColors.inkPrimary,
    ),
    headlineSmall: TextStyle(
      fontFamily: WarmPearlTypography.displayFont,
      fontFamilyFallback: WarmPearlTypography.fontFallback,
      fontSize: 17.0,
      fontWeight: FontWeight.w800,
      letterSpacing: -0.34,
      color: WarmPearlColors.inkPrimary,
    ),
    titleLarge: TextStyle(
      fontFamily: WarmPearlTypography.displayFont,
      fontFamilyFallback: WarmPearlTypography.fontFallback,
      fontSize: 15.5,
      fontWeight: FontWeight.w800,
      letterSpacing: -0.22,
      color: WarmPearlColors.inkPrimary,
    ),
    titleMedium: TextStyle(
      fontFamily: WarmPearlTypography.displayFont,
      fontFamilyFallback: WarmPearlTypography.fontFallback,
      fontSize: 14.5,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.20,
      color: WarmPearlColors.inkPrimary,
    ),
    titleSmall: TextStyle(
      fontFamily: WarmPearlTypography.displayFont,
      fontFamilyFallback: WarmPearlTypography.fontFallback,
      fontSize: 13.5,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.15,
      color: WarmPearlColors.inkPrimary,
    ),
    bodyLarge: TextStyle(
      fontFamily: WarmPearlTypography.bodyFont,
      fontFamilyFallback: WarmPearlTypography.fontFallback,
      fontSize: 13.8,
      fontWeight: FontWeight.w400,
      height: 1.65,
      color: WarmPearlColors.inkPrimary,
    ),
    bodyMedium: TextStyle(
      fontFamily: WarmPearlTypography.bodyFont,
      fontFamilyFallback: WarmPearlTypography.fontFallback,
      fontSize: 12.8,
      fontWeight: FontWeight.w400,
      height: 1.52,
      color: WarmPearlColors.inkSecondary,
    ),
    bodySmall: TextStyle(
      fontFamily: WarmPearlTypography.bodyFont,
      fontFamilyFallback: WarmPearlTypography.fontFallback,
      fontSize: 11.8,
      fontWeight: FontWeight.w500,
      height: 1.36,
      color: WarmPearlColors.inkMuted,
    ),
    labelLarge: TextStyle(
      fontFamily: WarmPearlTypography.displayFont,
      fontFamilyFallback: WarmPearlTypography.fontFallback,
      fontSize: 13.5,
      fontWeight: FontWeight.w700,
      letterSpacing: -0.1,
      color: WarmPearlColors.inkPrimary,
    ),
    labelMedium: TextStyle(
      fontFamily: WarmPearlTypography.bodyFont,
      fontFamilyFallback: WarmPearlTypography.fontFallback,
      fontSize: 12.2,
      fontWeight: FontWeight.w700,
      color: WarmPearlColors.inkSecondary,
    ),
    labelSmall: TextStyle(
      fontFamily: WarmPearlTypography.bodyFont,
      fontFamilyFallback: WarmPearlTypography.fontFallback,
      fontSize: 11.0,
      fontWeight: FontWeight.w700,
      letterSpacing: 0.11,
      color: WarmPearlColors.inkMuted,
    ),
  );

  return ThemeData(
    brightness: Brightness.light,
    useMaterial3: true,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: WarmPearlColors.canvasBg,
    fontFamily: WarmPearlTypography.bodyFont,
    fontFamilyFallback: WarmPearlTypography.fontFallback,
    textTheme: textTheme,
    cardTheme: const CardThemeData(
      margin: EdgeInsets.zero,
      elevation: 0,
      color: WarmPearlColors.glassBg,
    ),
    appBarTheme: const AppBarTheme(
      centerTitle: false,
      elevation: 0,
      scrolledUnderElevation: 0,
      backgroundColor: Colors.transparent,
      foregroundColor: WarmPearlColors.inkPrimary,
    ),
    dividerTheme: const DividerThemeData(
      color: WarmPearlColors.glassDivider,
      thickness: 1,
      space: 1,
    ),
    extensions: const [WarmPearlThemeExtension.light],
  );
}
