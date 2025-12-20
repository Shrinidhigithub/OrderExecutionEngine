import { Worker, Queue, QueueScheduler, Job } from 'bullmq';
import IORedis from 'ioredis';
import { MockDexRouter } from '../dex/mockDexRouter';
import { publishOrderUpdate } from '../utils/pubsub';
import { updateOrderStatus } from '../store/orderStore';
import { sleep } from '../utils/sleep';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
export const orderQueueName = 'orders';
export const orderQueue = new Queue(orderQueueName, { connection });
new QueueScheduler(orderQueueName, { connection });

const dex = new MockDexRouter();

// Delay between status updates (ms) - allows WebSocket clients to see each status
const STATUS_DELAY = Number(process.env.STATUS_DELAY) || 800;
// Initial delay before processing starts - gives client time to connect WebSocket
const INITIAL_DELAY = Number(process.env.INITIAL_DELAY) || 3000;

export function startWorker(concurrency = 10) {
  const worker = new Worker(
    orderQueueName,
    async (job: Job) => {
      const order = job.data as any;
      try {
        // Wait for client to connect WebSocket before starting
        console.log(`[Order ${order.id}] Waiting ${INITIAL_DELAY}ms for WebSocket connection...`);
        await sleep(INITIAL_DELAY);

        // Status 1: PENDING - Order received and queued
        await publishOrderUpdate(order.id, { status: 'pending' });
        await updateOrderStatus(order.id, 'pending');
        await sleep(STATUS_DELAY);

        // Status 2: ROUTING - Comparing DEX prices
        await publishOrderUpdate(order.id, { status: 'routing' });
        await updateOrderStatus(order.id, 'routing');
        const rQuote = await dex.getRaydiumQuote(order.tokenIn, order.tokenOut, order.amount);
        const mQuote = await dex.getMeteoraQuote(order.tokenIn, order.tokenOut, order.amount);
        const chosen = rQuote.price <= mQuote.price ? 'raydium' : 'meteora';
        await sleep(STATUS_DELAY);

        // Status 3: BUILDING - Creating transaction
        await publishOrderUpdate(order.id, { status: 'building', chosen, rQuote, mQuote });
        await updateOrderStatus(order.id, 'building');
        await sleep(STATUS_DELAY);

        // Status 4: SUBMITTED - Transaction sent to network
        await publishOrderUpdate(order.id, { status: 'submitted' });
        await updateOrderStatus(order.id, 'submitted');
        await sleep(STATUS_DELAY);

        // Execute the swap
        const res = await dex.executeSwap(chosen as any, order);

        // Status 5: CONFIRMED - Transaction successful
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
