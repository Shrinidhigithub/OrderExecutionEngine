"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishOrderUpdate = publishOrderUpdate;
exports.subscribeOrderUpdates = subscribeOrderUpdates;
exports.redisHealthCheck = redisHealthCheck;
exports.initRedis = initRedis;
const ioredis_1 = __importDefault(require("ioredis"));
// Use environment variable if available; only fall back to localhost for local development
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
// Redis URL configured (logging suppressed for clean output)
const redisOpts = { maxRetriesPerRequest: null, connectTimeout: 5000 };
let pub = null;
let sub = null;
let redisReady = false;
let redisError = null;
let initPromise = null;
// Initialize Redis immediately and eagerly
function createRedisConnections() {
    if (pub && sub)
        return Promise.resolve();
    if (initPromise)
        return initPromise;
    initPromise = (async () => {
        try {
            pub = new ioredis_1.default(redisUrl, redisOpts);
            sub = new ioredis_1.default(redisUrl, redisOpts);
            // Set up error handlers that don't crash
            pub.on('error', (err) => {
                redisError = err?.message || String(err);
                console.warn('[Redis] Pub connection error:', redisError);
            });
            sub.on('error', (err) => {
                redisError = err?.message || String(err);
                console.warn('[Redis] Sub connection error:', redisError);
            });
            // Wait for connections to establish
            await Promise.race([
                Promise.all([pub.ping(), sub.ping()]),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timeout')), 5000))
            ]);
            redisReady = true;
            redisError = null;
        }
        catch (err) {
            redisError = err?.message || String(err);
            console.warn('[Redis] ✗ Connection failed:', redisError);
            redisReady = false;
            // Continue without Redis
        }
    })();
    return initPromise;
}
// Initialize immediately when module loads
createRedisConnections().catch(e => console.warn('[Redis] Init error:', e));
async function initRedis() {
    return createRedisConnections();
}
function publishOrderUpdate(orderId, payload) {
    if (!pub || !redisReady) {
        return Promise.resolve(0);
    }
    return pub.publish(`order:${orderId}`, JSON.stringify(payload)).catch(err => {
        console.error('[Redis] Publish error:', err);
        return 0;
    });
}
function subscribeOrderUpdates(orderId, onMessage) {
    if (!sub || !redisReady) {
        return () => { }; // Return a no-op unsubscribe function
    }
    const channel = `order:${orderId}`;
    const handler = (receivedChannel, message) => {
        // Only process messages for this specific channel
        if (receivedChannel !== channel)
            return;
        try {
            onMessage(JSON.parse(message));
        }
        catch (e) {
            console.error('Invalid message', e);
        }
    };
    sub.subscribe(channel).catch((err) => {
        console.error('[Redis] Subscribe error:', err);
    });
    sub.on('message', handler);
    return () => {
        sub?.unsubscribe(channel);
        sub?.removeListener('message', handler);
    };
}
// Redis health check
async function redisHealthCheck() {
    if (!pub || !redisReady) {
        return false;
    }
    try {
        const pong = await pub.ping();
        return pong === 'PONG';
    }
    catch {
        return false;
    }
}
