import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/presentation/app_toast.dart';
import '../../../../core/presentation/warm_pearl_tokens.dart';
import '../../../auth/presentation/auth_controller.dart';
import '../../../reminds/presentation/quick_reminder_preferences_provider.dart';

class GCalSettingsCard extends ConsumerStatefulWidget {
  const GCalSettingsCard({super.key, this.highlightPulse = false});

  final bool highlightPulse;

  @override
  ConsumerState<GCalSettingsCard> createState() => _GCalSettingsCardState();
}

class _GCalSettingsCardState extends ConsumerState<GCalSettingsCard>
    with SingleTickerProviderStateMixin {
  bool _isConnected = false;
  String? _googleEmail;
  bool _isLoading = true;
  bool _isSyncing = false;

  AnimationController? _pulseController;
  Animation<double>? _pulseAnimation;

  @override
  void initState() {
    super.initState();
    _checkStatus();
    if (widget.highlightPulse) {
      _pulseController = AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 1400),
      )..forward();
      _pulseAnimation = Tween<double>(begin: 1.0, end: 0.0).animate(
        CurvedAnimation(
          parent: _pulseController!,
          curve: Curves.easeOut,
        ),
      );
    }
  }

  @override
  void dispose() {
    _pulseController?.dispose();
    super.dispose();
  }

  String get _studentCode =>
      ref.read(authControllerProvider).session?.studentCode ?? '';

  Future<void> _checkStatus() async {
    if (_studentCode.isEmpty) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.get(
        '/api/v1/calendar/google/status',
        queryParameters: {'student_id': _studentCode},
      );
      if (mounted) {
        final data = res.data['data'] as Map<String, dynamic>? ?? {};
        setState(() {
          _isConnected = data['is_connected'] == true;
          _googleEmail = data['google_email']?.toString();
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _syncAll() async {
    if (_isSyncing || _studentCode.isEmpty) return;
    setState(() => _isSyncing = true);

    try {
      final dio = ref.read(dioProvider);
      final res = await dio.post(
        '/api/v1/calendar/google/sync',
        data: {'student_id': _studentCode},
      );

      final count = res.data['data']?['synced_count'] ?? 0;
      if (mounted) {
        AppToast.showSuccess(
          context,
          'Đã đồng bộ $count sự kiện lên Google Calendar',
        );
      }
    } catch (err) {
      if (mounted) {
        String msg = 'Tài khoản chưa liên kết Google Calendar';
        if (err is DioException && err.response?.data is Map) {
          final serverMsg = err.response?.data['message']?.toString();
          if (serverMsg != null && serverMsg.isNotEmpty) {
            msg = serverMsg;
          }
        }
        AppToast.showError(context, msg);
      }
    } finally {
      if (mounted) setState(() => _isSyncing = false);
    }
  }

  Future<void> _connectGoogle() async {
    if (_studentCode.isEmpty) return;
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.get(
        '/api/v1/calendar/google/auth-url',
        queryParameters: {'student_id': _studentCode},
      );
      final url = (res.data['data']?['url'] ?? res.data['data']?['auth_url'])?.toString();
      if (url != null && url.isNotEmpty) {
        final uri = Uri.parse(url);
        await launchUrl(uri, webOnlyWindowName: '_self');
      } else {
        if (mounted) {
          AppToast.showError(context, 'Chưa cấu hình tài khoản Google OAuth');
        }
      }
    } catch (_) {
      if (mounted) {
        AppToast.showError(context, 'Không thể lấy URL ủy quyền Google');
      }
    }
  }

  Future<void> _disconnectGoogle() async {
    if (_studentCode.isEmpty) return;
    try {
      final dio = ref.read(dioProvider);
      await dio.post(
        '/api/v1/calendar/google/disconnect',
        data: {'student_id': _studentCode},
      );
      if (mounted) {
        AppToast.showSuccess(context, 'Đã ngắt kết nối Google Calendar');
        await _checkStatus();
      }
    } catch (_) {
      if (mounted) {
        AppToast.showError(context, 'Lỗi ngắt kết nối Google Calendar');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final prefs = ref.watch(quickReminderPreferencesProvider);

    return AnimatedBuilder(
      animation: _pulseAnimation ?? const AlwaysStoppedAnimation(0.0),
      builder: (context, child) {
        final pulseVal = _pulseAnimation?.value ?? 0.0;
        return Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: WarmPearlColors.glassBgStrong,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(
              color: pulseVal > 0
                  ? Color.lerp(
                      WarmPearlColors.glassBorderStrong,
                      WarmPearlColors.mintBright,
                      pulseVal,
                    )!
                  : WarmPearlColors.glassBorderStrong,
              width: pulseVal > 0 ? 1.5 : 1,
            ),
            boxShadow: pulseVal > 0
                ? [
                    BoxShadow(
                      color: WarmPearlColors.mintBorder
                          .withValues(alpha: 0.4 * pulseVal),
                      blurRadius: 20 * pulseVal,
                      spreadRadius: 2 * pulseVal,
                    ),
                    ...WarmPearlShadows.glassSm,
                  ]
                : WarmPearlShadows.glassSm,
          ),
          child: child,
        );
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header: Google Calendar Logo + Title + Status Pill
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x14182036),
                      blurRadius: 8,
                      offset: Offset(0, 2),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.calendar_month_rounded,
                  color: Color(0xFF1A73E8),
                  size: 22,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Google Calendar',
                      style: TextStyle(
                        fontFamily: WarmPearlTypography.displayFont,
                        fontSize: 14.5,
                        fontWeight: FontWeight.w800,
                        color: WarmPearlColors.inkPrimary,
                      ),
                    ),
                    Text(
                      _isConnected
                          ? (_googleEmail ?? 'Đã liên kết tài khoản Google')
                          : 'Đồng bộ tự động hạn chót & nhắc việc',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontFamily: WarmPearlTypography.bodyFont,
                        fontSize: 11.5,
                        color: WarmPearlColors.inkSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              if (!_isLoading) ...[
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 3,
                  ),
                  decoration: BoxDecoration(
                    color: _isConnected
                        ? WarmPearlColors.mintSoft
                        : WarmPearlColors.chipBg,
                    borderRadius: BorderRadius.circular(999),
                    border: Border.all(
                      color: _isConnected
                          ? WarmPearlColors.mintBorder
                          : WarmPearlColors.glassBorder,
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: _isConnected
                              ? WarmPearlColors.mintBright
                              : WarmPearlColors.inkMuted,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        _isConnected ? 'Đã kết nối' : 'Chưa kết nối',
                        style: TextStyle(
                          fontFamily: WarmPearlTypography.displayFont,
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                          color: _isConnected
                              ? WarmPearlColors.mint
                              : WarmPearlColors.inkMuted,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ],
          ),

          const SizedBox(height: 14),

          // Default Sync Switch Row
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.7),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: WarmPearlColors.glassBorder),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      Text(
                        'Mặc định đồng bộ Google Calendar',
                        style: TextStyle(
                          fontFamily: WarmPearlTypography.displayFont,
                          fontSize: 12.5,
                          fontWeight: FontWeight.w700,
                          color: WarmPearlColors.inkPrimary,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Tự động chọn gửi nhắc việc vào Google Calendar',
                        style: TextStyle(
                          fontFamily: WarmPearlTypography.bodyFont,
                          fontSize: 11,
                          color: WarmPearlColors.inkMuted,
                        ),
                      ),
                    ],
                  ),
                ),
                Switch.adaptive(
                  value: prefs.autoSyncGoogleCalendarByDefault,
                  onChanged: (val) {
                    ref
                        .read(quickReminderPreferencesProvider.notifier)
                        .setAutoSync(val);
                  },
                  activeTrackColor: WarmPearlColors.mint,
                ),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Action Buttons: Đồng bộ tất cả / Kết nối / Ngắt kết nối
          Row(
            children: [
              if (_isConnected) ...[
                Expanded(
                  child: GestureDetector(
                    onTap: _isSyncing ? null : _syncAll,
                    child: Container(
                      height: 38,
                      decoration: BoxDecoration(
                        gradient: WarmPearlGradients.coralButton,
                        borderRadius: BorderRadius.circular(999),
                        boxShadow: const [
                          BoxShadow(
                            color: WarmPearlColors.coralGlow,
                            blurRadius: 12,
                            offset: Offset(0, 3),
                          ),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: _isSyncing
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Text(
                              'Đồng bộ tất cả',
                              style: TextStyle(
                                fontFamily: WarmPearlTypography.displayFont,
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                GestureDetector(
                  onTap: _disconnectGoogle,
                  child: Container(
                    height: 38,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: WarmPearlColors.roseSoft,
                      borderRadius: BorderRadius.circular(999),
                      border: Border.all(color: WarmPearlColors.roseBorder),
                    ),
                    alignment: Alignment.center,
                    child: const Text(
                      'Ngắt kết nối',
                      style: TextStyle(
                        fontFamily: WarmPearlTypography.displayFont,
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: WarmPearlColors.rose,
                      ),
                    ),
                  ),
                ),
              ] else ...[
                Expanded(
                  child: GestureDetector(
                    onTap: _connectGoogle,
                    child: Container(
                      height: 38,
                      decoration: BoxDecoration(
                        color: const Color(0xFF1A73E8),
                        borderRadius: BorderRadius.circular(999),
                        boxShadow: const [
                          BoxShadow(
                            color: Color(0x331A73E8),
                            blurRadius: 12,
                            offset: Offset(0, 3),
                          ),
                        ],
                      ),
                      alignment: Alignment.center,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: const [
                          Icon(
                            Icons.login_rounded,
                            size: 16,
                            color: Colors.white,
                          ),
                          SizedBox(width: 6),
                          Text(
                            'Kết nối Google Calendar',
                            style: TextStyle(
                              fontFamily: WarmPearlTypography.displayFont,
                              fontSize: 12.5,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
