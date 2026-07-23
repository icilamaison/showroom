ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS view_token VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contracts_view_token ON contracts (view_token);
