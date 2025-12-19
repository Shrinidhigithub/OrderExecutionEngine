import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createOrder, updateOrderStatus, getOrder, initDb } from '../src/store/orderStore';
import { OrderStatus } from '../src/types';

// Generate unique ID with timestamp to avoid conflicts
const uniqueId = () => `db-test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

describe('Order Store - Database Operations', () => {
  beforeAll(async () => {
    await initDb();
  });

  it('creates order in database', async () => {
    const id = uniqueId();
    const order = {
      id,
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 100,
      status: 'pending' as OrderStatus,
    };
    await createOrder(order);
    const retrieved = await getOrder(id);
    expect(retrieved).toBeDefined();
    expect(retrieved.token_in).toBe('SOL');
    expect(retrieved.token_out).toBe('USDC');
    expect(Number(retrieved.amount)).toBe(100);
  });

  it('updates order status', async () => {
    const id = uniqueId();
    const order = {
      id,
      tokenIn: 'RAY',
      tokenOut: 'COPE',
      amount: 50,
      status: 'pending' as OrderStatus,
    };
    await createOrder(order);

    // Update to routing
    await updateOrderStatus(id, 'routing');
    let retrieved = await getOrder(id);
    expect(retrieved.status).toBe('routing');

    // Update to confirmed with txHash
    await updateOrderStatus(id, 'confirmed', { txHash: 'hash123' });
    retrieved = await getOrder(id);
    expect(retrieved.status).toBe('confirmed');
    expect(retrieved.tx_hash).toBe('hash123');
  });

  it('stores error message on failure', async () => {
    const id = uniqueId();
    const order = {
      id,
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 10,
      status: 'pending' as OrderStatus,
    };
    await createOrder(order);

    const errorMsg = 'Insufficient liquidity for swap';
    await updateOrderStatus(id, 'failed', { error: errorMsg });
    const retrieved = await getOrder(id);
    expect(retrieved.status).toBe('failed');
    expect(retrieved.error).toBe(errorMsg);
  });

  it('order lifecycle transitions correctly', async () => {
    const id = uniqueId();
    const order = {
      id,
      tokenIn: 'USDC',
      tokenOut: 'USDT',
      amount: 500,
      status: 'pending' as OrderStatus,
    };
    await createOrder(order);

    const statuses: OrderStatus[] = ['pending', 'routing', 'building', 'submitted', 'confirmed'];
    for (const status of statuses) {
      await updateOrderStatus(id, status);
      const retrieved = await getOrder(id);
      expect(retrieved.status).toBe(status);
    }
  });

  it('handles concurrent order creation', async () => {
    const baseId = uniqueId();
    const orders = Array.from({ length: 5 }, (_, i) => ({
      id: `${baseId}-${i}`,
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 10 * (i + 1),
      status: 'pending' as OrderStatus,
    }));

    // Create all concurrently
    await Promise.all(orders.map((o) => createOrder(o)));

    // Verify all created
    for (let i = 0; i < 5; i++) {
      const retrieved = await getOrder(`${baseId}-${i}`);
      expect(retrieved).toBeDefined();
      expect(Number(retrieved.amount)).toBe(10 * (i + 1));
    }
  });
});
