import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { publishOrderUpdate, subscribeOrderUpdates } from '../src/utils/pubsub';
import IORedis from 'ioredis';

describe('WebSocket & PubSub Lifecycle', () => {
  it('publishes order update to Redis channel', async () => {
    const orderId = 'test-order-ws-1';
    const redis = new IORedis({ maxRetriesPerRequest: null });
    
    let messageReceived = false;
    let receivedData: any = null;

    subscribeOrderUpdates(orderId, (msg) => {
      messageReceived = true;
      receivedData = msg;
    });

    // Give subscription time to connect
    await new Promise((r) => setTimeout(r, 100));

    // Publish an update
    const testPayload = { status: 'routing', test: true };
    await publishOrderUpdate(orderId, testPayload);

    // Give message time to propagate
    await new Promise((r) => setTimeout(r, 200));

    expect(messageReceived).toBe(true);
    expect(receivedData).toEqual(testPayload);

    await redis.quit();
  });

  it('handles multiple subscribers to same order', async () => {
    const orderId = 'test-order-multi-sub';
    const messages1: any[] = [];
    const messages2: any[] = [];

    const unsub1 = subscribeOrderUpdates(orderId, (msg) => messages1.push(msg));
    const unsub2 = subscribeOrderUpdates(orderId, (msg) => messages2.push(msg));

    await new Promise((r) => setTimeout(r, 100));

    const testPayload = { status: 'confirmed' };
    await publishOrderUpdate(orderId, testPayload);

    await new Promise((r) => setTimeout(r, 200));

    expect(messages1.length).toBeGreaterThan(0);
    expect(messages2.length).toBeGreaterThan(0);

    unsub1();
    unsub2();
  });

  it('order update includes all required fields', async () => {
    const orderId = 'test-order-fields';
    let receivedData: any = null;

    subscribeOrderUpdates(orderId, (msg) => {
      receivedData = msg;
    });

    await new Promise((r) => setTimeout(r, 100));

    const completePayload = {
      status: 'confirmed',
      txHash: 'abc123xyz',
      executedPrice: 99.5,
      dex: 'raydium',
    };
    await publishOrderUpdate(orderId, completePayload);

    await new Promise((r) => setTimeout(r, 200));

    expect(receivedData).toHaveProperty('status', 'confirmed');
    expect(receivedData).toHaveProperty('txHash', 'abc123xyz');
    expect(receivedData).toHaveProperty('executedPrice', 99.5);
  });
});
