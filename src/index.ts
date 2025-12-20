import Fastify from 'fastify';
import websocketPlugin from '@fastify/websocket';
import { v4 as uuidv4 } from 'uuid';
import { orderQueue } from './queue/worker';
import { subscribeOrderUpdates, publishOrderUpdate, redisHealthCheck, initRedis } from './utils/pubsub';
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

// WebSocket routes need to be registered inside a plugin
fastify.register(async function(fastify) {
  fastify.get('/api/orders/execute', { websocket: true }, (connection, req) => {
    // connection is SocketStream (Duplex stream with .socket = WebSocket)
    // req is the Fastify request
    const ws = (connection as any).socket;
    
    if (!ws || typeof ws.send !== 'function') {
      console.error('[WS] No WebSocket found on connection.socket');
      return;
    }
    
    const remote = req.ip || 'unknown';
    const rawUrl = req.url || '';
    
    fastify.log.info({ url: rawUrl, remote }, 'WebSocket connection');
    
    // Parse orderId from query params
    const orderId = (req.query as any)?.orderId;
    
    // If client provided orderId we subscribe to updates
    let unsubscribe: (() => void) | null = null;
    if (orderId) {
      unsubscribe = subscribeOrderUpdates(orderId, (msg) => {
        try {
          ws.send(JSON.stringify(msg));
        } catch (e) {
          fastify.log.warn({ err: e }, 'Failed to send WS message');
        }
      });
    }
    
    // Log socket errors
    ws.on('error', (err: any) => {
      fastify.log.error({ err }, 'WebSocket error');
    });
    
    // Handle incoming messages (for submitting new orders via WS)
    ws.on('message', async (raw: any) => {
      try {
        const data = JSON.parse(String(raw));
        if (data && data.tokenIn && data.tokenOut && data.amount) {
          const id = uuidv4();
          const order = { id, tokenIn: data.tokenIn, tokenOut: data.tokenOut, amount: Number(data.amount), status: 'pending' } as any;
          await createOrder(order);
          await orderQueue.add('execute', order, { attempts: 3, backoff: { type: 'exponential', delay: 500 } });
          ws.send(JSON.stringify({ orderId: id }));
          const unsub = subscribeOrderUpdates(id, (msg) => {
            try {
              ws.send(JSON.stringify(msg));
            } catch (e) {
              fastify.log.warn({ err: e }, 'Failed to send WS message');
            }
          });
          ws.on('close', () => unsub());
        } else {
          ws.send(JSON.stringify({ status: 'failed', error: 'invalid payload' }));
        }
      } catch (e) {
        fastify.log.warn({ err: e }, 'Invalid WS payload');
        try {
          ws.send(JSON.stringify({ status: 'failed', error: 'invalid payload' }));
        } catch (_) {}
      }
    });
    
    ws.on('close', () => {
      if (unsubscribe) unsubscribe();
    });
  });
});

const start = async () => {
  try {
    console.log('=== Order Execution Engine Starting ===');
    console.log('PORT:', PORT);
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✓ set' : '✗ NOT SET - using localhost');
    console.log('REDIS_URL:', process.env.REDIS_URL ? '✓ set' : '✗ NOT SET - using localhost');
    
    if (!process.env.DATABASE_URL && process.env.NODE_ENV === 'production') {
      console.error('⚠ WARNING: DATABASE_URL not set in production environment!');
      console.error('  Trying to use default postgresql://127.0.0.1:5432 which will fail.');
      console.error('  Please set DATABASE_URL environment variable.');
    }
    if (!process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
      console.error('⚠ WARNING: REDIS_URL not set in production environment!');
      console.error('  Trying to use default redis://127.0.0.1:6379 which will fail.');
      console.error('  Please set REDIS_URL environment variable.');
    }
    
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
    
    // Initialize Redis in background (non-blocking)
    console.log('Initializing Redis...');
    initRedis().catch(e => console.warn('Redis init error (non-fatal):', e));
    
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
    // Don't exit - let Render see the logs
    console.error('Attempting to continue despite startup error...');
  }
};

start().catch((e) => {
  console.error('✗ Fatal error during startup:', e);
  // Still try to exit gracefully
  setTimeout(() => process.exit(1), 1000);
});
