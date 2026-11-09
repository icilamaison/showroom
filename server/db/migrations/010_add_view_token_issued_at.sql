-- 고객용 계약서 링크 유효기간(발급일 + 90일) 계산용. 재발급하면 새 토큰과 함께 갱신된다.
-- 기존 계약서는 작성일을 발급일로 본다. DEFAULT는 기존 행 채운 뒤에 걸어 기존 행이 now()로 채워지지 않게 한다
ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS view_token_issued_at TIMESTAMPTZ;

UPDATE contracts
  SET view_token_issued_at = created_at
  WHERE view_token_issued_at IS NULL;

ALTER TABLE contracts
  ALTER COLUMN view_token_issued_at SET DEFAULT now();
