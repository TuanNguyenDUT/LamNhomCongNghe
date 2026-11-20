import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../reminds/presentation/add_reminder_modal.dart';
import '../../auth/presentation/auth_controller.dart';
import '../domain/notification_item.dart';
import 'notification_providers.dart';

class NotificationDetailPage extends ConsumerWidget {
  const NotificationDetailPage({required this.notificationId, super.key});

  final dynamic notificationId;

  Future<void> _openUrl(BuildContext context, String urlString) async {
    final uri = Uri.parse(urlString);
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        await launchUrl(uri);
      }
    } catch (err) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Không thể mở liên kết: $err')),
        );
      }
    }
  }

  void _showAddReminderDialog(BuildContext context, WidgetRef ref, NotificationItem notif, dynamic session) {
    showAddReminderModal(context, ref, notif, session);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(notificationDetailProvider(notificationId));
    final authState = ref.watch(authControllerProvider);
    final session = authState.session;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Chi tiết thông báo', style: TextStyle(fontWeight: FontWeight.w700)),
        backgroundColor: Colors.white,
        elevation: 0.5,
      ),
      body: SafeArea(
        child: detail.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stack) => Center(child: Text('Lỗi: $error')),
          data: (item) {
            final isFb = item.sourceChannel == 'FB_CTSV' ||
                item.sourceChannel == 'FB_TUVAN_SV' ||
                (item.sourceUrl != null && item.sourceUrl!.contains('facebook.com'));
            final fbUrl = (item.sourceUrl != null && item.sourceUrl!.trim().startsWith('http'))
                ? item.sourceUrl!.trim()
                : (item.sourceChannel == 'FB_TUVAN_SV'
                    ? 'https://www.facebook.com/tuvansinhvien.dut'
                    : 'https://www.facebook.com/ctsvdhbkdhdn');

            return ListView(
              padding: const EdgeInsets.all(20),
              children: [
                // Hàng 1: Nguồn kênh & Ngày đăng
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: isFb ? const Color(0xFF1877F2).withValues(alpha: 0.15) : const Color(0xFF007AFF).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Text(
                        item.sourceName ?? item.sourceChannel ?? 'Thông báo',
                        style: TextStyle(
                          color: isFb ? const Color(0xFF1877F2) : const Color(0xFF007AFF),
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    if (item.courseCode != null &&
                        item.courseCode!.trim().isNotEmpty &&
                        item.sourceChannel != 'FB_CTSV' &&
                        item.sourceChannel != 'FB_TUVAN_SV' &&
                        item.sourceChannel != 'DUT_GENERAL' &&
                        item.sourceChannel != 'DUT_STUDENT_AFFAIRS') ...[
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: const Color(0xFF5856D6).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          item.courseCode!,
                          style: const TextStyle(
                            color: Color(0xFF5856D6),
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                    const Spacer(),
                    Text(
                      DateFormat('dd/MM/yyyy HH:mm').format(item.publishedAt.toLocal()),
                      style: const TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Tiêu đề
                Text(
                  item.title,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                    letterSpacing: -0.4,
                    height: 1.3,
                  ),
                ),
                const SizedBox(height: 16),

                // Hàng Nút Hành Động Nổi Bật: [Thêm Nhắc Nhở] & [Điều Hướng Facebook / Nguồn Gốc]
                Row(
                  children: [
                    // Nút Thêm Nhắc Nhở
                    Expanded(
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.alarm_add_rounded, size: 18),
                        label: const Text('Thêm nhắc nhở'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFFF9500),
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          elevation: 1,
                        ),
                        onPressed: () => _showAddReminderDialog(context, ref, item, session),
                      ),
                    ),
                    const SizedBox(width: 10),

                    // Nút Điều Hướng Facebook hoặc Liên Kết Gốc (kèm Sao chép link)
                    if (isFb)
                      Expanded(
                        child: Row(
                          children: [
                            Expanded(
                              child: ElevatedButton.icon(
                                icon: const Icon(Icons.open_in_new_rounded, size: 17),
                                label: const Text('Mở bài viết'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF1877F2),
                                  foregroundColor: Colors.white,
                                  padding: const EdgeInsets.symmetric(vertical: 12),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                                  elevation: 1,
                                ),
                                onPressed: () => _openUrl(context, fbUrl),
                              ),
                            ),
                            const SizedBox(width: 8),
                            InkWell(
                              borderRadius: BorderRadius.circular(14),
                              onTap: () {
                                Clipboard.setData(ClipboardData(text: fbUrl));
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Đã sao chép link bài viết Facebook!'),
                                    duration: Duration(seconds: 2),
                                  ),
                                );
                              },
                              child: Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: const Color(0xFF1877F2).withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(color: const Color(0xFF1877F2).withValues(alpha: 0.35)),
                                ),
                                child: const Icon(Icons.copy_rounded, color: Color(0xFF1877F2), size: 18),
                              ),
                            ),
                          ],
                        ),
                      )
                    else if (item.sourceUrl != null && item.sourceUrl!.startsWith('http'))
                      Expanded(
                        child: OutlinedButton.icon(
                          icon: const Icon(Icons.link_rounded, size: 18),
                          label: const Text('Mở bài gốc'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF007AFF),
                            side: const BorderSide(color: Color(0xFF007AFF)),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                          onPressed: () => _openUrl(context, item.sourceUrl!),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 20),

                // Nội dung thông báo
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Text(
                    item.content,
                    style: const TextStyle(
                      fontSize: 15,
                      height: 1.55,
                      color: Color(0xFF334155),
                    ),
                  ),
                ),

                // Tệp đính kèm (nếu có)
                if (item.attachments.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  const Text(
                    'Tệp đính kèm:',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF0F172A)),
                  ),
                  const SizedBox(height: 8),
                  ...item.attachments.map((att) {
                    final title = (att is Map ? att['title'] : null) ?? 'Tệp đính kèm';
                    final url = (att is Map ? att['url'] : null) ?? '';
                    return Container(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        tileColor: const Color(0xFFF1F5F9),
                        leading: const Icon(Icons.attach_file_rounded, color: Color(0xFF007AFF)),
                        title: Text(title.toString(), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                        trailing: const Icon(Icons.download_rounded, size: 20, color: Color(0xFF007AFF)),
                        onTap: url.toString().isNotEmpty ? () => _openUrl(context, url.toString()) : null,
                      ),
                    );
                  }),
                ],

                // Thẻ tags
                if (item.tags.isNotEmpty) ...[
                  const SizedBox(height: 20),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: item.tags
                        .map((tag) => Chip(
                              label: Text(tag, style: const TextStyle(fontSize: 12)),
                              backgroundColor: const Color(0xFFF1F5F9),
                            ))
                        .toList(),
                  ),
                ],
                const SizedBox(height: 28),

                // Đánh dấu đã đọc
                FilledButton.icon(
                  onPressed: item.isRead
                      ? null
                      : () async {
                          await ref
                              .read(notificationRepositoryProvider)
                              .setReadStatus(item.id, isRead: true);
                          ref.invalidate(notificationDetailProvider(notificationId));
                          ref.invalidate(notificationFeedProvider);
                        },
                  icon: const Icon(Icons.done_all_rounded),
                  label: Text(item.isRead ? 'Đã đọc thông báo này' : 'Đánh dấu đã đọc'),
                  style: FilledButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
