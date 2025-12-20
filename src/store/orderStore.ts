import { Pool } from 'pg';
import { sleep } from '../utils/sleep';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/order_engine';

// Log which DB URL we're using for debugging
if (process.env.NODE_ENV !== 'test') {
  const displayUrl = connectionString.includes('127.0.0.1')
    ? '127.0.0.1:5432 (local)'
    : connectionString.replace(/:[^:]*@/, ':***@');
  console.log(`[Database] Configured URL: ${displayUrl}`);
}

const pool = new Pool({ 
  connectionString,
  // Increase connection timeout for hosting platforms
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20
});

export async function initDb(retries = 30, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[DB] Attempt ${attempt}/${retries}: Connecting to database...`);
      await pool.query(`
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
      `);
      console.log(`[DB] ✓ Connected and table initialized`);
      return true;
    } catch (err: any) {
      const code = err?.code || err?.errno || err?.message || 'unknown';
      console.error(`[DB] ✗ Attempt ${attempt}/${retries} failed:`, code);
      if (attempt === retries) {
        console.error(`[DB] ✗ Max retries reached. Connection string may be invalid.`);
        throw err;
      }
      console.log(`[DB] Waiting ${delayMs}ms before retry...`);
      await sleep(delayMs);
    }
  }
}

export async function createOrder(record: { id: string; tokenIn: string; tokenOut: string; amount: number; status: string }) {
  const q = `INSERT INTO orders (id, token_in, token_out, amount, status) VALUES ($1,$2,$3,$4,$5)`;
  await pool.query(q, [record.id, record.tokenIn, record.tokenOut, record.amount, record.status]);
}

export async function updateOrderStatus(id: string, status: string, extra?: { txHash?: string; error?: string }) {
  const q = `UPDATE orders SET status=$1, tx_hash=$2, error=$3, updated_at=now() WHERE id=$4`;
  await pool.query(q, [status, extra?.txHash || null, extra?.error || null, id]);
}

export async function getOrder(id: string) {
  const r = await pool.query('SELECT * FROM orders WHERE id=$1', [id]);
  return r.rows[0];
}

// Simple DB health check: runs a lightweight query
export async function dbHealthCheck() {
  await pool.query('SELECT 1');
  return true;
}
