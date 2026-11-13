-- =============================================================================
-- TASK 11: Thiết kế Schema cơ sở dữ liệu lưu trữ thông báo đa nguồn
-- Phụ trách: Nguyễn Hữu Tuấn
-- =============================================================================

PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

-- 1. Bảng kênh nguồn thông báo (Phòng Đào tạo, Khoa, Lớp học phần, Email SV, Ngoại khóa)
CREATE TABLE IF NOT EXISTS notification_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_code TEXT NOT NULL UNIQUE,
    source_name TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('TRAINING_DEPT', 'FACULTY', 'CLASS', 'STUDENT_EMAIL', 'EXTRACURRICULAR')),
    endpoint_url TEXT,
    base_weight INTEGER NOT NULL DEFAULT 10,
    is_active INTEGER NOT NULL DEFAULT 1,
    last_synced_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Bảng danh mục môn học / lớp học phần để tự động gắn tag môn học
CREATE TABLE IF NOT EXISTS courses (
    course_code TEXT PRIMARY KEY,
    course_name TEXT NOT NULL,
    course_tag TEXT NOT NULL,
    faculty TEXT NOT NULL,
    keywords TEXT NOT NULL -- Danh sách từ khóa nhận diện cách nhau bởi dấu phẩy
);

-- 3. Bảng chính lưu trữ thông báo tập trung từ nhiều nguồn
CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT,
    source_code TEXT NOT NULL,
    source_type TEXT NOT NULL CHECK (source_type IN ('TRAINING_DEPT', 'FACULTY', 'CLASS', 'STUDENT_EMAIL', 'EXTRACURRICULAR')),
    channel_name TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT NOT NULL,
    sender_name TEXT,
    sender_email TEXT,
    recipient_student_id TEXT,
    course_code TEXT,
    course_tag TEXT,
    scope_type TEXT NOT NULL DEFAULT 'GENERAL' CHECK (scope_type IN ('GENERAL', 'CLASS', 'PERSONAL')),
    category TEXT NOT NULL DEFAULT 'ACADEMIC',
    priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('URGENT', 'HIGH', 'MEDIUM', 'LOW')),
    priority_score INTEGER NOT NULL DEFAULT 50,
    tags_json TEXT NOT NULL DEFAULT '[]',
    source_url TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    is_pinned INTEGER NOT NULL DEFAULT 0,
    content_hash TEXT NOT NULL UNIQUE,
    published_at TEXT NOT NULL,
    ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (source_code) REFERENCES notification_sources(source_code) ON DELETE CASCADE
);

-- 4. Bảng nhật ký thu thập / đồng bộ thông báo (phục vụ theo dõi & đo hiệu năng Task 12 & 15)
CREATE TABLE IF NOT EXISTS ingestion_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL,
    source_code TEXT NOT NULL,
    channel_type TEXT NOT NULL,
    fetched_count INTEGER NOT NULL DEFAULT 0,
    inserted_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    duration_ms REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'SUCCESS',
    error_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 5. Thiết bị nhận Push Notification (Task 6 - Hồ Đăng Hưng)
-- Token được lưu để FCM định tuyến tới đúng app instance. API tuyệt đối không trả
-- token/token_hash về client và không ghi các giá trị này vào application log.
CREATE TABLE IF NOT EXISTS device_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT NOT NULL,
    token TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    target_type TEXT NOT NULL DEFAULT 'TOKEN' CHECK (target_type IN ('TOKEN', 'FID')),
    platform TEXT NOT NULL CHECK (platform IN ('ANDROID', 'IOS', 'WEB')),
    device_id TEXT NOT NULL,
    app_version TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_seen_at TEXT NOT NULL,
    last_error_code TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (student_id, device_id)
);

-- =============================================================================
-- INDEXES TỐI ƯU HÓA TRUY VẤN (Task 11 & Task 15)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_notifications_feed_sort
    ON notifications (is_pinned DESC, priority_score DESC, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_source_type
    ON notifications (source_type, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_priority
    ON notifications (priority, priority_score DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_scope_type
    ON notifications (scope_type, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_course_code
    ON notifications (course_code, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read
    ON notifications (is_read, published_at DESC);

-- Một FCM token chỉ được active trên một thiết bị tại một thời điểm. Partial
-- unique index vẫn cho phép giữ lịch sử token đã bị hủy đăng ký.
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_tokens_active_token_hash
    ON device_tokens (token_hash)
    WHERE is_active = 1;

CREATE INDEX IF NOT EXISTS idx_device_tokens_student_active
    ON device_tokens (student_id, is_active, last_seen_at DESC);
