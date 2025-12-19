import Fastify from 'fastify';
import websocketPlugin from '@fastify/websocket';
import { v4 as uuidv4 } from 'uuid';
import { orderQueue } from './queue/worker';
import { subscribeOrderUpdates, publishOrderUpdate } from './utils/pubsub';
import { createOrder, initDb } from './store/orderStore';
import { startWorker } from './queue/worker';

const PORT = Number(process.env.PORT || 3000);
const fastify = Fastify({ logger: true });

fastify.register(websocketPlugin as any);

fastify.post('/api/orders/execute', async (request, reply) => {
  const body = request.body as any;
  if (!body || !body.tokenIn || !body.tokenOut || !body.amount) {
    return reply.status(400).send({ error: 'Invalid order payload' });
  }
  const id = uuidv4();
  const order = { id, tokenIn: body.tokenIn, tokenOut: body.tokenOut, amount: Number(body.amount), status: 'pending' } as any;
  await createOrder(order);
  await orderQueue.add('execute', order, { attempts: 3, backoff: { type: 'exponential', delay: 500 } });
  // Inform client how to subscribe (we also accept websocket upgrade on same path)
  return reply.send({ orderId: id, websocket: `/api/orders/execute?orderId=${id}` });
});

fastify.get('/api/orders/execute', { websocket: true }, (connection, req) => {
  const remote = (req as any).ip || (req as any).socket?.remoteAddress || 'unknown';
  fastify.log.info({ url: req.url, remote }, 'WebSocket connection attempt');
  // Fastify may not have parsed `req.query` for websocket upgrades, parse safely from the URL
  let orderId: string | undefined;
  try {
    const url = (req as any).url || '';
    const parsed = new URL(url, 'http://localhost');
    orderId = parsed.searchParams.get('orderId') || undefined;
  } catch (e) {
    // fallback to any available parsed query
    orderId = ((req as any).query && (req as any).query.orderId) as string | undefined;
  }
  // If client provided orderId we subscribe to updates; else expecting first message with order payload
  let unsubscribe: (() => void) | null = null;
  try {
    if (orderId) {
      // subscribeOrderUpdates handles async subscribe errors internally and logs them
      unsubscribe = subscribeOrderUpdates(orderId, (msg) => {
        try {
          connection.socket.send(JSON.stringify(msg));
        } catch (e) {
          fastify.log.warn({ err: e }, 'Failed to send WS message');
        }
      });
    }
  } catch (err) {
    fastify.log.error({ err }, 'Error subscribing to Redis channel during WS upgrade');
    try {
      connection.socket.send(JSON.stringify({ status: 'failed', error: 'subscription error' }));
    } catch (_) {}
    try { connection.socket.close(); } catch (_) {}
    return;
  }

  // log socket errors so we can see failures that might cause 500s
  connection.socket.on('error', (err: any) => {
    fastify.log.error({ err }, 'WebSocket socket error');
  });

  connection.socket.on('message', async (raw: any) => {
    try {
      const data = JSON.parse(String(raw));
      if (data && data.tokenIn && data.tokenOut && data.amount) {
        const id = uuidv4();
        const order = { id, tokenIn: data.tokenIn, tokenOut: data.tokenOut, amount: Number(data.amount), status: 'pending' } as any;
        await createOrder(order);
        await orderQueue.add('execute', order, { attempts: 3, backoff: { type: 'exponential', delay: 500 } });
        connection.socket.send(JSON.stringify({ orderId: id }));
        const unsub = subscribeOrderUpdates(id, (msg) => {
          try {
            connection.socket.send(JSON.stringify(msg));
          } catch (e) {
            fastify.log.warn({ err: e }, 'Failed to send WS message for new order');
          }
        });
        connection.socket.on('close', () => unsub());
      } else {
        connection.socket.send(JSON.stringify({ status: 'failed', error: 'invalid payload' }));
      }
    } catch (e) {
      fastify.log.warn({ err: e }, 'Invalid WS payload');
      try {
        connection.socket.send(JSON.stringify({ status: 'failed', error: 'invalid payload' }));
      } catch (_) {}
    }
  });

  connection.socket.on('close', () => {
    if (unsubscribe) unsubscribe();
  });
});

const start = async () => {
  await initDb();
  startWorker(10);
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
};

start().catch((e) => {
  console.error(e);
  process.exit(1);
});
