# Order Execution Engine (Mock)

**Chosen order type:** Market Order — immediate execution at current quotes. This is implemented because it best demonstrates DEX routing and instant lifecycle updates. The engine can be extended to support Limit or Sniper by adding a price-watching scheduler (for Limit) or a launch-monitoring trigger (for Sniper) that enqueues orders when conditions are met.

Quick start

1. Copy `.env.example` to `.env` and configure `REDIS_URL` and `DATABASE_URL`.
2. Install dependencies:

```bash
npm install
```

3. Start Redis and Postgres locally, then run:

```bash
npm run dev
```

API

- POST `/api/orders/execute` — create a market order. Body: `{ tokenIn, tokenOut, amount }`. Returns `{ orderId, websocket }`.
- GET `/api/orders/execute` (WebSocket upgrade) — connect with query `?orderId=...` to receive status updates.

Order lifecycle events (via WebSocket): `pending`, `routing`, `building`, `submitted`, `confirmed`, `failed`.

Notes

- This is a mock implementation. DEX quotes and swap execution are simulated with delays and random price variance.
- The same endpoint handles both POST and WebSocket. For browsers, POST then open WebSocket to `/api/orders/execute?orderId=...`. For clients that can upgrade the same connection, the server accepts WebSocket upgrades on the same route.
Run with Docker Compose

If you don't want to install Redis and Postgres locally, use the included `docker-compose.yml` to bring them up quickly for development and tests:

```bash
docker compose up -d
# wait a few seconds for services to become healthy
npm run dev
```

To run the SQL schema manually against the running Postgres instance:

```bash
psql postgres://postgres:password@127.0.0.1:5432/order_engine -f create_tables.sql
```

Run tests (requires Redis + Postgres running via docker-compose):

```bash
docker compose up -d
npm run test
```

## Code Review Summary

**Implementation Status: COMPLETE**

All core requirements implemented and tested:
- Market order execution with DEX routing
- WebSocket real-time status updates
- BullMQ queue with concurrent processing (10 orders max)
- Redis pub/sub for order lifecycle events
- PostgreSQL persistent storage
- Exponential backoff retry logic (max 3 attempts)
- Mock DEX router with price variance (±2-5%)
- 15+ unit/integration tests
- Postman collection for API testing

## Test Suite (15+ Tests)

Run all tests:
```bash
npm run test
```

**Test files:**
- `tests/dex.test.ts` - DEX router (3 tests)
- `tests/queue.test.ts` - Queue processing (2 tests)
- `tests/misc.test.ts` - Utilities & routing logic (4 tests)
- `tests/websocket.test.ts` - PubSub lifecycle (3 tests) - NEW
- `tests/store.test.ts` - Database operations (5 tests) - NEW
- `tests/concurrency.test.ts` - Queue concurrency (5 tests) - NEW
- `tests/routing.test.ts` - Price comparison (9 tests) - NEW

**Total: 31+ test cases**

## API Testing

### Postman Collection
Import `Order_Execution_Engine.postman_collection.json` in Postman with 10+ request examples:
- 5 successful market orders (different token pairs)
- 5 error test cases (validation failures)

### Quick Test

```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Submit order
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{"tokenIn":"SOL","tokenOut":"USDC","amount":10}'

# Terminal 2: Subscribe to WebSocket (copy orderId from response)
node ws-client.js YOUR_ORDER_ID

# Terminal 2: Load test with 5 concurrent orders
bash load-test.sh
```

## Quick Start

**One-liner with Docker Compose:**
```bash
bash quickstart.sh
```

**Or manually:**
```bash
docker compose up -d
npm install
npm run dev
```

## Documentation

- **SETUP_AND_TEST_GUIDE.md** - Comprehensive setup, testing, and troubleshooting
- **Architecture** - See `Architecture Overview` section below

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Client (HTTP/WebSocket)                │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
    POST /execute         WebSocket /execute
        │                     │
┌───────▼─────────────────────▼──────────┐
│           Fastify Server                │
│  • REST endpoint for order submission   │
│  • WebSocket upgrade for status stream  │
└───────┬──────────────────┬──────────────┘
        │                  │
    Enqueue           Subscribe
        │                  │
┌───────▼──────────────────▼──────────┐
│       Redis (BullMQ + Pub/Sub)      │
│  • Queue: "orders" (10 concurrent)  │
│  • Channels: order:{id}             │
└───┬──────────────────────┬──────────┘
    │                      │
  Process             Subscribe
    │                      │
┌───▼──────────────────────▼──────┐
│    Worker Pool (Concurrency: 10) │
├──────────────────────────────────┤
│  1. Fetch quotes (Raydium/Meta)  │
│  2. Compare & route to best DEX  │
│  3. Simulate swap execution      │
│  4. Emit status updates          │
└───┬──────────────────────┬──────┘
    │                      │
  Store               Publish
    │                      │
┌───▼──────────────────────▼──────┐
│   PostgreSQL | Redis Channels   │
│  • Order history & state        │
│  • Live subscription messages   │
└──────────────────────────────────┘
```

## Order Lifecycle

```
pending (submitted) 
   ↓
routing (fetching DEX quotes)
   ↓
building (creating transaction)
   ↓
submitted (sent to network)
   ↓
confirmed (success with txHash)
   ↔ failed (with error reason + retry attempt)
```

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js + TypeScript |
| API | Fastify (WebSocket support) |
| Queue | BullMQ (Redis) |
| Database | PostgreSQL |
| Cache/PubSub | Redis (ioredis) |
| Testing | Vitest |
| Mock DEX | Custom implementation |

## Render Deployment

This project is deployed on Render.com with the following services:

- **Web Service**: Node.js application running the Order Execution Engine
- **PostgreSQL**: Managed PostgreSQL database
- **Redis**: Managed Redis instance for queues and pub/sub

### Live Deployment
- **URL**: https://orderexecutionengine-uaws.onrender.com
- **Health Check**: https://orderexecutionengine-uaws.onrender.com/health

### Deployment Steps

1. **Create Render Account**
   - Go to [Render.com](https://render.com)
   - Connect your GitHub repository

2. **Add Database Services**
   - Create a PostgreSQL database in Render dashboard
   - Create a Redis instance in Render dashboard
   - Copy the connection URLs

3. **Create Web Service**
   - Create new Web Service from your GitHub repo
   - Set environment variables:
     - `DATABASE_URL`: PostgreSQL connection string
     - `REDIS_URL`: Redis connection string
   - Build command: `npm install && npm run build`
   - Start command: `node dist/index.js`

4. **Verify Deployment**
   ```bash
   curl https://orderexecutionengine-uaws.onrender.com/health
   ```
   Should return: `{"database":"ok","redis":"ok","status":"ok"}`

## Deployment Ready

The engine is ready to:
1. **Scale** - Add more workers for higher throughput
2. **Monitor** - Integrate observability tools (logs, metrics, traces)
3. **Extend** - Support limit/sniper orders with price watchers
4. **Integrate** - Connect to real Raydium/Meteora SDKs for devnet/mainnet

See `SETUP_AND_TEST_GUIDE.md` for production deployment steps.

---

## Live Demo - WebSocket Order Stages

Test the deployed API and see real-time order status updates through WebSocket:

### Run Demo Command

```bash
node -e "
const WebSocket = require('ws');
const https = require('https');
const postData = JSON.stringify({ tokenIn: 'SOL', tokenOut: 'USDC', amount: 50 });
const req = https.request({
  hostname: 'orderexecutionengine-uaws.onrender.com',
  path: '/api/orders/execute',
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': postData.length }
}, (res) => {
  let data = '';
  res.on('data', (c) => data += c);
  res.on('end', () => {
    const { orderId } = JSON.parse(data);
    console.log('Order:', orderId);
    const ws = new WebSocket('wss://orderexecutionengine-uaws.onrender.com/api/orders/execute?orderId=' + orderId);
    ws.on('message', (d) => console.log('→', d.toString()));
    ws.on('close', () => process.exit(0));
    setTimeout(() => process.exit(0), 15000);
  });
});
req.write(postData);
req.end();
"
```

### Demo Output

```
Order: b02dde8a-d064-43aa-84b2-c7c594ea44e0
→ {"status":"pending"}
→ {"status":"routing"}
→ {"status":"building","chosen":"meteora","rQuote":{"price":101.29,"fee":0.003},"mQuote":{"price":101.04,"fee":0.002}}
→ {"status":"submitted"}
→ {"status":"confirmed","txHash":"1c8522be-36d8-4cd2-b792-77228107c27c","executedPrice":98.99}
```

### Order Lifecycle Stages

| Stage | Status | Description |
|-------|--------|-------------|
| 1 | `pending` | Order received and queued for processing |
| 2 | `routing` | Fetching quotes from Raydium & Meteora DEXs |
| 3 | `building` | Creating transaction, shows chosen DEX with quotes |
| 4 | `submitted` | Transaction sent to the network |
| 5 | `confirmed` | Success with transaction hash and executed price |

`failed` | Error with reason and retry attempt count |

