-- =============================================================================
-- TASK 11: Thiết kế Schema CSDL (PostgreSQL) lưu trữ & thu thập thông báo đa nguồn
-- Kiến trúc nhóm: Node.js Backend + PostgreSQL + Flutter + Firebase (FCM / Auth)
-- Phụ trách: Nguyễn Hữu Tuấn
-- =============================================================================

-- 1. Kiểu dữ liệu ENUM cho PostgreSQL
DO $$ BEGIN
    CREATE TYPE source_channel_type AS ENUM (
        'TRAINING_DEPT',   -- Phòng Đào tạo
        'FACULTY',         -- Khoa quản lý
        'CLASS_SECTION',   -- Lớp học phần / Giảng viên
        'STUDENT_EMAIL',   -- Email sinh viên
        'EXTRACURRICULAR'  -- Kênh ngoại khóa / Đoàn - Hội / CLB
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_scope_type AS ENUM (
        'GENERAL',         -- Thông báo chung toàn trường / toàn khoa
        'CLASS',           -- Thông báo theo lớp học phần
        'PERSONAL'         -- Thông báo riêng cá nhân sinh viên
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_priority_level AS ENUM (
        'LOW',
        'MEDIUM',
        'HIGH',
        'URGENT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Bảng Sinh viên (Liên kết với Firebase Auth UID & các module khác của nhóm)
CREATE TABLE IF NOT EXISTS students (
    student_id VARCHAR(20) PRIMARY KEY,              -- Mã số sinh viên (VD: 102230001)
    firebase_uid VARCHAR(128) UNIQUE,                -- UID từ Firebase Authentication
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,              -- Email sinh viên (@sv.dut.udn.vn)
    faculty_code VARCHAR(30) NOT NULL,
    cohort VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Bảng Môn học (Courses)
CREATE TABLE IF NOT EXISTS courses (
    course_code VARCHAR(30) PRIMARY KEY,             -- Mã môn học (VD: IT401, IT302)
    course_name VARCHAR(150) NOT NULL,
    course_tag VARCHAR(50) NOT NULL,                 -- Tag hiển thị trên Flutter UI (VD: #IT401-CNPM)
    faculty_code VARCHAR(30) NOT NULL,
    credits SMALLINT NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Bảng Lớp học phần (Class Sections)
CREATE TABLE IF NOT EXISTS class_sections (
    section_id SERIAL PRIMARY KEY,
    section_code VARCHAR(40) NOT NULL UNIQUE,        -- Mã lớp học phần (VD: IT401.241.01)
    course_code VARCHAR(30) NOT NULL REFERENCES courses(course_code) ON DELETE CASCADE,
    semester VARCHAR(20) NOT NULL,                   -- Học kỳ (VD: 2026-1)
    lecturer_name VARCHAR(120),
    room VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Bảng Đăng ký học phần của Sinh viên (Quan hệ N-N giữa Sinh viên và Lớp học phần)
CREATE TABLE IF NOT EXISTS student_enrollments (
    student_id VARCHAR(20) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    section_id INTEGER NOT NULL REFERENCES class_sections(section_id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (student_id, section_id)
);

-- 6. Bảng Danh mục Kênh nguồn thông báo (Notification Sources)
CREATE TABLE IF NOT EXISTS notification_sources (
    source_id SERIAL PRIMARY KEY,
    source_code VARCHAR(40) NOT NULL UNIQUE,         -- VD: PORTAL_PDT, FACULTY_IT, LMS_CLASS, EMAIL_SV, CLUB_EXTRA
    source_name VARCHAR(150) NOT NULL,
    source_type source_channel_type NOT NULL,
    endpoint_url TEXT,
    default_weight SMALLINT NOT NULL DEFAULT 10,     -- Trọng số cơ sở phục vụ thuật toán tính độ ưu tiên (Task 13)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Bảng Thông báo trung tâm thu thập từ nhiều nguồn (Notifications)
CREATE TABLE IF NOT EXISTS notifications (
    notification_id BIGSERIAL PRIMARY KEY,
    external_id VARCHAR(120),                        -- ID bài viết gốc từ Portal / Message-ID từ Email
    source_id INTEGER NOT NULL REFERENCES notification_sources(source_id) ON DELETE RESTRICT,
    source_type source_channel_type NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    summary TEXT,
    sender_name VARCHAR(150),
    sender_email VARCHAR(150),
    course_code VARCHAR(30) REFERENCES courses(course_code) ON DELETE SET NULL,
    section_id INTEGER REFERENCES class_sections(section_id) ON DELETE SET NULL,
    target_student_id VARCHAR(20) REFERENCES students(student_id) ON DELETE SET NULL,
    scope_type notification_scope_type NOT NULL DEFAULT 'GENERAL',
    priority notification_priority_level NOT NULL DEFAULT 'MEDIUM',
    priority_score SMALLINT NOT NULL DEFAULT 50 CHECK (priority_score BETWEEN 0 AND 100),
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,         -- Lưu danh sách tag môn học/chủ đề dạng JSONB
    attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_url TEXT,
    content_hash CHAR(64) NOT NULL UNIQUE,           -- SHA-256 hash chống trùng lặp khi cào đa nguồn
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ingested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Bảng Phân phối & Trạng thái đọc thông báo của từng Sinh viên (Phục vụ Flutter Feed & FCM)
CREATE TABLE IF NOT EXISTS student_notifications (
    id BIGSERIAL PRIMARY KEY,
    notification_id BIGINT NOT NULL REFERENCES notifications(notification_id) ON DELETE CASCADE,
    student_id VARCHAR(20) NOT NULL REFERENCES students(student_id) ON DELETE CASCADE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    fcm_sent BOOLEAN NOT NULL DEFAULT FALSE,
    delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (notification_id, student_id)
);

-- 9. Bảng Nhật ký phiên thu thập thông báo (Ingestion Logs)
CREATE TABLE IF NOT EXISTS ingestion_logs (
    log_id BIGSERIAL PRIMARY KEY,
    batch_code VARCHAR(64) NOT NULL,
    source_id INTEGER REFERENCES notification_sources(source_id) ON DELETE SET NULL,
    fetched_count INTEGER NOT NULL DEFAULT 0,
    inserted_count INTEGER NOT NULL DEFAULT 0,
    duplicate_count INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS',
    error_message TEXT,
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEXES TỐI ƯU TRUY VẤN TRÊN POSTGRESQL
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_notifications_source_published
    ON notifications (source_type, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_priority_published
    ON notifications (priority, priority_score DESC, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_scope_course
    ON notifications (scope_type, course_code, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_tags_gin
    ON notifications USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_student_notifications_unread
    ON student_notifications (student_id, is_read, delivered_at DESC);
