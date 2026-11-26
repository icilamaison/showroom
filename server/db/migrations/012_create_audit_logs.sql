-- 개인정보 접근·변경 감사 로그. 사고 시 범위 파악용.
CREATE TABLE IF NOT EXISTS audit_logs (
  id            BIGSERIAL PRIMARY KEY,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_type    VARCHAR(20)  NOT NULL,
  actor_id      INTEGER      REFERENCES admins(id) ON DELETE SET NULL,
  actor_label   VARCHAR(100),
  action        VARCHAR(64)  NOT NULL,
  target_type   VARCHAR(32),
  target_id     INTEGER,
  target_label  VARCHAR(64),
  ip            VARCHAR(64),
  success       BOOLEAN      NOT NULL DEFAULT TRUE,
  meta          JSONB
);

CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx ON audit_logs (actor_id);
