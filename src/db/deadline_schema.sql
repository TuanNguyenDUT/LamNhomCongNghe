-- =============================================================================
-- TASK 2: Thiết kế Database Schema lưu trữ deadline & môn học
-- Bổ sung Task 6: Lưu token thiết bị người dùng phục vụ Push Notification (FCM / APNs)
-- =============================================================================

-- 1. Kiểu dữ liệu ENUM cho trạng thái hạn chót
DO $$ BEGIN
    CREATE TYPE deadline_status_type AS ENUM (
        'OVERDUE',    -- Đã quá hạn
        'DUE_SOON',   -- Sắp đến (trong vòng 48 giờ)
        'UPCOMING',   -- Còn thời gian
        'COMPLETED'   -- Đã hoàn thành
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Đảm bảo bảng Môn học (Courses) tồn tại
CREATE TABLE IF NOT EXISTS courses (
    course_code VARCHAR(30) PRIMARY KEY,             -- Mã môn học (VD: IT401, IT302)
    course_name VARCHAR(150) NOT NULL,               -- Tên môn học
    course_tag VARCHAR(50) NOT NULL,                 -- Tag môn học (VD: #IT401-CNPM)
    faculty_code VARCHAR(30) NOT NULL DEFAULT 'CNTT',-- Khoa phụ trách
    credits SMALLINT NOT NULL DEFAULT 3,             -- Số tín chỉ
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Bảng Hạn chót bài tập (Deadlines) - Task 2
CREATE TABLE IF NOT EXISTS deadlines (
    deadline_id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,                     -- Tiêu đề bài tập / hạn chót
    subject VARCHAR(50) NOT NULL,                    -- Môn học (VD: IT401)
    course_code VARCHAR(30) REFERENCES courses(course_code) ON DELETE SET NULL,
    due_date TIMESTAMPTZ NOT NULL,                   -- Thời điểm hạn chót
    status deadline_status_type NOT NULL DEFAULT 'UPCOMING', -- Trạng thái tự động
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,     -- Đánh dấu hoàn thành (checkbox)
    completed_at TIMESTAMPTZ,                        -- Thời điểm tick hoàn thành
    note TEXT,                                       -- Ghi chú bổ sung
    student_id VARCHAR(20) REFERENCES students(student_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index tối ưu truy vấn deadline
CREATE INDEX IF NOT EXISTS idx_deadlines_subject_due
    ON deadlines (subject, due_date ASC);

CREATE INDEX IF NOT EXISTS idx_deadlines_status_due
    ON deadlines (status, due_date ASC);

CREATE INDEX IF NOT EXISTS idx_deadlines_completed
    ON deadlines (is_completed, due_date ASC);

-- 4. Bảng Lưu trữ Token thiết bị người dùng (FCM / APNs) - Task 6
CREATE TABLE IF NOT EXISTS user_device_tokens (
    token_id BIGSERIAL PRIMARY KEY,
    student_id VARCHAR(20) REFERENCES students(student_id) ON DELETE CASCADE,
    device_token TEXT NOT NULL UNIQUE,               -- Token FCM / APNs của thiết bị
    platform VARCHAR(20) NOT NULL DEFAULT 'WEB',     -- 'ANDROID', 'IOS', 'WEB'
    device_model VARCHAR(100),                       -- Tên thiết bị (VD: iPhone 15, Pixel 7)
    is_active BOOLEAN NOT NULL DEFAULT TRUE,         -- Đang hoạt động
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_student
    ON user_device_tokens (student_id, is_active);

-- Dữ liệu mẫu ban đầu cho môn học
INSERT INTO courses (course_code, course_name, course_tag, faculty_code, credits)
VALUES
    ('IT401', 'Công nghệ phần mềm', '#IT401-CNPM', 'CNTT', 3),
    ('IT302', 'Mạng máy tính', '#IT302-NET', 'CNTT', 3),
    ('IT501', 'Trí tuệ nhân tạo', '#IT501-AI', 'CNTT', 3),
    ('IT305', 'Hệ cơ sở dữ liệu', '#IT305-DBMS', 'CNTT', 3),
    ('IT210', 'Lập trình web', '#IT210-WEB', 'CNTT', 3),
    ('MATH201', 'Giải tích', '#MATH201-CALC', 'TOAN', 3)
ON CONFLICT (course_code) DO NOTHING;
