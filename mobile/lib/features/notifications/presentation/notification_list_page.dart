import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:material_ui/material_ui.dart';

import '../domain/notification_item.dart';
import 'notification_providers.dart';

class NotificationListPage extends ConsumerWidget {
  const NotificationListPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final feed = ref.watch(notificationFeedProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Bảng tin sinh viên'),
            Text(
              'Thông báo tập trung đa nguồn',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.normal),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Tải lại',
            onPressed: () => ref.invalidate(notificationFeedProvider),
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      body: SafeArea(
        child: feed.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, stack) => _ErrorView(
            message: error.toString(),
            onRetry: () => ref.invalidate(notificationFeedProvider),
          ),
          data: (page) {
            if (page.items.isEmpty) {
              return const Center(child: Text('Chưa có thông báo.'));
            }

            return RefreshIndicator(
              onRefresh: () async {
                ref.invalidate(notificationFeedProvider);
                await ref.read(notificationFeedProvider.future);
              },
              child: ListView.separated(
                padding: const EdgeInsets.all(16),
                itemCount: page.items.length,
                separatorBuilder: (_, _) => const SizedBox(height: 12),
                itemBuilder: (context, index) {
                  final item = page.items[index];
                  return _NotificationCard(
                    item: item,
                    onTap: () => context.push('/notifications/${item.id}'),
                  );
                },
              ),
            );
          },
        ),
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({required this.item, required this.onTap});

  final NotificationItem item;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = _priorityColor(item.priority);
    final date = DateFormat('dd/MM/yyyy HH:mm')
        .format(item.publishedAt.toLocal());

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: DecoratedBox(
          decoration: BoxDecoration(
            border: Border(
              left: BorderSide(color: color, width: item.isRead ? 2 : 5),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _Badge(
                      label: '${item.priority} · ${item.priorityScore}đ',
                      color: color,
                    ),
                    _Badge(label: item.scopeType, color: Colors.indigo),
                    if (item.courseTag != null)
                      _Badge(label: item.courseTag!, color: Colors.blue),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  '${item.isPinned ? '📌 ' : ''}${item.title}',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: item.isRead ? FontWeight.w600 : FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  item.summary.isEmpty ? item.content : item.summary,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 12),
                Text(date, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  const _Badge({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, size: 48),
            const SizedBox(height: 12),
            const Text('Không thể tải bảng tin'),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Thử lại')),
          ],
        ),
      ),
    );
  }
}

Color _priorityColor(String priority) {
  return switch (priority) {
    'URGENT' => Colors.red,
    'HIGH' => Colors.orange,
    'LOW' => Colors.green,
    _ => Colors.lightBlue,
  };
}
