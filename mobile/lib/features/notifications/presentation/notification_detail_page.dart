import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/network/api_client.dart';
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
    final titleCtrl = TextEditingController(text: '[Nhắc nhở] ${notif.title}');
    final descCtrl = TextEditingController(
      text: notif.summary.isNotEmpty ? notif.summary : notif.content,
    );
    final courseCtrl = TextEditingController(text: notif.courseCode ?? '');
    DateTime selectedDate = notif.deadlineAt ?? DateTime.now().add(const Duration(days: 1));

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlgState) => AlertDialog(
          backgroundColor: Colors.white.withValues(alpha: 0.96),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFFF9500).withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.alarm_add_rounded, color: Color(0xFFFF9500), size: 22),
              ),
              const SizedBox(width: 10),
              const Expanded(
                child: Text(
                  'Thêm Nhắc Nhở',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: Color(0xFF0F172A)),
                ),
              ),
            ],
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: titleCtrl,
                  decoration: InputDecoration(
                    labelText: 'Tiêu đề nhắc nhở *',
                    hintText: 'Nhập tiêu đề nhắc nhở',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 12),
                if (notif.courseCode != null &&
                    notif.courseCode!.trim().isNotEmpty &&
                    notif.sourceChannel != 'FB_CTSV' &&
                    notif.sourceChannel != 'FB_TUVAN_SV' &&
                    notif.sourceChannel != 'DUT_GENERAL' &&
                    notif.sourceChannel != 'DUT_STUDENT_AFFAIRS') ...[
                  TextField(
                    controller: courseCtrl,
                    decoration: InputDecoration(
                      labelText: 'Mã học phần',
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],
                TextField(
                  controller: descCtrl,
                  maxLines: 3,
                  decoration: InputDecoration(
                    labelText: 'Ghi chú chi tiết',
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
                const SizedBox(height: 14),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: const Color(0xFFCBD5E1)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.event_rounded, size: 20, color: Color(0xFF007AFF)),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          DateFormat('dd/MM/yyyy HH:mm').format(selectedDate),
                          style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                        ),
                      ),
                      TextButton.icon(
                        icon: const Icon(Icons.edit_calendar_rounded, size: 16),
                        label: const Text('Đổi ngày'),
                        onPressed: () async {
                          final d = await showDatePicker(
                            context: ctx,
                            initialDate: selectedDate,
                            firstDate: DateTime.now().subtract(const Duration(days: 1)),
                            lastDate: DateTime.now().add(const Duration(days: 365)),
                          );
                          if (d != null && ctx.mounted) {
                            final t = await showTimePicker(
                              context: ctx,
                              initialTime: TimeOfDay.fromDateTime(selectedDate),
                            );
                            setDlgState(() {
                              selectedDate = DateTime(
                                d.year,
                                d.month,
                                d.day,
                                t?.hour ?? selectedDate.hour,
                                t?.minute ?? selectedDate.minute,
                              );
                            });
                          }
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text('Hủy', style: TextStyle(color: Color(0xFF64748B))),
            ),
            ElevatedButton.icon(
              icon: const Icon(Icons.check_rounded, size: 18),
              label: const Text('Lưu nhắc nhở'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF007AFF),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              onPressed: () async {
                final title = titleCtrl.text.trim();
                if (title.isEmpty) return;
                Navigator.of(ctx).pop();

                try {
                  final studentId = session?.studentCode ?? '102230026';
                  await ref.read(dioProvider).post(
                    '/api/v1/deadlines',
                    data: {
                      'student_id': studentId,
                      'title': title,
                      'course_code': courseCtrl.text.trim().isEmpty ? null : courseCtrl.text.trim(),
                      'description': descCtrl.text.trim(),
                      'due_date': selectedDate.toIso8601String(),
                      'notification_id': notif.id.toString(),
                    },
                  );

                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Row(
                          children: [
                            const Icon(Icons.check_circle_rounded, color: Colors.white),
                            const SizedBox(width: 8),
                            Expanded(child: Text('⏰ Đã thêm nhắc nhở: "$title"')),
                          ],
                        ),
                        backgroundColor: const Color(0xFF34C759),
                        duration: const Duration(seconds: 3),
                      ),
                    );
                  }
                } catch (err) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Lỗi thêm nhắc nhở: $err')),
                    );
                  }
                }
              },
            ),
          ],
        ),
      ),
    );
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
            String fbUrl = item.sourceUrl ??
                (item.sourceChannel == 'FB_TUVAN_SV'
                    ? 'https://www.facebook.com/tuvansinhvien.dut'
                    : 'https://www.facebook.com/ctsvdhbkdhdn');
            // Chuẩn hóa link Facebook: Tránh lỗi 500 do post ID số không tồn tại
            if (fbUrl.contains('facebook.com') && RegExp(r'/posts/\d+$').hasMatch(fbUrl)) {
              fbUrl = item.sourceChannel == 'FB_TUVAN_SV'
                  ? 'https://www.facebook.com/tuvansinhvien.dut'
                  : 'https://www.facebook.com/ctsvdhbkdhdn';
            }

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

                    // Nút Điều Hướng Facebook hoặc Liên Kết Gốc
                    if (isFb)
                      Expanded(
                        child: ElevatedButton.icon(
                          icon: const Icon(Icons.open_in_new_rounded, size: 18),
                          label: const Text('Mở Facebook'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF1877F2),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            elevation: 1,
                          ),
                          onPressed: () => _openUrl(context, fbUrl),
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
