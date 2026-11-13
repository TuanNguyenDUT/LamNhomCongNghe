import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import 'notification_providers.dart';

class NotificationDetailPage extends ConsumerWidget {
  const NotificationDetailPage({required this.notificationId, super.key});

  final int notificationId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final detail = ref.watch(notificationDetailProvider(notificationId));

    return Scaffold(
      appBar: AppBar(title: const Text('Chi tiết thông báo')),
      body: SafeArea(
        child: detail.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stack) => Center(child: Text(error.toString())),
          data: (item) => ListView(
            padding: const EdgeInsets.all(20),
            children: [
              Text(
                item.title,
                style: Theme.of(context).textTheme.headlineSmall,
              ),
              const SizedBox(height: 12),
              Text(
                DateFormat('dd/MM/yyyy HH:mm')
                    .format(item.publishedAt.toLocal()),
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 20),
              Text(item.content, style: Theme.of(context).textTheme.bodyLarge),
              if (item.tags.isNotEmpty) ...[
                const SizedBox(height: 20),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: item.tags
                      .map((tag) => Chip(label: Text(tag)))
                      .toList(),
                ),
              ],
              const SizedBox(height: 28),
              FilledButton.icon(
                onPressed: item.isRead
                    ? null
                    : () async {
                        await ref
                            .read(notificationRepositoryProvider)
                            .setReadStatus(item.id, isRead: true);
                        ref.invalidate(
                          notificationDetailProvider(notificationId),
                        );
                        ref.invalidate(notificationFeedProvider);
                      },
                icon: const Icon(Icons.done),
                label: Text(item.isRead ? 'Đã đọc' : 'Đánh dấu đã đọc'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
