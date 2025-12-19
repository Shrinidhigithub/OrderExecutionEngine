import { describe, it, expect } from 'vitest';
import { sleep } from '../src/utils/sleep';
import { chooseBetterDex } from '../src/dex/router';
import { MockDexRouter } from '../src/dex/mockDexRouter';

describe('Misc utilities and router', () => {
  it('sleep waits approximately given time', async () => {
    const t0 = Date.now();
    await sleep(50);
    const t1 = Date.now();
    expect(t1 - t0).toBeGreaterThanOrEqual(45);
  });

  it('chooseBetterDex picks raydium when price lower', () => {
    const r = { price: 90 };
    const m = { price: 95 };
    expect(chooseBetterDex(r, m)).toBe('raydium');
  });

  it('chooseBetterDex picks meteora when lower', () => {
    const r = { price: 105 };
    const m = { price: 100 };
    expect(chooseBetterDex(r, m)).toBe('meteora');
  });

  it('MockDexRouter shows variance across multiple samples', async () => {
    const dex = new MockDexRouter();
    const results = [] as number[];
    for (let i = 0; i < 8; i++) {
      const q = await dex.getRaydiumQuote('A', 'B', 1);
      results.push(q.price);
    }
    const unique = new Set(results.map((r) => Math.round(r)));
    expect(unique.size).toBeGreaterThan(1);
  });
});
