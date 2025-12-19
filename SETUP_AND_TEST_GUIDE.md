# Setup & Testing Guide

## Code Review Summary 

Your Order Execution Engine implementation is **well-structured and correct**. Here's what's working:

### Strengths

1. **Architecture**
   - Clean separation of concerns: router, queue, store, pubsub
   - Proper use of BullMQ for concurrent order processing
   - Redis pub/sub for real-time WebSocket updates
   - PostgreSQL for persistent order history

2. **DEX Routing Logic**
   - Correctly fetches quotes from both Raydium and Meteora
   - Compares prices and routes to best venue
   - Mock implementation with realistic delays and variance (±2-5%)

3. **Order Lifecycle**
   - All required statuses implemented: pending → routing → building → submitted → confirmed/failed
   - Proper error handling with exponential backoff retry (3 attempts max)
   - Concurrent processing of up to 10 orders

4. **WebSocket Integration**
   - Fastify WebSocket properly configured
   - Dual endpoint pattern: POST for order submission, WS for subscriptions
   - Real-time status updates via Redis pub/sub channels

5. **Testing**
   - DEX router tests with price range validation
   - Queue processing tests with job completion verification
   - Router utility tests for DEX selection logic
   - Sleep utility tests

## Quick Start

### Prerequisites
- Node.js 16+
- Docker & Docker Compose (recommended) OR local Redis + PostgreSQL

### Option 1: Docker Compose (Easiest) RECOMMENDED

```bash
# Start services (Redis + PostgreSQL)
docker compose up -d

# Wait 5 seconds for health checks
sleep 5

# Install dependencies
npm install

# Start development server
npm run dev
```

The server will start on `http://localhost:3000`

### Option 2: Local Installation

1. Install Redis (on macOS: `brew install redis` then `redis-server`)
2. Install PostgreSQL (on macOS: `brew install postgresql` then `brew services start postgresql`)
3. Create database:
   ```bash
   createdb order_engine
   ```
4. Then run:
   ```bash
   npm install
   npm run dev
   ```

### Setup Environment Variables

Copy `.env.example` to `.env` (already configured for Docker Compose):

```bash
cp .env.example .env
```

## Testing

### Run All Tests

```bash
# Requires Docker Compose running
docker compose up -d
npm install
npm run test
```

Expected output:
```
tests/dex.test.ts (3)
tests/queue.test.ts (2)
tests/misc.test.ts (4)

Test Files  3 passed (3)
```

### Test Coverage Details

1. **dex.test.ts** - DEX router tests
   - Quote price ranges validation (90-110 for base price 100)
   - Raydium and Meteora fee verification
   - Swap execution with txHash generation

2. **queue.test.ts** - Order queue tests
   - Queue name verification
   - Job processing and completion

3. **misc.test.ts** - Utilities and logic tests
   - Sleep utility accuracy
   - DEX selection logic (always picks lower price)
   - Price variance across multiple samples

## API Usage

### 1. Submit Order via HTTP POST

```bash
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amount": 10
  }'
```

Response:
```json
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "websocket": "/api/orders/execute?orderId=550e8400-e29b-41d4-a716-446655440000"
}
```

### 2. Subscribe to Order Updates via WebSocket

#### Using Node.js

```bash
# Connect to WebSocket (requires orderId from step 1)
node ws-client.js 550e8400-e29b-41d4-a716-446655440000
```

Output:
```
open
msg: {"status":"pending"}
msg: {"status":"routing"}
msg: {"chosen":"raydium","rQuote":{"price":101.5,"fee":0.003},"mQuote":{"price":103.2,"fee":0.002},"status":"building"}
msg: {"status":"submitted"}
msg: {"status":"confirmed","txHash":"a1b2c3d4-...","executedPrice":102.1}
```

#### Using Browser/JavaScript

```javascript
const ws = new WebSocket('ws://localhost:3000/api/orders/execute?orderId=YOUR_ORDER_ID');

ws.onopen = () => console.log('Connected');

ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  console.log('Order status:', update.status);
  console.log('Details:', update);
};

ws.onerror = (error) => console.error('WebSocket error:', error);
ws.onclose = () => console.log('Disconnected');
```

#### Using cURL (with wscat)

```bash
# Install wscat
npm install -g wscat

# Connect
wscat -c "ws://localhost:3000/api/orders/execute?orderId=550e8400-e29b-41d4-a716-446655440000"

# View live updates
```

## Testing Multiple Concurrent Orders

### Script 1: Create 5 Orders

```bash
#!/bin/bash
for i in {1..5}; do
  echo "Creating order $i..."
  response=$(curl -s -X POST http://localhost:3000/api/orders/execute \
    -H "Content-Type: application/json" \
    -d "{
      \"tokenIn\": \"SOL\",
      \"tokenOut\": \"USDC\",
      \"amount\": $((i * 10))
    }")
  
  orderId=$(echo "$response" | jq -r '.orderId')
  echo "Order $i created: $orderId"
  
  # Store for WebSocket connection
  echo "$orderId" >> order_ids.txt
done
```

### Script 2: Monitor All Orders

```bash
#!/bin/bash
while IFS= read -r orderId; do
  echo "Connecting to $orderId..."
  node ws-client.js "$orderId" &
done < order_ids.txt

wait
```

## Database & Logs

### View Order History

```bash
# Connect to PostgreSQL
psql postgres://postgres:password@127.0.0.1:5432/order_engine

# Query orders
SELECT id, status, tx_hash, created_at FROM orders ORDER BY created_at DESC LIMIT 10;
```

### View Server Logs

Development mode logs to console with full request/response details:

```bash
npm run dev
# Look for log entries like:
# [INFO] POST /api/orders/execute
# [DEBUG] Order ID: 550e8400...
# [INFO] WebSocket connection: /api/orders/execute?orderId=...
```

## Production Build

```bash
# Build TypeScript
npm run build

# Run compiled version
npm start
```

## Troubleshooting

### Issue: "Connection refused" on Redis/PostgreSQL
**Solution:** Start Docker Compose:
```bash
docker compose up -d
docker compose logs  # View service logs
```

### Issue: "TypeError: Cannot read property 'query' of undefined"
**Solution:** Database pool not initialized. Ensure `initDb()` is called:
```bash
# Check that src/index.ts has `await initDb();` in start()
```

### Issue: WebSocket connects but no messages received
**Solution:** Check that orderId is correct:
```bash
# Verify order exists in database
psql -c "SELECT * FROM orders WHERE id='YOUR_ID';" order_engine

# Check Redis is running
redis-cli ping  # Should return PONG
```

### Issue: Tests timeout or fail
**Solution:**
```bash
# Ensure services are healthy
docker compose ps  # All should be "healthy"

# If not, restart
docker compose restart
sleep 5
npm run test
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     Client (Browser/CLI)                │
└──────────────────┬──────────────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        │                     │
    POST /execute         WebSocket /execute
        │                     │
┌───────▼─────────────────────▼──────────┐
│           Fastify Server                │
├─────────────────────────────────────────┤
│  • POST endpoint: Submit & validate order
│  • WebSocket: Subscribe to order updates│
└───────┬──────────────────┬──────────────┘
        │                  │
     Creates          Subscribes
        │                  │
┌───────▼──────────────────▼──────────┐
│       Redis (BullMQ + Pub/Sub)      │
├────────────────────────────────────┤
│  • Queue: orders                    │
│  • Channels: order:{orderId}        │
└───┬──────────────────────┬──────────┘
    │                      │
  Process             Subscribe
    │                      │
┌───▼──────────────────────▼──────┐
│    Worker (Concurrency: 10)     │
├──────────────────────────────────┤
│  1. Route to best DEX (mock)    │
│  2. Publish order updates       │
│  3. Execute swap (simulated)    │
└───┬──────────────────────┬──────┘
    │                      │
  Store               Publish
    │                      │
┌───▼──────────────────────▼──────┐
│   PostgreSQL | Redis Channels   │
├──────────────────────────────────┤
│  • orders table (persistent)    │
│  • Live subscription channels   │
└──────────────────────────────────┘
```

## Next Steps for Production

1. **Implement Real DEX Integration**
   - Replace MockDexRouter with actual Raydium/Meteora SDKs
   - Handle Solana network requests and failures
   - Manage wallet keys securely (use environment variables or key management service)

2. **Add Authentication**
   - Implement JWT for API endpoints
   - Secure WebSocket connections

3. **Add Monitoring & Alerting**
   - Log to external service (DataDog, New Relic)
   - Set up alerts for failed orders

4. **Extend Order Types**
   - **Limit Orders:** Add price watcher scheduler
   - **Sniper Orders:** Add launch event listener and monitoring trigger

5. **Deploy to Production**
   - Use hosted Redis (Redis Enterprise, AWS ElastiCache)
   - Use managed PostgreSQL (AWS RDS, Azure Database)
   - Deploy app to cloud (Heroku, Railway, Render)

## Support

For issues or questions, check:
- Server logs: `npm run dev` output
- Database state: `psql order_engine` queries
- Redis state: `redis-cli keys 'order:*'`
- Test failures: `npm run test`
