CREATE TABLE IF NOT EXISTS contracts (
  id                  SERIAL PRIMARY KEY,
  contract_number     VARCHAR(30)   NOT NULL UNIQUE,
  customer_name       VARCHAR(50)   NOT NULL,
  customer_phone      VARCHAR(20)   NOT NULL,
  customer_address    TEXT          NOT NULL,
  product_name        VARCHAR(100)  NOT NULL,
  contract_amount     NUMERIC(12,2) NOT NULL,
  contract_start_date DATE          NOT NULL,
  contract_end_date   DATE          NOT NULL,
  special_terms       TEXT,
  terms_agreed        BOOLEAN       NOT NULL DEFAULT FALSE,
  signature_name      VARCHAR(50)   NOT NULL,
  status              VARCHAR(20)   NOT NULL DEFAULT 'SUBMITTED',
  payload             JSONB         NOT NULL,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT contracts_status_check CHECK (
    status IN ('SUBMITTED', 'REVIEWING', 'CONFIRMED', 'CANCELED')
  )
);

CREATE INDEX IF NOT EXISTS idx_contracts_customer_name ON contracts (customer_name);
CREATE INDEX IF NOT EXISTS idx_contracts_customer_phone ON contracts (customer_phone);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts (status);
CREATE INDEX IF NOT EXISTS idx_contracts_created_at ON contracts (created_at DESC);
