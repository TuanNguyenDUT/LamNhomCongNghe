import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/network/api_client.dart';
import '../../../core/presentation/app_toast.dart';
import '../../../core/presentation/warm_pearl_tokens.dart';
import '../../auth/presentation/auth_controller.dart';

/// Shows the Warm Pearl Liquid Glass Follow Fanpage Bottom Sheet.
Future<void> showFollowFanpageSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (context) => Align(
      alignment: Alignment.bottomCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 720),
        child: const FollowFanpageSheet(),
      ),
    ),
  );
}

class FollowFanpageSheet extends ConsumerStatefulWidget {
  const FollowFanpageSheet({super.key});

  @override
  ConsumerState<FollowFanpageSheet> createState() => _FollowFanpageSheetState();
}

class _FollowFanpageSheetState extends ConsumerState<FollowFanpageSheet> {
  final _urlController = TextEditingController();
  final _nameController = TextEditingController();
  bool _isLoading = false;
  String? _errorMessage;

  List<Map<String, dynamic>> _followedPages = [];
  bool _isLoadingList = true;

  @override
  void initState() {
    super.initState();
    _fetchFollowedPages();
  }

  @override
  void dispose() {
    _urlController.dispose();
    _nameController.dispose();
    super.dispose();
  }

  String get _studentCode =>
      ref.read(authControllerProvider).session?.studentCode ?? '';

  Future<void> _fetchFollowedPages() async {
    if (_studentCode.isEmpty) return;
    try {
      final dio = ref.read(dioProvider);
      final res = await dio.get(
        '/api/v1/facebook/followed',
        queryParameters: {'student_id': _studentCode},
      );
      if (mounted) {
        final list = res.data['data'] as List<dynamic>? ?? [];
        setState(() {
          _followedPages = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
          _isLoadingList = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoadingList = false);
      }
    }
  }

  Future<void> _handleFollow() async {
    final url = _urlController.text.trim();
    final name = _nameController.text.trim();

    if (url.isEmpty) {
      setState(() => _errorMessage = 'Vui lòng nhập đường link Fanpage Facebook');
      return;
    }

    if (!url.contains('facebook.com') && !url.contains('fb.com')) {
      setState(() => _errorMessage = 'Đường link phải thuộc tên miền facebook.com hoặc fb.com');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final dio = ref.read(dioProvider);
      await dio.post(
        '/api/v1/facebook/follow',
        data: {
          'student_id': _studentCode,
          'page_url': url,
          if (name.isNotEmpty) 'page_name': name,
        },
      );

      _urlController.clear();
      _nameController.clear();

      if (mounted) {
        AppToast.showSuccess(context, 'Đã theo dõi Fanpage thành công!');
        await _fetchFollowedPages();
      }
    } catch (e) {
      if (mounted) {
        String errMsg = 'Không thể theo dõi Fanpage. Vui lòng kiểm tra lại đường link.';
        if (e is DioException && e.response?.data is Map) {
          final serverMsg = e.response?.data['message']?.toString();
          if (serverMsg != null && serverMsg.isNotEmpty) {
            errMsg = serverMsg;
          }
        }
        setState(() {
          _errorMessage = errMsg;
        });
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _handleUnfollow(String pageId, String pageName) async {
    try {
      final dio = ref.read(dioProvider);
      await dio.delete(
        '/api/v1/facebook/unfollow/$pageId',
        data: {'student_id': _studentCode},
      );

      if (mounted) {
        AppToast.showSuccess(context, 'Đã hủy theo dõi $pageName');
        await _fetchFollowedPages();
      }
    } catch (_) {
      if (mounted) {
        AppToast.showError(context, 'Lỗi khi hủy theo dõi Fanpage');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.86,
      ),
      padding: EdgeInsets.fromLTRB(16, 12, 16, 26 + bottomInset),
      decoration: const BoxDecoration(
        color: WarmPearlColors.sheetBg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
        border: Border(
          top: BorderSide(color: WarmPearlColors.white, width: 1.5),
        ),
        boxShadow: [
          BoxShadow(
            color: Color(0x29182036),
            blurRadius: 48,
            offset: Offset(0, -18),
          ),
        ],
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Sheet Handle
            Center(
              child: Container(
                width: 40,
                height: 4.5,
                decoration: BoxDecoration(
                  color: WarmPearlColors.sheetHandle,
                  borderRadius: BorderRadius.circular(999),
                ),
              ),
            ),
            const SizedBox(height: 14),

            // Header
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
                        'Theo dõi Fanpage Facebook',
                        style: TextStyle(
                          fontFamily: WarmPearlTypography.displayFont,
                          fontSize: 16.5,
                          fontWeight: FontWeight.w800,
                          color: WarmPearlColors.inkPrimary,
                        ),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Tự động cào và thông báo tin mới từ Fanpage',
                        style: TextStyle(
                          fontFamily: WarmPearlTypography.bodyFont,
                          fontSize: 11.8,
                          color: WarmPearlColors.inkSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // URL input
            Container(
              height: 46,
              padding: const EdgeInsets.symmetric(horizontal: 13),
              decoration: BoxDecoration(
                color: WarmPearlColors.inputBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: _errorMessage != null
                      ? WarmPearlColors.rose
                      : WarmPearlColors.inputBorder,
                  width: 1,
                ),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.link_rounded,
                    size: 18,
                    color: WarmPearlColors.fbBlue,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _urlController,
                      style: const TextStyle(
                        fontFamily: WarmPearlTypography.bodyFont,
                        fontSize: 13.5,
                        color: WarmPearlColors.inkPrimary,
                      ),
                      decoration: const InputDecoration(
                        hintText: 'https://www.facebook.com/tenfanpage',
                        hintStyle: TextStyle(
                          color: WarmPearlColors.inkMuted,
                          fontSize: 13,
                        ),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            if (_errorMessage != null) ...[
              const SizedBox(height: 6),
              Text(
                _errorMessage!,
                style: const TextStyle(
                  fontFamily: WarmPearlTypography.bodyFont,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: WarmPearlColors.rose,
                ),
              ),
            ],

            const SizedBox(height: 10),

            // Optional Page Name input
            Container(
              height: 46,
              padding: const EdgeInsets.symmetric(horizontal: 13),
              decoration: BoxDecoration(
                color: WarmPearlColors.inputBg,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: WarmPearlColors.inputBorder, width: 1),
              ),
              child: Row(
                children: [
                  const Icon(
                    Icons.edit_note_rounded,
                    size: 18,
                    color: WarmPearlColors.inkMuted,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextField(
                      controller: _nameController,
                      style: const TextStyle(
                        fontFamily: WarmPearlTypography.bodyFont,
                        fontSize: 13.5,
                        color: WarmPearlColors.inkPrimary,
                      ),
                      decoration: const InputDecoration(
                        hintText: 'Tên gợi nhớ (không bắt buộc)',
                        hintStyle: TextStyle(
                          color: WarmPearlColors.inkMuted,
                          fontSize: 13,
                        ),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // Submit Button
            GestureDetector(
              onTap: _isLoading ? null : _handleFollow,
              child: Container(
                height: 44,
                decoration: BoxDecoration(
                  gradient: WarmPearlGradients.coralButton,
                  borderRadius: BorderRadius.circular(999),
                  boxShadow: const [
                    BoxShadow(
                      color: WarmPearlColors.coralGlow,
                      blurRadius: 18,
                      offset: Offset(0, 6),
                    ),
                  ],
                ),
                alignment: Alignment.center,
                child: _isLoading
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2.2,
                          color: Colors.white,
                        ),
                      )
                    : const Text(
                        'Bắt đầu theo dõi',
                        style: TextStyle(
                          fontFamily: WarmPearlTypography.displayFont,
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
              ),
            ),

            const SizedBox(height: 22),

            // Followed Pages List Header
            const Text(
              'Fanpage đang theo dõi',
              style: TextStyle(
                fontFamily: WarmPearlTypography.displayFont,
                fontSize: 13.5,
                fontWeight: FontWeight.w800,
                color: WarmPearlColors.inkPrimary,
              ),
            ),
            const SizedBox(height: 8),

            if (_isLoadingList)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(16.0),
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              )
            else if (_followedPages.isEmpty)
              Container(
                padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.6),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: WarmPearlColors.glassBorder),
                ),
                child: const Text(
                  'Bạn chưa theo dõi thêm Fanpage nào khác ngoài 2 Fanpage mặc định của trường (CTSV & Tư vấn SV).',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontFamily: WarmPearlTypography.bodyFont,
                    fontSize: 12,
                    color: WarmPearlColors.inkSecondary,
                  ),
                ),
              )
            else
              ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _followedPages.length,
                separatorBuilder: (context, index) => const SizedBox(height: 6),
                itemBuilder: (context, index) {
                  final p = _followedPages[index];
                  final id = p['id']?.toString() ?? '';
                  final name = p['page_name']?.toString() ?? p['page_url']?.toString() ?? 'Fanpage';
                  final url = p['page_url']?.toString() ?? '';

                  return Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.75),
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
                        const SizedBox(width: 10),
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
                                  fontSize: 12.5,
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
                                  fontSize: 10.5,
                                  color: WarmPearlColors.inkMuted,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          icon: const Icon(
                            Icons.close_rounded,
                            size: 18,
                            color: WarmPearlColors.rose,
                          ),
                          onPressed: () => _handleUnfollow(id, name),
                          tooltip: 'Hủy theo dõi',
                        ),
                      ],
                    ),
                  );
                },
              ),
          ],
        ),
      ),
    );
  }
}
