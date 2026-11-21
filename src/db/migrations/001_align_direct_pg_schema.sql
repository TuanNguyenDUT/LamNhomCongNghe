-- =============================================================================
-- Migration 001: Align PostgreSQL schema for Direct DB Query architecture
-- Idempotent migration (safe to re-run)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Convert notifications.source_channel from ENUM to VARCHAR(100) so dynamic
--    followed Facebook page channels (e.g. FB_CLB_*) and legacy aliases persist cleanly.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'source_channel'
      AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE notifications
      ALTER COLUMN source_channel TYPE VARCHAR(100)
      USING source_channel::text;
  END IF;
END $$;

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS chk_notifications_source_channel_nonempty;
ALTER TABLE notifications
  ADD CONSTRAINT chk_notifications_source_channel_nonempty
  CHECK (length(trim(source_channel)) > 0);

-- 2. Add columns used by notification ingestion, reschedule parsing & personal targeting
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS source_name VARCHAR(255);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reschedule_details JSONB;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS target_student_id UUID REFERENCES students(id) ON DELETE SET NULL;

-- 3. Add columns used by deadline classification & reminder types
ALTER TABLE deadlines ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'ACADEMIC';
ALTER TABLE deadlines ADD COLUMN IF NOT EXISTS category_code VARCHAR(50) DEFAULT 'hoc_tap';
ALTER TABLE deadlines ADD COLUMN IF NOT EXISTS category_name VARCHAR(100) DEFAULT 'Thông báo học tập';
ALTER TABLE deadlines ADD COLUMN IF NOT EXISTS item_type VARCHAR(30) DEFAULT 'DEADLINE';

-- 4. Ensure personalization & profile columns exist on students
ALTER TABLE students ADD COLUMN IF NOT EXISTS dut_session_encrypted TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_personalized_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS interested_topics JSONB DEFAULT '["hoc_vu", "hoc_bong", "tuyen_dung"]'::jsonb;
ALTER TABLE students ADD COLUMN IF NOT EXISTS quick_reminder_options JSONB DEFAULT '["1_hour", "tonight", "tomorrow_morning", "1_day", "3_days", "1_week"]'::jsonb;
ALTER TABLE students ADD COLUMN IF NOT EXISTS major VARCHAR(100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS program VARCHAR(100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS dob VARCHAR(20);
ALTER TABLE students ADD COLUMN IF NOT EXISTS gender VARCHAR(10);
ALTER TABLE students ADD COLUMN IF NOT EXISTS school_email VARCHAR(100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS personal_email VARCHAR(100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone VARCHAR(20);
