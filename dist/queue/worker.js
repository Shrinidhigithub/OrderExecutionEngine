"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.orderQueue = exports.orderQueueName = void 0;
exports.startWorker = startWorker;
const bullmq_1 = require("bullmq");
const ioredis_1 = __importDefault(require("ioredis"));
const mockDexRouter_1 = require("../dex/mockDexRouter");
const pubsub_1 = require("../utils/pubsub");
const orderStore_1 = require("../store/orderStore");
const sleep_1 = require("../utils/sleep");
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const connection = new ioredis_1.default(redisUrl, { maxRetriesPerRequest: null });
exports.orderQueueName = 'orders';
exports.orderQueue = new bullmq_1.Queue(exports.orderQueueName, { connection });
new bullmq_1.QueueScheduler(exports.orderQueueName, { connection });
const dex = new mockDexRouter_1.MockDexRouter();
// Delay between status updates (ms) - allows WebSocket clients to see each status
const STATUS_DELAY = Number(process.env.STATUS_DELAY) || 800;
// Initial delay before processing starts - gives client time to connect WebSocket
const INITIAL_DELAY = Number(process.env.INITIAL_DELAY) || 3000;
function startWorker(concurrency = 10) {
    const worker = new bullmq_1.Worker(exports.orderQueueName, async (job) => {
        const order = job.data;
        try {
            // Wait for client to connect WebSocket before starting
            await (0, sleep_1.sleep)(INITIAL_DELAY);
            // Status 1: PENDING - Order received and queued
            await (0, pubsub_1.publishOrderUpdate)(order.id, { status: 'pending' });
            await (0, orderStore_1.updateOrderStatus)(order.id, 'pending');
            await (0, sleep_1.sleep)(STATUS_DELAY);
            // Status 2: ROUTING - Comparing DEX prices
            await (0, pubsub_1.publishOrderUpdate)(order.id, { status: 'routing' });
            await (0, orderStore_1.updateOrderStatus)(order.id, 'routing');
            const rQuote = await dex.getRaydiumQuote(order.tokenIn, order.tokenOut, order.amount);
            const mQuote = await dex.getMeteoraQuote(order.tokenIn, order.tokenOut, order.amount);
            const chosen = rQuote.price <= mQuote.price ? 'raydium' : 'meteora';
            await (0, sleep_1.sleep)(STATUS_DELAY);
            // Status 3: BUILDING - Creating transaction
            await (0, pubsub_1.publishOrderUpdate)(order.id, { status: 'building', chosen, rQuote, mQuote });
            await (0, orderStore_1.updateOrderStatus)(order.id, 'building');
            await (0, sleep_1.sleep)(STATUS_DELAY);
            // Status 4: SUBMITTED - Transaction sent to network
            await (0, pubsub_1.publishOrderUpdate)(order.id, { status: 'submitted' });
            await (0, orderStore_1.updateOrderStatus)(order.id, 'submitted');
            await (0, sleep_1.sleep)(STATUS_DELAY);
            // Execute the swap
            const res = await dex.executeSwap(chosen, order);
            // Status 5: CONFIRMED - Transaction successful
            await (0, pubsub_1.publishOrderUpdate)(order.id, { status: 'confirmed', txHash: res.txHash, executedPrice: res.executedPrice });
            await (0, orderStore_1.updateOrderStatus)(order.id, 'confirmed', { txHash: res.txHash });
            return res;
        }
        catch (err) {
            const attempts = job.attemptsMade || 0;
            const msg = (err && err.message) || String(err);
            await (0, pubsub_1.publishOrderUpdate)(order.id, { status: 'failed', error: msg, attempts });
            await (0, orderStore_1.updateOrderStatus)(order.id, 'failed', { error: msg });
            throw err;
        }
    }, { connection, concurrency });
    worker.on('failed', (job, err) => {
        console.error('Job failed', job.id, err?.message);
    });
    return worker;
}
