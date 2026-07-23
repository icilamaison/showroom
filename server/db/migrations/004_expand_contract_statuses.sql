ALTER TABLE contracts
  DROP CONSTRAINT IF EXISTS contracts_status_check;

ALTER TABLE contracts
  ADD CONSTRAINT contracts_status_check CHECK (
    status IN (
      'DRAFTING', 'SUBMITTED', 'REVIEWING', 'ON_HOLD',
      'CONFIRMED', 'CANCEL_PENDING', 'CANCELED'
    )
  );
