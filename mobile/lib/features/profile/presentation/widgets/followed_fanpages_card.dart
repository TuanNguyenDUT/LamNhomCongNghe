import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/presentation/app_toast.dart';
import '../../../../core/presentation/warm_pearl_tokens.dart';
import '../../../auth/presentation/auth_controller.dart';
import '../../../notifications/presentation/follow_fanpage_sheet.dart';

class FollowedFanpagesCard extends ConsumerStatefulWidget {
  const FollowedFanpagesCard({super.key});

  @override
  ConsumerState<FollowedFanpagesCard> createState() =>
      _FollowedFanpagesCardState();
}

class _FollowedFanpagesCardState extends ConsumerState<FollowedFanpagesCard> {
  List<Map<String, dynamic>> _customPages = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _fetchPages();
  }

  String get _studentCode =>
      ref.read(authControllerProvider).session?.studentCode ?? '';

  Future<void> _fetchPages() async {
    if (_studentCode.isEmpty) {
      if (mounted) setState(() => _isLoading = false);
      return;
    }
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.get(
        '/api/v1/facebook/followed',
        queryParameters: {'student_id': _studentCode},
      );
      if (mounted) {
        final list = res.data['data'] as List<dynamic>? ?? [];
        setState(() {
          _customPages = list
              .map((e) => Map<String, dynamic>.from(e as Map))
              .where((p) {
            final url = (p['page_url'] ?? '').toString();
            return !url.contains('ctsvdhbkdhdn') &&
                !url.contains('tuvansinhvien.dut');
          }).toList();
          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _unfollow(String id, String name) async {
    try {
      final dio = ref.read(dioProvider);
      await dio.delete(
        '/api/v1/facebook/unfollow/$id',
        data: {'student_id': _studentCode},
      );
      if (mounted) {
        AppToast.showSuccess(context, 'Đã hủy theo dõi $name');
        await _fetchPages();
      }
    } catch (_) {
      if (mounted) {
        AppToast.showError(context, 'Lỗi hủy theo dõi Fanpage');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: WarmPearlColors.glassBgStrong,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: WarmPearlColors.glassBorderStrong,
          width: 1,
        ),
        boxShadow: WarmPearlShadows.glassSm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: WarmPearlColors.fbSoft,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(
                  Icons.facebook_rounded,
                  color: WarmPearlColors.fbBlue,
                  size: 22,
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: const [
                    Text(
                      'Fanpage Facebook theo dõi',
                      style: TextStyle(
                        fontFamily: WarmPearlTypography.displayFont,
                        fontSize: 14.5,
                        fontWeight: FontWeight.w800,
                        color: WarmPearlColors.inkPrimary,
                      ),
                    ),
                    Text(
                      'Tự động thu thập bài đăng và thông báo',
                      style: TextStyle(
                        fontFamily: WarmPearlTypography.bodyFont,
                        fontSize: 11.5,
                        color: WarmPearlColors.inkSecondary,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 14),

          // Default Built-in Fanpages
          _buildFanpageItem(
            name: 'Phòng Công tác Sinh viên (CTSV)',
            url: 'https://www.facebook.com/ctsvdhbkdhdn',
            isDefault: true,
          ),
          const SizedBox(height: 6),
          _buildFanpageItem(
            name: 'Tổ Tư vấn - Hỗ trợ Sinh viên',
            url: 'https://www.facebook.com/tuvansinhvien.dut',
            isDefault: true,
          ),

          // Custom Fanpages
          if (_isLoading) ...[
            const Padding(
              padding: EdgeInsets.all(12),
              child: Center(
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          ] else ...[
            ..._customPages.map((page) {
              final id = page['id']?.toString() ?? '';
              final name = page['page_name']?.toString() ??
                  page['page_url']?.toString() ??
                  'Fanpage';
              final url = page['page_url']?.toString() ?? '';

              return Padding(
                padding: const EdgeInsets.only(top: 6),
                child: _buildFanpageItem(
                  name: name,
                  url: url,
                  isDefault: false,
                  onDelete: () => _unfollow(id, name),
                ),
              );
            }),
          ],

          const SizedBox(height: 12),

          // Add Fanpage Button
          GestureDetector(
            onTap: () async {
              await showFollowFanpageSheet(context);
              await _fetchPages();
            },
            child: Container(
              height: 38,
              decoration: BoxDecoration(
                color: WarmPearlColors.fbPillBg,
                borderRadius: BorderRadius.circular(999),
                border: Border.all(color: WarmPearlColors.fbPillBorder),
              ),
              alignment: Alignment.center,
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: const [
                  Icon(
                    Icons.add_rounded,
                    size: 16,
                    color: WarmPearlColors.fbBlue,
                  ),
                  SizedBox(width: 6),
                  Text(
                    'Thêm link Fanpage theo dõi',
                    style: TextStyle(
                      fontFamily: WarmPearlTypography.displayFont,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w700,
                      color: WarmPearlColors.fbBlue,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFanpageItem({
    required String name,
    required String url,
    required bool isDefault,
    VoidCallback? onDelete,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: WarmPearlColors.glassBorder),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.facebook_rounded,
            size: 18,
            color: WarmPearlColors.fbBlue,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontFamily: WarmPearlTypography.displayFont,
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: WarmPearlColors.inkPrimary,
                  ),
                ),
                Text(
                  url,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontFamily: WarmPearlTypography.bodyFont,
                    fontSize: 10,
                    color: WarmPearlColors.inkMuted,
                  ),
                ),
              ],
            ),
          ),
          if (isDefault)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: WarmPearlColors.mintSoft,
                borderRadius: BorderRadius.circular(6),
              ),
              child: const Text(
                'Mặc định',
                style: TextStyle(
                  fontFamily: WarmPearlTypography.displayFont,
                  fontSize: 9.5,
                  fontWeight: FontWeight.w700,
                  color: WarmPearlColors.mint,
                ),
              ),
            )
          else if (onDelete != null)
            IconButton(
              icon: const Icon(
                Icons.close_rounded,
                size: 16,
                color: WarmPearlColors.rose,
              ),
              onPressed: onDelete,
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
        ],
      ),
    );
  }
}
