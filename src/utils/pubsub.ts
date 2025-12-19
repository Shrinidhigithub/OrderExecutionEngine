import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';
const redisOpts = { maxRetriesPerRequest: null } as const;
const pub = new IORedis(redisUrl, redisOpts);
const sub = new IORedis(redisUrl, redisOpts);

export function publishOrderUpdate(orderId: string, payload: any) {
  return pub.publish(`order:${orderId}`, JSON.stringify(payload));
}

export function subscribeOrderUpdates(orderId: string, onMessage: (msg: any) => void) {
  const channel = `order:${orderId}`;
  const handler = (_: string, message: string) => {
    try {
      onMessage(JSON.parse(message));
    } catch (e) {
      console.error('Invalid message', e);
    }
  };
  // Attempt subscription and surface errors so callers can see failures quickly
  sub.subscribe(channel).catch((err) => {
    console.error('Redis subscribe error for', channel, err);
  });
  sub.on('message', handler);
  return () => {
    sub.unsubscribe(channel);
    sub.removeListener('message', handler);
  };
}
