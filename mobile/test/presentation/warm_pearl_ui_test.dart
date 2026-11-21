import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import 'package:dut_student_notifications/core/presentation/empty_glass_card.dart';
import 'package:dut_student_notifications/core/presentation/floating_bottom_dock.dart';
import 'package:dut_student_notifications/features/auth/domain/user_session.dart';
import 'package:dut_student_notifications/features/auth/presentation/auth_controller.dart';
import 'package:dut_student_notifications/features/auth/presentation/login_screen.dart';
import 'package:dut_student_notifications/features/courses/presentation/enrolled_courses_screen.dart';
import 'package:dut_student_notifications/features/deadlines/domain/deadline_item.dart';
import 'package:dut_student_notifications/features/deadlines/presentation/deadlines_screen.dart';
import 'package:dut_student_notifications/features/profile/presentation/profile_screen.dart';
import 'package:dut_student_notifications/features/profile/presentation/widgets/holo_student_pass.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Warm Pearl Liquid Glass UI & GEMINI.md Compliance Tests', () {
    testWidgets('LoginScreen renders empty student code input (no hardcoded MSSV)',
        (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: MaterialApp(
            home: LoginScreen(),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.text('DUT Student Portal'), findsOneWidget);
      expect(find.text('Đăng nhập bằng tài khoản sv.dut.udn.vn'), findsOneWidget);

      // Student code field must NOT have pre-filled '102230026'
      final studentCodeField = find.widgetWithText(
        TextField,
        'Mã số sinh viên (VD: 102230xxx)',
      );
      expect(studentCodeField, findsOneWidget);
      final textFieldWidget = tester.widget<TextField>(studentCodeField);
      expect(textFieldWidget.controller?.text, isEmpty);
      expect(find.text('102230026'), findsNothing);
    });

    testWidgets(
        'FloatingBottomDock renders 4 tabs + detached Spotlight search orb + pending badge',
        (tester) async {
      int selected = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            bottomNavigationBar: FloatingBottomDock(
              selectedIndex: selected,
              pendingCount: 5,
              onTabSelected: (i) => selected = i,
            ),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.text('Bảng tin'), findsOneWidget);
      expect(find.text('Học phần'), findsOneWidget);
      expect(find.text('Hạn & Nhắc'), findsOneWidget);
      expect(find.text('Hồ sơ'), findsOneWidget);
      expect(find.text('5'), findsOneWidget); // Badge
      expect(find.byIcon(Icons.search_rounded), findsOneWidget); // Spotlight orb
    });

    testWidgets(
        'DeadlinesScreen renders 3-segment switcher, NO standalone add button, NO .ics download button',
        (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            deadlinesListProvider.overrideWith((ref) => Future.value(<DeadlineItem>[])),
          ],
          child: const MaterialApp(
            home: Scaffold(body: DeadlinesScreen()),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.text('Hạn & Nhắc việc'), findsOneWidget);
      expect(find.text('Cài đặt lịch'), findsOneWidget);
      expect(find.text('Tất cả'), findsWidgets);
      expect(find.text('Hạn học vụ'), findsOneWidget);
      expect(find.text('Nhắc cá nhân'), findsOneWidget);

      // Strict GEMINI.md check: NO standalone floating add button on deadlines screen
      expect(find.widgetWithIcon(FloatingActionButton, Icons.add), findsNothing);
      expect(find.text('Tải file .ics'), findsNothing);
      expect(find.text('.ics'), findsNothing);
    });

    testWidgets(
        'EnrolledCoursesScreen renders orbital empty state when course list is empty',
        (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            enrolledCoursesProvider.overrideWith((ref) => Future.value([])),
          ],
          child: const MaterialApp(
            home: Scaffold(body: EnrolledCoursesScreen()),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.text('Chưa có dữ liệu học phần'), findsOneWidget);
      expect(find.text('Đồng bộ học phần ngay'), findsOneWidget);
      expect(find.byType(EmptyGlassCard), findsOneWidget);
    });

    testWidgets(
        'ProfileScreen renders 2-segment switcher and HoloStudentPass with session data',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      const mockSession = UserSession(
        studentCode: '102230001',
        fullName: 'Trần Văn Kiểm Thử',
        className: '23T_CLC',
        faculty: 'Khoa Công nghệ Thông tin',
        cohort: 'K2023',
        token: 'mock-token',
        schoolEmail: '102230001@sv1.dut.udn.vn',
        totalCourses: 5,
      );

      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authControllerProvider.overrideWith(
              () => AuthControllerMock(
                const AuthState(session: mockSession),
              ),
            ),
          ],
          child: const MaterialApp(
            home: Scaffold(body: ProfileScreen()),
          ),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 200));

      expect(find.text('Hồ sơ sinh viên'), findsOneWidget);
      expect(find.text('Cài đặt & Đồng bộ'), findsOneWidget);
      expect(find.byType(HoloStudentPass), findsOneWidget);
      expect(find.text('Trần Văn Kiểm Thử'), findsWidgets);
      expect(find.text('MSSV: 102230001'), findsOneWidget);
      expect(find.text('102230001@sv1.dut.udn.vn'), findsOneWidget);
    });
  });
}

class AuthControllerMock extends Notifier<AuthState> implements AuthController {
  AuthControllerMock(this._initial);

  final AuthState _initial;

  @override
  AuthState build() => _initial;

  @override
  Future<void> checkSavedSession() async {}

  @override
  Future<bool> login(String studentCode, String password) async => true;

  @override
  Future<void> logout() async {
    state = const AuthState();
  }
}
