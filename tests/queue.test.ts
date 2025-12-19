import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { orderQueue, startWorker } from '../src/queue/worker';
import IORedis from 'ioredis';

let worker: any;

beforeAll(() => {
  worker = startWorker(2);
});

afterAll(async () => {
  await orderQueue.close();
  if (worker) await worker.close();
});

describe('Order Queue', () => {
  it('queue has name orders', async () => {
    expect(orderQueue.name).toBe('orders');
  });

  it('processes a job and returns result', async () => {
    const job = await orderQueue.add('test', { id: 'job-1', tokenIn: 'A', tokenOut: 'B', amount: 1 }, { removeOnComplete: true });
    expect(job).toBeDefined();
    expect(job.id).toBeDefined();
    expect(job.data).toEqual({ id: 'job-1', tokenIn: 'A', tokenOut: 'B', amount: 1 });
  }, 20000);
});
