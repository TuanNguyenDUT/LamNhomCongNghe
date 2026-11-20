-- =============================================================================
-- HỆ THỐNG TỔNG HỢP & CẢNH BÁO THÔNG BÁO SINH VIÊN DUT (POSTGRESQL DDL SCHEMA)
-- Theo đặc tả kỹ thuật AGENT.md (Mục II.2)
-- Kiến trúc: Node.js Backend + PostgreSQL + Flutter + Firebase + Google Calendar
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Khai báo Custom ENUM Types
DO $$ BEGIN
    CREATE TYPE source_channel_type AS ENUM (
        'DUT_GENERAL',          -- Mục: Thông báo chung (sv.dut.udn.vn)
        'DUT_TRAINING',         -- Mục: Đào tạo (sv.dut.udn.vn)
        'DUT_COURSE_CLASS',     -- Mục: Lớp học phần (sv.dut.udn.vn)
        'DUT_STUDENT_AFFAIRS',  -- Mục: Công tác SV (sv.dut.udn.vn)
        'DUT_TESTING_QA',       -- Mục: Khảo thí & ĐBCL (sv.dut.udn.vn)
        'DUT_TUITION_FEE',      -- Mục: Học phí, lệ phí (sv.dut.udn.vn)
        'DUT_REGULATIONS',      -- Mục: Quy chế - Quy định (sv.dut.udn.vn)
        'FB_CTSV',              -- Fanpage: facebook.com/ctsvdhbkdhdn
        'FB_TUVAN_SV'           -- Fanpage: facebook.com/tuvansinhvien.dut
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_scope_type AS ENUM (
        'GLOBAL',               -- Thông báo chung toàn trường
        'FACULTY',              -- Toàn khoa
        'COHORT',               -- Khóa sinh viên
        'COURSE',               -- Lớp học phần cụ thể
        'PERSONAL'              -- Riêng cá nhân sinh viên
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE notification_priority_level AS ENUM (
        'LOW',
        'NORMAL',
        'HIGH',
        'URGENT'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Bảng Sinh viên, Phiên đồng bộ sv.dut.udn.vn & Google Calendar
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    student_code VARCHAR(20) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    faculty VARCHAR(100) NOT NULL,
    cohort VARCHAR(20) NOT NULL,
    class_name VARCHAR(50),
    dut_session_encrypted TEXT,                    -- Phiên/Token đăng nhập sv.dut.udn.vn đã mã hóa
    dut_last_synced_at TIMESTAMPTZ,                -- Thời điểm đồng bộ DS học phần gần nhất
    fcm_tokens JSONB DEFAULT '[]'::jsonb,
    google_refresh_token TEXT,                     -- Token OAuth2 đồng bộ Google Calendar
    google_calendar_id VARCHAR(255) DEFAULT 'primary',
    is_calendar_sync_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Bảng Danh mục Lớp học phần (Đồng bộ từ sv.dut.udn.vn)
CREATE TABLE IF NOT EXISTS courses (
    course_code VARCHAR(50) PRIMARY KEY,           -- VD: "1022301.2310.23.01" hoặc "IT401"
    course_name VARCHAR(255) NOT NULL,             -- VD: "Công nghệ phần mềm"
    semester VARCHAR(20) NOT NULL,
    lecturer_name VARCHAR(100),
    schedule_info VARCHAR(255),                    -- VD: "Thứ 4, Tiết 1-3, Phòng F102"
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Bảng Học phần Sinh viên đang theo học
CREATE TABLE IF NOT EXISTS student_courses (
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    course_code VARCHAR(50) REFERENCES courses(course_code) ON DELETE CASCADE,
    is_muted BOOLEAN DEFAULT FALSE,
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (student_id, course_code)
);

-- 5. Bảng Thông báo gốc
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    summary TEXT,                                  -- Tóm tắt (từ Rules Template hoặc AI API)
    action_required TEXT,
    content TEXT NOT NULL,
    source_channel source_channel_type NOT NULL,
    classified_by VARCHAR(20) NOT NULL DEFAULT 'RULE_ENGINE', -- 'RULE_ENGINE' hoặc 'AI_API'
    scope notification_scope_type NOT NULL,
    priority notification_priority_level NOT NULL DEFAULT 'NORMAL',
    priority_score INTEGER NOT NULL DEFAULT 0,
    category VARCHAR(50) DEFAULT 'ACADEMIC',       -- ACADEMIC, GRADE, ADMINISTRATIVE, EVENT, CAREER
    category_code VARCHAR(50) DEFAULT 'hoc_tap',   -- hoc_tap, diem_so, hanh_chinh, su_kien, nghe_nghiep
    category_name VARCHAR(100) DEFAULT 'Thông báo học tập',
    course_code VARCHAR(50) REFERENCES courses(course_code) ON DELETE SET NULL,
    target_faculty VARCHAR(100),
    target_cohort VARCHAR(20),
    is_emergency BOOLEAN DEFAULT FALSE,
    tags JSONB DEFAULT '[]'::jsonb,                -- Nhãn JSONB: ["nghi_hoc", "hoc_bu", "hoc_bong"]
    attachments JSONB DEFAULT '[]'::jsonb,         -- Đính kèm JSONB: [{"name": "...", "url": "..."}]
    source_url TEXT,
    deadline_at TIMESTAMPTZ,
    content_hash CHAR(64) UNIQUE NOT NULL,         -- Băm SHA-256 chống trùng lặp tin
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Bảng Phân phối Thông báo & Read Receipt của Sinh viên
CREATE TABLE IF NOT EXISTS student_notifications (
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    is_acknowledged BOOLEAN DEFAULT FALSE,         -- Xác nhận đã đọc tin khẩn cấp
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (student_id, notification_id)
);

-- 7. Bảng Quản lý Hạn chót (Deadlines) & Đồng bộ Google Calendar
CREATE TABLE IF NOT EXISTS deadlines (
    deadline_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
    course_code VARCHAR(50) REFERENCES courses(course_code) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    due_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING', -- PENDING, DUE_SOON, OVERDUE, COMPLETED
    google_event_id VARCHAR(255),                  -- Event ID trên Google Calendar
    last_synced_at TIMESTAMPTZ,
    reminder_stage_sent INTEGER DEFAULT 0,         -- Mốc nhắc việc đã gửi (168h, 72h, 24h, 2h)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Thiết bị nhận Push Notification
CREATE TABLE IF NOT EXISTS device_tokens (
    id BIGSERIAL PRIMARY KEY,
    student_id VARCHAR(64) NOT NULL,
    registration_target TEXT NOT NULL,
    target_hash CHAR(64) NOT NULL,
    target_type VARCHAR(10) NOT NULL DEFAULT 'TOKEN'
        CHECK (target_type IN ('TOKEN', 'FID')),
    platform VARCHAR(10) NOT NULL
        CHECK (platform IN ('ANDROID', 'IOS', 'WEB')),
    device_id VARCHAR(200) NOT NULL UNIQUE,
    app_version VARCHAR(40),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    failure_count INTEGER NOT NULL DEFAULT 0,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_error_code VARCHAR(120),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. Bảng Quản lý Fanpage Facebook được Sinh viên Theo dõi (Custom Facebook Pages)
CREATE TABLE IF NOT EXISTS followed_fb_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    page_url TEXT NOT NULL,
    page_name VARCHAR(255) NOT NULL,
    page_username VARCHAR(100) NOT NULL,
    channel_code VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_scraped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_student_page UNIQUE (student_id, page_url)
);

-- =============================================================================
-- INDEXES TỐI ƯU TRUY VẤN TRÊN POSTGRESQL
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_notifications_tags_gin 
    ON notifications USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_notifications_attachments_gin 
    ON notifications USING GIN (attachments);

CREATE INDEX IF NOT EXISTS idx_notifications_course_time 
    ON notifications (course_code, priority, published_at DESC) 
    WHERE course_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_channel_priority_time 
    ON notifications (source_channel, priority, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_category
    ON notifications (category);

CREATE INDEX IF NOT EXISTS idx_student_notifications_filter 
    ON student_notifications (student_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deadlines_student_status_due 
    ON deadlines (student_id, status, due_date ASC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_tokens_active_target_hash
    ON device_tokens (target_hash)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_device_tokens_student_active
    ON device_tokens (student_id, is_active, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_followed_fb_pages_student
    ON followed_fb_pages (student_id, is_active);
