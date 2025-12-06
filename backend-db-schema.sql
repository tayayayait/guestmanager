-- CenterFlow RDB 스키마 초안 (PostgreSQL 기준)
-- 실제 운영 시에는 필요에 따라 컬럼/인덱스를 조정하세요.

-- 1. 회원 (Visitor)
CREATE TABLE visitors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number    VARCHAR(20) NOT NULL UNIQUE,
    name            VARCHAR(100) NOT NULL,
    birth_date      DATE,
    address         TEXT,
    is_startup      BOOLEAN,
    notes           TEXT,
    terms_accepted_at TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_visitors_created_at ON visitors (created_at DESC);


-- 2. 공간 (Space)
CREATE TABLE spaces (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    capacity    INTEGER NOT NULL DEFAULT 0,
    type        VARCHAR(20),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 3. 프로그램 / 이벤트 (Program)
CREATE TABLE programs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(150) NOT NULL,
    description TEXT,
    start_at    TIMESTAMPTZ NOT NULL,
    end_at      TIMESTAMPTZ NOT NULL,
    capacity    INTEGER,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_programs_period ON programs (start_at, end_at);


-- 4. 방문 기록 (Visit)
CREATE TABLE visits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id      UUID NOT NULL REFERENCES visitors(id),
    space_id        UUID REFERENCES spaces(id),
    program_id      UUID REFERENCES programs(id),
    visitor_name    VARCHAR(100) NOT NULL, -- denormalized for fast listing
    space_name      VARCHAR(100),
    program_name    VARCHAR(150),
    check_in_at     TIMESTAMPTZ NOT NULL,
    check_out_at    TIMESTAMPTZ,
    purpose         VARCHAR(20) NOT NULL, -- 'Study' | 'Meeting' | ...
    status          VARCHAR(20) NOT NULL, -- 'active' | 'completed'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_visits_visitor ON visits (visitor_id);
CREATE INDEX idx_visits_check_in_at ON visits (check_in_at DESC);
CREATE INDEX idx_visits_status ON visits (status);
CREATE INDEX idx_visits_space ON visits (space_id, status);
CREATE INDEX idx_visits_program ON visits (program_id);


-- 5. 프로그램 출석 (ProgramAttendance)
CREATE TABLE program_attendances (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id  UUID NOT NULL REFERENCES programs(id),
    visitor_id  UUID NOT NULL REFERENCES visitors(id),
    visit_id    UUID NOT NULL REFERENCES visits(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_program_attendance ON program_attendances (program_id, visitor_id, visit_id);


-- 6. 제재 / 경고 (Penalty)
CREATE TABLE penalties (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id  UUID NOT NULL REFERENCES visitors(id),
    type        VARCHAR(20) NOT NULL, -- 'warning' | 'suspension'
    reason      TEXT NOT NULL,
    active      BOOLEAN NOT NULL DEFAULT TRUE,
    starts_at   TIMESTAMPTZ DEFAULT NOW(),
    ends_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by  UUID, -- 관리자 ID (admins.id) - 추후 참조
    note        TEXT
);

CREATE INDEX idx_penalties_visitor ON penalties (visitor_id);
CREATE INDEX idx_penalties_active ON penalties (visitor_id, active);


-- 7. 관리자 (Admin) - 추후 권한/감사 로그에 사용
CREATE TABLE admins (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email       VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name        VARCHAR(100) NOT NULL,
    role        VARCHAR(50) NOT NULL, -- e.g. 'SUPER_ADMIN', 'STAFF'
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- 8. 감사 로그 (Audit Log) - 주요 관리자 액션 기록
CREATE TABLE audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id    UUID REFERENCES admins(id),
    action      VARCHAR(100) NOT NULL, -- e.g. 'VISITOR_UPDATE', 'PENALTY_CREATE'
    target_type VARCHAR(50),           -- e.g. 'visitor', 'visit', 'space'
    target_id   UUID,
    payload     JSONB,                 -- 변경 내용/요청 파라미터 요약
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_admin ON audit_logs (admin_id, created_at DESC);


-- 9. 시스템 설정 (Settings) - 약관 버전, 좌석 정책 등
CREATE TABLE settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       JSONB NOT NULL,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 예시 데이터 (선택)
-- INSERT INTO settings(key, value) VALUES
--   ('terms.current_version', '{"version": "1.0.0", "updated_at": "2025-01-01"}');

