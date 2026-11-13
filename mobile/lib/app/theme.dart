import 'package:material_ui/material_ui.dart';

ThemeData buildAppTheme() {
  const seedColor = Color(0xFF1D4ED8);

  return ThemeData(
    colorScheme: ColorScheme.fromSeed(seedColor: seedColor),
    useMaterial3: true,
    scaffoldBackgroundColor: const Color(0xFFF4F6FB),
    cardTheme: const CardThemeData(margin: EdgeInsets.zero, elevation: 0),
    appBarTheme: const AppBarTheme(
      centerTitle: false,
      backgroundColor: Colors.white,
      foregroundColor: Color(0xFF0F172A),
    ),
  );
}
