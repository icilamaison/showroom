-- 계약서 수정 이력. 고객 서명은 그대로 두고 누가·언제·무엇을 바꿨는지 남긴다
CREATE TABLE IF NOT EXISTS contract_edits (
  id              SERIAL PRIMARY KEY,
  contract_id     INTEGER     NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  admin_id        INTEGER     REFERENCES admins(id),
  before_payload  JSONB       NOT NULL,
  after_payload   JSONB       NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contract_edits_contract_id_idx ON contract_edits (contract_id);
