/**
 * TASK 15: Bộ nhớ đệm truy vấn (In-Memory Query Cache với TTL & LRU)
 * Phụ trách: Nguyễn Hữu Tuấn
 * Giúp tối ưu tốc độ phản hồi danh sách bảng tin tập trung và thống kê khi tải cao.
 */

class QueryCache {
  constructor({ maxEntries = 200, defaultTtlMs = 15000 } = {}) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
    this.store = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.misses += 1;
      return null;
    }
    // Làm mới thứ tự LRU
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  set(key, value, ttlMs = this.defaultTtlMs) {
    if (this.store.size >= this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  invalidateAll() {
    this.store.clear();
  }

  getStats() {
    const total = this.hits + this.misses;
    return {
      entries: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? Number(((this.hits / total) * 100).toFixed(2)) : 0,
    };
  }
}

module.exports = {
  QueryCache,
  feedCache: new QueryCache({ maxEntries: 250, defaultTtlMs: 30000 }),
};
