import { describe, it, expect } from 'vitest';
import { MockDexRouter } from '../src/dex/mockDexRouter';

describe('MockDexRouter', () => {
  const dex = new MockDexRouter();

  it('returns raydium quote in expected range', async () => {
    const q = await dex.getRaydiumQuote('A', 'B', 1);
    expect(q.price).toBeGreaterThan(90);
    expect(q.price).toBeLessThan(110);
    expect(q.fee).toBeCloseTo(0.003);
  });

  it('returns meteora quote in expected range', async () => {
    const q = await dex.getMeteoraQuote('A', 'B', 1);
    expect(q.price).toBeGreaterThan(90);
    expect(q.price).toBeLessThan(110);
    expect(q.fee).toBeCloseTo(0.002);
  });

  it('executeSwap returns txHash and executedPrice', async () => {
    const res = await dex.executeSwap('raydium', { id: '1', tokenIn: 'A', tokenOut: 'B', amount: 1 });
    expect(res.txHash).toBeTruthy();
    expect(res.executedPrice).toBeGreaterThan(90);
  });
});
