ALTER TABLE contracts
  ADD COLUMN IF NOT EXISTS approval_number VARCHAR(20);
