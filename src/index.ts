import Fastify from 'fastify';
import websocketPlugin from '@fastify/websocket';
import { v4 as uuidv4 } from 'uuid';
import { orderQueue } from './queue/worker';
import { subscribeOrderUpdates, publishOrderUpdate, redisHealthCheck } from './utils/pubsub';
import { createOrder, initDb, dbHealthCheck } from './store/orderStore';
import { sleep } from './utils/sleep';
import { startWorker } from './queue/worker';

const PORT = Number(process.env.PORT || 3000);
const fastify = Fastify({ logger: true });

fastify.register(websocketPlugin as any);

// Root endpoint
fastify.get('/', async (request, reply) => {
  return { 
    service: 'Order Execution Engine',
    status: 'running',
    endpoints: {
      health: '/health',
      api: '/api/orders/execute (POST with WebSocket upgrade)',
      docs: 'See README.md for API documentation'
    }
  };
});

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  const result: any = { timestamp: new Date().toISOString() };
  try {
    await dbHealthCheck();
    result.database = 'ok';
  } catch (e) {
    result.database = 'error';
  }
  try {
    const ok = await redisHealthCheck();
    result.redis = ok ? 'ok' : 'error';
  } catch (e) {
    result.redis = 'error';
  }
  result.status = result.database === 'ok' && result.redis === 'ok' ? 'ok' : 'degraded';
  return result;
});

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
  try {
    console.log('=== Order Execution Engine Starting ===');
    console.log('PORT:', PORT);
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? '***set***' : '***not set***');
    console.log('REDIS_URL:', process.env.REDIS_URL ? '***set***' : '***not set***');
    
    // Initialize database with retries, but don't block the server startup forever
    console.log('Initializing database...');
    let dbReady = false;
    (async () => {
      try {
        await initDb();
        dbReady = true;
        console.log('✓ Database initialized successfully');
      } catch (err) {
        console.error('✗ Database initialization failed:', err);
        // Continue anyway - orders will fail but health endpoint will report the issue
      }
    })().catch(e => console.error('DB init task error:', e));
    
    // Start worker pool with error handling
    console.log('Starting worker pool...');
    try {
      startWorker(10);
      console.log('✓ Worker pool started with 10 concurrent workers');
    } catch (e) {
      console.warn('⚠ Worker pool startup warning:', (e as any)?.message || e);
      // Non-fatal: will retry on demand
    }
    
    console.log(`Starting Fastify server on port ${PORT}...`);
    await fastify.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`✓ Server listening on http://0.0.0.0:${PORT}`);
    console.log('=== Order Execution Engine Ready ===');
  } catch (error) {
    console.error('✗ Failed to start server:', error);
    // Don't exit - let Railway see the logs
    console.error('Attempting to continue despite startup error...');
  }
};

start().catch((e) => {
  console.error('✗ Fatal error during startup:', e);
  // Still try to exit gracefully
  setTimeout(() => process.exit(1), 1000);
});
