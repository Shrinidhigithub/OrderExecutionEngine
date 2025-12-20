import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisOpts = { maxRetriesPerRequest: null } as const;
let pub: IORedis | null = null;
let sub: IORedis | null = null;
let redisReady = false;
let redisError: string | null = null;
let initPromise: Promise<void> | null = null;

// Initialize Redis immediately and eagerly
function createRedisConnections() {
  if (pub && sub) return Promise.resolve();
  if (initPromise) return initPromise;
  
  initPromise = (async () => {
    try {
      pub = new IORedis(redisUrl, redisOpts);
      sub = new IORedis(redisUrl, redisOpts);
      
      // Set up error handlers that don't crash
      pub.on('error', (err) => {
        redisError = (err as any)?.message || String(err);
        console.warn('[Redis] Pub connection error:', redisError);
      });
      sub.on('error', (err) => {
        redisError = (err as any)?.message || String(err);
        console.warn('[Redis] Sub connection error:', redisError);
      });
      
      // Wait for connections to establish
      await Promise.race([
        Promise.all([pub.ping(), sub.ping()]),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timeout')), 5000))
      ]);
      
      redisReady = true;
      redisError = null;
      console.log('[Redis] ✓ Connected');
    } catch (err) {
      redisError = (err as any)?.message || String(err);
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

export function publishOrderUpdate(orderId: string, payload: any) {
  if (!pub || !redisReady) {
    console.warn(`[Redis] Not connected, skipping publish for order ${orderId}`);
    return Promise.resolve(0);
  }
  return pub.publish(`order:${orderId}`, JSON.stringify(payload)).catch(err => {
    console.error('[Redis] Publish error:', err);
    return 0;
  });
}

export function subscribeOrderUpdates(orderId: string, onMessage: (msg: any) => void) {
  if (!sub || !redisReady) {
    console.warn(`[Redis] Not connected, subscriptions won't work for ${orderId}`);
    return () => {}; // Return a no-op unsubscribe function
  }
  const channel = `order:${orderId}`;
  const handler = (_: string, message: string) => {
    try {
      onMessage(JSON.parse(message));
    } catch (e) {
      console.error('Invalid message', e);
    }
  };
  sub.subscribe(channel).catch((err) => {
    console.error('[Redis] Subscribe error for', channel, err);
  });
  sub.on('message', handler);
  return () => {
    sub?.unsubscribe(channel);
    sub?.removeListener('message', handler);
  };
}

// Redis health check
export async function redisHealthCheck() {
  if (!pub || !redisReady) {
    return false;
  }
  try {
    const pong = await pub.ping();
    return pong === 'PONG';
  } catch {
    return false;
  }
}

// Export for startup initialization
export { initRedis };
