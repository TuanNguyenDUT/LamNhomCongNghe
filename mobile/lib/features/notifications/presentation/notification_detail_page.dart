import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/presentation/ambient_background.dart';
import '../../../core/presentation/app_toast.dart';
import '../../../core/presentation/spotlight_search_overlay.dart';
import '../../../core/presentation/warm_pearl_tokens.dart';
import '../../auth/presentation/auth_controller.dart';
import '../../reminds/presentation/add_reminder_modal.dart';
import '../domain/notification_item.dart';
import 'notification_providers.dart';

class NotificationDetailPage extends ConsumerStatefulWidget {
  const NotificationDetailPage({required this.notificationId, super.key});

  final dynamic notificationId;

  @override
  ConsumerState<NotificationDetailPage> createState() =>
      _NotificationDetailPageState();
}

class _NotificationDetailPageState
    extends ConsumerState<NotificationDetailPage> {
  bool _isTogglingRead = false;

  void _handleBack(BuildContext context) {
    if (context.canPop()) {
      context.pop();
    } else {
      context.go('/notifications');
    }
  }

  Future<void> _openUrl(String urlString) async {
    final uri = Uri.tryParse(urlString);
    if (uri != null && await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      if (mounted) {
        AppToast.showError(context, 'Không thể mở liên kết');
      }
    }
  }

  Future<void> _copyUrl(String urlString) async {
    await Clipboard.setData(ClipboardData(text: urlString));
    if (mounted) {
      AppToast.showSuccess(context, 'Đã sao chép liên kết bài viết');
    }
  }

  Future<void> _toggleRead(NotificationItem item) async {
    if (_isTogglingRead) return;
    setState(() => _isTogglingRead = true);

    final session = ref.read(authControllerProvider).session;
    final studentId = session?.studentCode ?? '';

    try {
      final newReadStatus = !item.isRead;
      await ref.read(notificationRepositoryProvider).setReadStatus(
            item.id,
            isRead: newReadStatus,
            studentId: studentId,
          );

      ref.invalidate(notificationDetailProvider(widget.notificationId));
      ref.invalidate(notificationFeedProvider);

      if (mounted) {
        AppToast.showSuccess(
          context,
          newReadStatus ? 'Đã đánh dấu là ĐÃ ĐỌC' : 'Đã đánh dấu là CHƯA ĐỌC',
        );
      }
    } catch (_) {
      if (mounted) {
        AppToast.showError(context, 'Lỗi cập nhật trạng thái đã đọc');
      }
    } finally {
      if (mounted) {
        setState(() => _isTogglingRead = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final detailAsync =
        ref.watch(notificationDetailProvider(widget.notificationId));
    final session = ref.watch(authControllerProvider).session;

    return WarmPearlAmbientBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 720),
              child: detailAsync.when(
            loading: () => const Center(
              child: CircularProgressIndicator(color: WarmPearlColors.coralFrom),
            ),
            error: (err, stack) => Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'Không thể tải chi tiết thông báo',
                    style: TextStyle(
                      fontFamily: WarmPearlTypography.displayFont,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: WarmPearlColors.inkPrimary,
                    ),
                  ),
                  const SizedBox(height: 12),
                  GestureDetector(
                    onTap: () => _handleBack(context),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 8,
                      ),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(color: WarmPearlColors.glassBorder),
                      ),
                      child: const Text('Quay lại'),
                    ),
                  ),
                ],
              ),
            ),
            data: (item) {
              final isFb = item.sourceChannel == 'FB_CTSV' ||
                  item.sourceChannel == 'FB_TUVAN_SV' ||
                  (item.sourceUrl != null &&
                      item.sourceUrl!.contains('facebook.com'));

              final realUrl = item.sourceUrl?.trim().isNotEmpty == true
                  ? item.sourceUrl!.trim()
                  : (item.sourceChannel == 'FB_TUVAN_SV'
                      ? 'https://www.facebook.com/tuvansinhvien.dut'
                      : (item.sourceChannel == 'FB_CTSV'
                          ? 'https://www.facebook.com/ctsvdhbkdhdn'
                          : 'https://sv.dut.udn.vn'));

              return Stack(
                children: [
                  // Scrollable Body
                  ListView(
                    padding: const EdgeInsets.fromLTRB(16, 68, 16, 96),
                    physics: const BouncingScrollPhysics(),
                    children: [
                      // Meta Badges Row
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: isFb
                                  ? WarmPearlColors.fbSoft
                                  : WarmPearlColors.coralSoft,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              item.sourceTitle,
                              style: TextStyle(
                                fontFamily: WarmPearlTypography.displayFont,
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: isFb
                                    ? WarmPearlColors.fbBlue
                                    : WarmPearlColors.coralInk,
                              ),
                            ),
                          ),
                          if (item.courseCode != null &&
                              item.courseCode!.isNotEmpty) ...[
                            const SizedBox(width: 6),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                color: WarmPearlColors.violetSoft,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                item.courseCode!,
                                style: const TextStyle(
                                  fontFamily: WarmPearlTypography.displayFont,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: WarmPearlColors.violet,
                                ),
                              ),
                            ),
                          ],
                          const Spacer(),
                          Text(
                            item.formattedPublishedAt,
                            style: const TextStyle(
                              fontFamily: WarmPearlTypography.bodyFont,
                              fontSize: 11,
                              color: WarmPearlColors.inkMuted,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),

                      // Title
                      Text(
                        item.title,
                        style: const TextStyle(
                          fontFamily: WarmPearlTypography.displayFont,
                          fontSize: 19,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.4,
                          color: WarmPearlColors.inkPrimary,
                          height: 1.3,
                        ),
                      ),
                      const SizedBox(height: 16),

                      // 3-Button Action Bar
                      Row(
                        children: [
                          // Thêm nhắc nhở
                          Expanded(
                            flex: 3,
                            child: GestureDetector(
                              onTap: () => showAddReminderModal(
                                context,
                                ref,
                                item,
                                session,
                              ),
                              child: Container(
                                height: 40,
                                decoration: BoxDecoration(
                                  gradient: WarmPearlGradients.coralButton,
                                  borderRadius: BorderRadius.circular(999),
                                  boxShadow: const [
                                    BoxShadow(
                                      color: WarmPearlColors.coralGlow,
                                      blurRadius: 14,
                                      offset: Offset(0, 4),
                                    ),
                                  ],
                                ),
                                alignment: Alignment.center,
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: const [
                                    Icon(
                                      Icons.alarm_add_rounded,
                                      size: 16,
                                      color: Colors.white,
                                    ),
                                    SizedBox(width: 6),
                                    Text(
                                      'Thêm nhắc nhở',
                                      style: TextStyle(
                                        fontFamily:
                                            WarmPearlTypography.displayFont,
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
                          const SizedBox(width: 8),

                          // Mở bài viết
                          Expanded(
                            flex: 3,
                            child: GestureDetector(
                              onTap: () => _openUrl(realUrl),
                              child: Container(
                                height: 40,
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.75),
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(
                                    color: WarmPearlColors.glassBorderStrong,
                                  ),
                                  boxShadow: WarmPearlShadows.glassSm,
                                ),
                                alignment: Alignment.center,
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      isFb
                                          ? Icons.facebook_rounded
                                          : Icons.open_in_new_rounded,
                                      size: 16,
                                      color: isFb
                                          ? WarmPearlColors.fbBlue
                                          : WarmPearlColors.inkPrimary,
                                    ),
                                    const SizedBox(width: 6),
                                    Text(
                                      isFb ? 'Xem Facebook' : 'Mở bài viết',
                                      style: TextStyle(
                                        fontFamily:
                                            WarmPearlTypography.displayFont,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: isFb
                                            ? WarmPearlColors.fbBlue
                                            : WarmPearlColors.inkPrimary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),

                          // Copy Link Icon Button
                          GestureDetector(
                            onTap: () => _copyUrl(realUrl),
                            child: Container(
                              width: 40,
                              height: 40,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: Colors.white.withValues(alpha: 0.75),
                                border: Border.all(
                                  color: WarmPearlColors.glassBorderStrong,
                                ),
                                boxShadow: WarmPearlShadows.glassSm,
                              ),
                              alignment: Alignment.center,
                              child: const Icon(
                                Icons.copy_rounded,
                                size: 16,
                                color: WarmPearlColors.inkPrimary,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 18),

                      // Content Box
                      Container(
                        padding: const EdgeInsets.all(18),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.8),
                          borderRadius: BorderRadius.circular(24),
                          border: Border.all(
                            color: WarmPearlColors.glassBorderStrong,
                            width: 1,
                          ),
                          boxShadow: WarmPearlShadows.glassSm,
                        ),
                        child: SelectableText(
                          item.content.isNotEmpty ? item.content : item.summary,
                          style: const TextStyle(
                            fontFamily: WarmPearlTypography.bodyFont,
                            fontSize: 14,
                            height: 1.6,
                            color: WarmPearlColors.inkPrimary,
                          ),
                        ),
                      ),
                      const SizedBox(height: 18),

                      // Attachments Section
                      if (item.attachments.isNotEmpty) ...[
                        const Text(
                          'Tệp đính kèm',
                          style: TextStyle(
                            fontFamily: WarmPearlTypography.displayFont,
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: WarmPearlColors.inkPrimary,
                          ),
                        ),
                        const SizedBox(height: 8),
                        ...item.attachments.map((att) {
                          final attMap = att is Map ? att : {};
                          final title =
                              attMap['title']?.toString() ?? 'Tệp đính kèm';
                          final url = attMap['url']?.toString() ?? '';

                          return GestureDetector(
                            onTap: () => _openUrl(url),
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 14,
                                vertical: 10,
                              ),
                              decoration: BoxDecoration(
                                color: Colors.white.withValues(alpha: 0.75),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(
                                  color: WarmPearlColors.glassBorder,
                                ),
                              ),
                              child: Row(
                                children: [
                                  const Icon(
                                    Icons.attach_file_rounded,
                                    size: 18,
                                    color: WarmPearlColors.coralInk,
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Text(
                                      title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontFamily:
                                            WarmPearlTypography.displayFont,
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w700,
                                        color: WarmPearlColors.inkPrimary,
                                      ),
                                    ),
                                  ),
                                  const Icon(
                                    Icons.download_rounded,
                                    size: 16,
                                    color: WarmPearlColors.inkMuted,
                                  ),
                                ],
                              ),
                            ),
                          );
                        }),
                        const SizedBox(height: 12),
                      ],

                      // Hashtags
                      if (item.tags.isNotEmpty) ...[
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: item.tags.map((tag) {
                            return GestureDetector(
                              onTap: () => openSpotlightSearch(
                                context,
                                initialQuery: tag,
                              ),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  color: WarmPearlColors.coralSoft,
                                  borderRadius: BorderRadius.circular(999),
                                  border: Border.all(
                                    color: WarmPearlColors.coralBorder,
                                  ),
                                ),
                                child: Text(
                                  tag.startsWith('#') ? tag : '#$tag',
                                  style: const TextStyle(
                                    fontFamily: WarmPearlTypography.bodyFont,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w700,
                                    color: WarmPearlColors.coralInk,
                                  ),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                      ],
                    ],
                  ),

                  // Frosted Top Header
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 16,
                        vertical: 10,
                      ),
                      decoration: BoxDecoration(
                        color: WarmPearlColors.topPillBg,
                        border: const Border(
                          bottom: BorderSide(
                            color: WarmPearlColors.glassBorderStrong,
                            width: 1,
                          ),
                        ),
                        boxShadow: WarmPearlShadows.glassSm,
                      ),
                      child: Row(
                        children: [
                          GestureDetector(
                            onTap: () => _handleBack(context),
                            child: Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: Colors.white.withValues(alpha: 0.8),
                                border: Border.all(
                                  color: WarmPearlColors.glassBorderStrong,
                                ),
                              ),
                              alignment: Alignment.center,
                              child: const Icon(
                                Icons.arrow_back_rounded,
                                size: 18,
                                color: WarmPearlColors.inkPrimary,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          const Text(
                            'Chi tiết thông báo',
                            style: TextStyle(
                              fontFamily: WarmPearlTypography.displayFont,
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: WarmPearlColors.inkPrimary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Sticky Bottom Bar with Mark-Read Button
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: 0,
                    child: Container(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                      decoration: BoxDecoration(
                        gradient: WarmPearlGradients.stickyBarFade,
                      ),
                      child: GestureDetector(
                        onTap:
                            _isTogglingRead ? null : () => _toggleRead(item),
                        child: Container(
                          height: 46,
                          decoration: BoxDecoration(
                            gradient: item.isRead
                                ? null
                                : WarmPearlGradients.slateMarkRead,
                            color: item.isRead
                                ? WarmPearlColors.mintSoft
                                : null,
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(
                              color: item.isRead
                                  ? WarmPearlColors.mintBorder
                                  : Colors.white.withValues(alpha: 0.3),
                            ),
                            boxShadow: item.isRead
                                ? null
                                : const [
                                    BoxShadow(
                                      color: Color(0x331E293B),
                                      blurRadius: 16,
                                      offset: Offset(0, 6),
                                    ),
                                  ],
                          ),
                          alignment: Alignment.center,
                          child: _isTogglingRead
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.white,
                                  ),
                                )
                              : Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      item.isRead
                                          ? Icons.mark_email_unread_outlined
                                          : Icons.done_all_rounded,
                                      size: 18,
                                      color: item.isRead
                                          ? WarmPearlColors.mint
                                          : Colors.white,
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      item.isRead
                                          ? 'Đánh dấu là chưa đọc'
                                          : 'Đánh dấu đã đọc',
                                      style: TextStyle(
                                        fontFamily:
                                            WarmPearlTypography.displayFont,
                                        fontSize: 13.5,
                                        fontWeight: FontWeight.w700,
                                        color: item.isRead
                                            ? WarmPearlColors.mint
                                            : Colors.white,
                                      ),
                                    ),
                                  ],
                                ),
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        ),
      ),
    ),
  ),
);
  }
}
