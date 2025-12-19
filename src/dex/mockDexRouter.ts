import { sleep } from '../utils/sleep';
import { v4 as uuidv4 } from 'uuid';

export interface DexQuote {
  price: number;
  fee: number;
}

export class MockDexRouter {
  basePrice = 100; // arbitrary base price for simulation

  async getRaydiumQuote(tokenIn: string, tokenOut: string, amount: number): Promise<DexQuote> {
    await sleep(200 + Math.random() * 100);
    const price = this.basePrice * (0.98 + Math.random() * 0.04);
    return { price, fee: 0.003 };
  }

  async getMeteoraQuote(tokenIn: string, tokenOut: string, amount: number): Promise<DexQuote> {
    await sleep(200 + Math.random() * 100);
    const price = this.basePrice * (0.97 + Math.random() * 0.05);
    return { price, fee: 0.002 };
  }

  async executeSwap(dex: 'raydium' | 'meteora', order: { id: string; tokenIn: string; tokenOut: string; amount: number }) {
    // Simulate execution delay
    await sleep(2000 + Math.random() * 1000);
    const finalPrice = this.basePrice * (0.98 + Math.random() * 0.04);
    return { txHash: uuidv4(), executedPrice: finalPrice };
  }
}
