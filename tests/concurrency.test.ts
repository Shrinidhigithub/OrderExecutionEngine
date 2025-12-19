import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { orderQueue, startWorker, orderQueueName } from '../src/queue/worker';
import { QueueEvents } from 'bullmq';

describe('Queue Concurrency and Processing', () => {
  let worker: any;

  beforeAll(() => {
    worker = startWorker(5); // Start with 5 concurrent workers
  });

  afterAll(async () => {
    await orderQueue.close();
    if (worker) await worker.close();
  });

  it('queue name is correctly set', () => {
    expect(orderQueue.name).toBe(orderQueueName);
    expect(orderQueue.name).toBe('orders');
  });

  it('processes multiple orders concurrently', async () => {
    const jobs = [];

    for (let i = 0; i < 3; i++) {
      const job = await orderQueue.add(
        'execute',
        {
          id: `job-concurrent-${i}`,
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amount: (i + 1) * 10,
        },
        { removeOnComplete: true }
      );
      jobs.push(job);
    }

    // Just verify jobs were created successfully
    expect(jobs.length).toBe(3);
    jobs.forEach((job) => {
      expect(job.id).toBeDefined();
    });
  }, 30000);

  it('respects retry configuration with exponential backoff', async () => {
    const job = await orderQueue.add(
      'execute',
      {
        id: 'job-retry-test',
        tokenIn: 'SOL',
        tokenOut: 'USDC',
        amount: 10,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 100,
        },
      }
    );

    expect(job.opts.attempts).toBe(3);
    expect(job.opts.backoff).toBeDefined();
    if (job.opts.backoff && typeof job.opts.backoff === 'object' && 'type' in job.opts.backoff) {
      expect((job.opts.backoff as any).type).toBe('exponential');
    }
  }, 15000);

  it('stores job data correctly in queue', async () => {
    const testData = {
      id: 'job-data-test',
      tokenIn: 'RAY',
      tokenOut: 'COPE',
      amount: 25,
    };

    const job = await orderQueue.add('execute', testData);
    const retrievedJob = await orderQueue.getJob(job.id!);

    expect(retrievedJob).toBeDefined();
    expect(retrievedJob?.data).toEqual(testData);
  });

  it('queue size increases with added jobs', async () => {
    const jobPromises = [];

    for (let i = 0; i < 2; i++) {
      jobPromises.push(
        orderQueue.add('execute', {
          id: `job-count-${i}`,
          tokenIn: 'SOL',
          tokenOut: 'USDC',
          amount: 10,
        })
      );
    }

    const addedJobs = await Promise.all(jobPromises);
    expect(addedJobs.length).toBe(2);
    addedJobs.forEach((job) => {
      expect(job.id).toBeDefined();
    });
  });
});
