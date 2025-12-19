CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  token_in TEXT,
  token_out TEXT,
  amount NUMERIC,
  status TEXT,
  tx_hash TEXT NULL,
  error TEXT NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
