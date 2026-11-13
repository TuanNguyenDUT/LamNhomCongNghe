import 'package:flutter/material.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'screens/deadline_list_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await initializeDateFormatting('vi', null);
  runApp(const DutDeadlineApp());
}

class DutDeadlineApp extends StatelessWidget {
  const DutDeadlineApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'DUT Deadline Manager',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1565C0),
          brightness: Brightness.light,
        ),
        appBarTheme: const AppBarTheme(
          centerTitle: false,
        ),
      ),
      home: const DeadlineListScreen(),
    );
  }
}
