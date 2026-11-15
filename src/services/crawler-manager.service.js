/**
 * BỘ QUẢN LÝ & ĐIỀU PHỐI CÀO THÔNG BÁO TỰ ĐỘNG ĐỊNH KỲ (CRAWLER MANAGER)
 * Triển khai theo yêu cầu đặc tả:
 * 1. Cào thông báo từ trang sv.dut.udn.vn (7 chuyên mục) và 2 Fanpage FB
 * 2. Cơ chế cập nhật định kỳ mỗi 30 phút (30 minutes interval)
 * 3. Giới hạn thời gian 2 tháng (60 ngày) đối với mọi nguồn
 * 4. Chống trùng lặp tuyệt đối (không lưu lại thông báo đã cào trước đó qua SHA-256)
 * 5. Xác định rõ ràng nguồn gốc từng thông báo (source_channel, source_name, source_url)
 */

const { dutCrawlerService } = require('./dut-crawler.service');
const { fbCrawlerService } = require('./fb-crawler.service');
const { notificationService } = require('./notification.service');

class CrawlerManagerService {
  constructor({
    dutCrawler = dutCrawlerService,
    fbCrawler = fbCrawlerService,
    notificationSvc = notificationService,
    intervalMinutes = 30,
    monthsLimit = 2,
  } = {}) {
    this.dutCrawler = dutCrawler;
    this.fbCrawler = fbCrawler;
    this.notificationSvc = notificationSvc;
    this.intervalMinutes = intervalMinutes;
    this.monthsLimit = monthsLimit;

    this.timer = null;
    this.isRunning = false;
    this.lastCrawlAt = null;
    this.nextCrawlAt = null;
    this.lastStats = null;
    this.crawlHistory = [];
  }

  /**
   * Thực hiện một chu kỳ cào toàn bộ các nguồn ngay lập tức (On-demand hoặc Periodic)
   */
  async crawlAllSources() {
    if (this.isRunning) {
      return {
        status: 'BUSY',
        message: 'Một tiến trình cào thông báo đang chạy, vui lòng thử lại sau',
      };
    }

    this.isRunning = true;
    const startedAt = new Date();
    const stats = {
      started_at: startedAt.toISOString(),
      finished_at: null,
      duration_ms: 0,
      total_scraped: 0,
      inserted_count: 0,
      duplicate_count: 0,
      skipped_old_count: 0,
      by_source: {},
    };

    console.log(`\n===================================================================`);
    console.log(`🕷️ [CRAWLER WORKER] Bắt đầu chu kỳ cào thông báo (Giới hạn: ${this.monthsLimit} tháng)`);
    console.log(`⏰ Thời điểm bắt đầu: ${startedAt.toLocaleString('vi-VN')}`);
    console.log(`===================================================================`);

    try {
      // 1. Cào 7 chuyên mục trên cổng sv.dut.udn.vn
      console.log(`▶ 1. Đang cào 7 tab từ https://sv.dut.udn.vn/...`);
      const dutResults = await this.dutCrawler.scrapeAllDutTabs({ monthsLimit: this.monthsLimit });
      stats.skipped_old_count += dutResults.total_skipped_old;

      // 2. Cào 2 Fanpage Facebook (FB_CTSV và FB_TUVAN_SV)
      console.log(`▶ 2. Đang cào 2 Fanpage Facebook (CTSV & Tư vấn SV)...`);
      const fbResults = await this.fbCrawler.scrapeAllFanpages({ monthsLimit: this.monthsLimit });

      const allNotices = [...dutResults.valid_notices, ...fbResults];
      stats.total_scraped = allNotices.length;

      console.log(`▶ 3. Đã thu thập được tổng cộng ${allNotices.length} thông báo trong vòng ${this.monthsLimit} tháng.`);
      console.log(`▶ 4. Bắt đầu kiểm tra chống trùng lặp SHA-256 và lưu CSDL...`);

      // 3. Ingest từng thông báo vào notificationService (chống trùng lặp SHA-256)
      for (const notice of allNotices) {
        const sourceCode = notice.source_channel || 'DUT_GENERAL';
        if (!stats.by_source[sourceCode]) {
          stats.by_source[sourceCode] = {
            name: notice.source_name || sourceCode,
            scraped: 0,
            inserted: 0,
            duplicates: 0,
          };
        }
        stats.by_source[sourceCode].scraped++;

        const ingestResult = await this.notificationSvc.ingestNotification({
          title: notice.title,
          content: notice.content,
          source_channel: notice.source_channel,
          source_type: notice.source_channel,
          source_name: notice.source_name,
          source_url: notice.source_url,
          published_at: notice.published_at,
          attachments: notice.attachments || [],
        });

        if (ingestResult.status === 'INSERTED') {
          stats.inserted_count++;
          stats.by_source[sourceCode].inserted++;
        } else if (ingestResult.status === 'DUPLICATE') {
          stats.duplicate_count++;
          stats.by_source[sourceCode].duplicates++;
        }
      }

      const finishedAt = new Date();
      stats.finished_at = finishedAt.toISOString();
      stats.duration_ms = finishedAt.getTime() - startedAt.getTime();

      console.log(`✔ [CRAWLER WORKER] Hoàn thành chu kỳ cào trong ${stats.duration_ms}ms!`);
      console.log(`   - Tin mới lưu (INSERTED) : ${stats.inserted_count}`);
      console.log(`   - Trùng lặp bỏ qua (DUP) : ${stats.duplicate_count}`);
      console.log(`   - Tin cũ > 2 tháng bỏ qua: ${stats.skipped_old_count}`);
      console.log(`===================================================================\n`);
    } catch (err) {
      console.error('❌ [CRAWLER WORKER] Lỗi trong chu kỳ cào:', err.message);
      stats.error = err.message;
    } finally {
      this.isRunning = false;
      this.lastCrawlAt = startedAt.toISOString();
      this.lastStats = stats;
      this.crawlHistory.unshift(stats);
      if (this.crawlHistory.length > 20) {
        this.crawlHistory.pop();
      }

      // Cập nhật mốc thời gian cào tiếp theo
      if (this.timer) {
        this.nextCrawlAt = new Date(Date.now() + this.intervalMinutes * 60 * 1000).toISOString();
      }
    }

    return stats;
  }

  /**
   * Khởi động Worker cào định kỳ mỗi 30 phút
   * @param {number} intervalMinutes - Chu kỳ lặp lại (mặc định 30 phút)
   */
  startPeriodicCrawl(intervalMinutes = 30) {
    this.intervalMinutes = intervalMinutes;
    this.stopPeriodicCrawl();

    const intervalMs = this.intervalMinutes * 60 * 1000;
    this.nextCrawlAt = new Date(Date.now() + intervalMs).toISOString();

    console.log(`⏱️ [CRAWLER WORKER] Đã kích hoạt Worker cào định kỳ mỗi ${this.intervalMinutes} phút.`);
    console.log(`👉 Lần cào tiếp theo dự kiến: ${new Date(this.nextCrawlAt).toLocaleString('vi-VN')}`);

    this.timer = setInterval(() => {
      this.crawlAllSources().catch((err) => {
        console.error('Lỗi uncaught trong periodic crawl:', err);
      });
    }, intervalMs);

    // Không làm treo tiến trình Node.js nếu app shutdown
    if (this.timer && typeof this.timer.unref === 'function') {
      this.timer.unref();
    }
  }

  /**
   * Dừng Worker định kỳ
   */
  stopPeriodicCrawl() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.nextCrawlAt = null;
  }

  /**
   * Lấy trạng thái hiện tại của Crawler
   */
  getStatus() {
    return {
      is_running: this.isRunning,
      interval_minutes: this.intervalMinutes,
      months_limit: this.monthsLimit,
      is_periodic_active: Boolean(this.timer),
      last_crawl_at: this.lastCrawlAt,
      next_crawl_at: this.nextCrawlAt,
      last_stats: this.lastStats,
    };
  }
}

const crawlerManagerService = new CrawlerManagerService();

module.exports = {
  CrawlerManagerService,
  crawlerManagerService,
};
