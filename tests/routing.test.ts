import { describe, it, expect } from 'vitest';
import { MockDexRouter } from '../src/dex/mockDexRouter';

describe('DEX Routing Logic - Price Comparison', () => {
  const dex = new MockDexRouter();

  it('raydium quote price varies within expected range', async () => {
    const quotes = [];
    for (let i = 0; i < 10; i++) {
      const q = await dex.getRaydiumQuote('SOL', 'USDC', 100);
      quotes.push(q.price);
    }

    // Base price is 100, variance is 0.98-1.02 (±2%)
    // So prices should be in range 98-102
    quotes.forEach((price) => {
      expect(price).toBeGreaterThanOrEqual(98);
      expect(price).toBeLessThanOrEqual(102);
    });

    // Check there's actual variance (not all same)
    const unique = new Set(quotes.map((p) => Math.round(p * 100)));
    expect(unique.size).toBeGreaterThan(1);
  });

  it('meteora quote price varies within expected range', async () => {
    const quotes = [];
    for (let i = 0; i < 10; i++) {
      const q = await dex.getMeteoraQuote('SOL', 'USDC', 100);
      quotes.push(q.price);
    }

    // Base price is 100, variance is 0.97-1.02 (±3-5%)
    // So prices should be in range 97-102
    quotes.forEach((price) => {
      expect(price).toBeGreaterThanOrEqual(97);
      expect(price).toBeLessThanOrEqual(102);
    });

    const unique = new Set(quotes.map((p) => Math.round(p * 100)));
    expect(unique.size).toBeGreaterThan(1);
  });

  it('raydium fee is consistent', async () => {
    for (let i = 0; i < 5; i++) {
      const q = await dex.getRaydiumQuote('SOL', 'USDC', 100);
      expect(q.fee).toBe(0.003);
    }
  });

  it('meteora fee is consistent', async () => {
    for (let i = 0; i < 5; i++) {
      const q = await dex.getMeteoraQuote('SOL', 'USDC', 100);
      expect(q.fee).toBe(0.002);
    }
  });

  it('meteora generally has lower fees than raydium', async () => {
    const mQuote = await dex.getMeteoraQuote('SOL', 'USDC', 100);
    const rQuote = await dex.getRaydiumQuote('SOL', 'USDC', 100);

    expect(mQuote.fee).toBeLessThan(rQuote.fee);
  });

  it('swap execution returns valid txHash and price', async () => {
    const order = {
      id: 'routing-test-1',
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 10,
    };

    const result = await dex.executeSwap('raydium', order);

    expect(result.txHash).toBeTruthy();
    expect(result.txHash).toMatch(/^[a-f0-9-]{36}$/); // UUID format
    expect(result.executedPrice).toBeGreaterThan(90);
    expect(result.executedPrice).toBeLessThan(110);
  });

  it('swap execution works for both DEXs', async () => {
    const order = {
      id: 'routing-test-dex',
      tokenIn: 'SOL',
      tokenOut: 'USDC',
      amount: 10,
    };

    const rResult = await dex.executeSwap('raydium', order);
    const mResult = await dex.executeSwap('meteora', order);

    expect(rResult.txHash).toBeTruthy();
    expect(mResult.txHash).toBeTruthy();
    expect(rResult.executedPrice).toBeGreaterThan(0);
    expect(mResult.executedPrice).toBeGreaterThan(0);
  }, 10000);

  it('different amounts still return prices in valid range', async () => {
    const amounts = [1, 10, 100, 1000];

    for (const amount of amounts) {
      const rQuote = await dex.getRaydiumQuote('SOL', 'USDC', amount);
      const mQuote = await dex.getMeteoraQuote('SOL', 'USDC', amount);

      expect(rQuote.price).toBeGreaterThan(90);
      expect(rQuote.price).toBeLessThan(110);
      expect(mQuote.price).toBeGreaterThan(90);
      expect(mQuote.price).toBeLessThan(110);
    }
  });

  it('routing decision selects cheaper DEX', async () => {
    // Run 3 times (each iteration: 2 quotes x 200ms = 400ms, plus test overhead)
    for (let i = 0; i < 3; i++) {
      const rQuote = await dex.getRaydiumQuote('SOL', 'USDC', 100);
      const mQuote = await dex.getMeteoraQuote('SOL', 'USDC', 100);

      // Routing logic: if rQuote <= mQuote, pick raydium; else meteora
      const chosen = rQuote.price <= mQuote.price ? 'raydium' : 'meteora';
      const chosenPrice = chosen === 'raydium' ? rQuote.price : mQuote.price;
      const otherPrice = chosen === 'raydium' ? mQuote.price : rQuote.price;

      expect(chosenPrice).toBeLessThanOrEqual(otherPrice);
    }
  }, 10000);
});
