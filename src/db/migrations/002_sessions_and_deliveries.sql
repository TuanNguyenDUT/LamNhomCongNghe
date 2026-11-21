CREATE TABLE IF NOT EXISTS auth_sessions (
    token_hash CHAR(64) PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth_sessions (expires_at);

CREATE TABLE IF NOT EXISTS oauth_states (
    state_hash CHAR(64) PRIMARY KEY,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS push_deliveries (
    id BIGSERIAL PRIMARY KEY,
    notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
    deadline_id UUID REFERENCES deadlines(deadline_id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    device_token_id BIGINT NOT NULL REFERENCES device_tokens(id) ON DELETE CASCADE,
    stage INTEGER NOT NULL DEFAULT 0,
    dedupe_key TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING','SENDING','SENT','FAILED','SKIPPED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_until TIMESTAMPTZ,
    provider_message_id TEXT,
    error_code TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_push_deliveries_pending ON push_deliveries (status, available_at);

-- Legacy base64/plaintext credentials cannot be secured retroactively without
-- retaining their old exposure. Require re-authentication to store encrypted values.
UPDATE students SET dut_session_encrypted=NULL
    WHERE dut_session_encrypted IS NOT NULL AND dut_session_encrypted NOT LIKE 'v1:%';
UPDATE students SET google_refresh_token=NULL, is_calendar_sync_enabled=FALSE
    WHERE google_refresh_token IS NOT NULL AND google_refresh_token NOT LIKE 'v1:%';
