import { Worker, Queue, QueueScheduler, Job } from 'bullmq';
import IORedis from 'ioredis';
import { MockDexRouter } from '../dex/mockDexRouter';
import { publishOrderUpdate } from '../utils/pubsub';
import { updateOrderStatus } from '../store/orderStore';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
export const orderQueueName = 'orders';
export const orderQueue = new Queue(orderQueueName, { connection });
new QueueScheduler(orderQueueName, { connection });

const dex = new MockDexRouter();

export function startWorker(concurrency = 10) {
  const worker = new Worker(
    orderQueueName,
    async (job: Job) => {
      const order = job.data as any;
      try {
        await publishOrderUpdate(order.id, { status: 'pending' });
        await updateOrderStatus(order.id, 'pending');

        await publishOrderUpdate(order.id, { status: 'routing' });
        await updateOrderStatus(order.id, 'routing');
        const rQuote = await dex.getRaydiumQuote(order.tokenIn, order.tokenOut, order.amount);
        const mQuote = await dex.getMeteoraQuote(order.tokenIn, order.tokenOut, order.amount);
        const chosen = rQuote.price <= mQuote.price ? 'raydium' : 'meteora';

        await publishOrderUpdate(order.id, { status: 'building', chosen, rQuote, mQuote });
        await updateOrderStatus(order.id, 'building');

        await publishOrderUpdate(order.id, { status: 'submitted' });
        await updateOrderStatus(order.id, 'submitted');

        const res = await dex.executeSwap(chosen as any, order);

        await publishOrderUpdate(order.id, { status: 'confirmed', txHash: res.txHash, executedPrice: res.executedPrice });
        await updateOrderStatus(order.id, 'confirmed', { txHash: res.txHash });
        return res;
      } catch (err: any) {
        const attempts = job.attemptsMade || 0;
        const msg = (err && err.message) || String(err);
        await publishOrderUpdate(order.id, { status: 'failed', error: msg, attempts });
        await updateOrderStatus(order.id, 'failed', { error: msg });
        throw err;
      }
    },
    { connection, concurrency }
  );

  worker.on('failed', (job, err) => {
    console.error('Job failed', job.id, err?.message);
  });

  return worker;
}
