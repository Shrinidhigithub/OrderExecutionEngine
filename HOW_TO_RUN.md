#!/bin/bash
# How to Run the Order Execution Engine

cat << 'EOF'

╔════════════════════════════════════════════════════════════════╗
║   ORDER EXECUTION ENGINE - HOW TO RUN                         ║
╚════════════════════════════════════════════════════════════════╝

PROJECT STRUCTURE
├── src/             → TypeScript source code
├── tests/           → 31+ test cases
├── docker-compose.yml → Redis + PostgreSQL
└── DOCUMENTATION/
    ├── README.md                  → Overview
    ├── SETUP_AND_TEST_GUIDE.md    → Detailed guide
    ├── IMPLEMENTATION_SUMMARY.md  → Architecture
    └── DELIVERABLES_CHECKLIST.md  → Verification

═══════════════════════════════════════════════════════════════════

OPTION 1: ONE-LINE SETUP (RECOMMENDED)
═══════════════════════════════════════════════════════════════════

bash quickstart.sh

Then:
npm run dev

═══════════════════════════════════════════════════════════════════

OPTION 2: MANUAL SETUP
═══════════════════════════════════════════════════════════════════

# 1. Start Docker services
docker compose up -d

# 2. Wait for health checks
sleep 5

# 3. Install dependencies
npm install

# 4. Start development server
npm run dev

═══════════════════════════════════════════════════════════════════

RUN TESTS
═══════════════════════════════════════════════════════════════════

npm run test

Expected Output:
  ✓ tests/dex.test.ts (3)
  ✓ tests/queue.test.ts (2)
  ✓ tests/misc.test.ts (4)
  ✓ tests/websocket.test.ts (3)
  ✓ tests/store.test.ts (5)
  ✓ tests/concurrency.test.ts (5)
  ✓ tests/routing.test.ts (9)

  Test Files  7 passed (7)
  Tests     31 passed (31)

═══════════════════════════════════════════════════════════════════

TEST THE API
═══════════════════════════════════════════════════════════════════

In Terminal 1 (running npm run dev), open Terminal 2:

# Submit order
curl -X POST http://localhost:3000/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{
    "tokenIn": "SOL",
    "tokenOut": "USDC",
    "amount": 10
  }'

Response:
{
  "orderId": "550e8400-e29b-41d4-a716-446655440000",
  "websocket": "/api/orders/execute?orderId=550e8400-e29b-41d4-a716-446655440000"
}

# Subscribe to updates (in another terminal)
node ws-client.js 550e8400-e29b-41d4-a716-446655440000

═══════════════════════════════════════════════════════════════════

LOAD TEST (5 CONCURRENT ORDERS)
═══════════════════════════════════════════════════════════════════

bash load-test.sh

═══════════════════════════════════════════════════════════════════

POSTMAN/INSOMNIA COLLECTION
═══════════════════════════════════════════════════════════════════

1. Download Postman: https://www.postman.com/downloads/
2. Import: Order_Execution_Engine.postman_collection.json
3. Run pre-configured requests
4. 10+ examples included (successful + error cases)

═══════════════════════════════════════════════════════════════════

ARCHITECTURE
═══════════════════════════════════════════════════════════════════

Client (HTTP/WebSocket)
    ↓
Fastify Server (Port 3000)
    ├─→ POST /api/orders/execute (submit)
    └─→ GET /api/orders/execute (WebSocket)
    ↓
Redis (BullMQ Queue + Pub/Sub)
    ├─→ Queue: "orders" (10 concurrent)
    └─→ Channels: "order:{id}" (status updates)
    ↓
Worker (Processing)
    ├─→ Fetch Raydium quote (200ms)
    ├─→ Fetch Meteora quote (200ms)
    ├─→ Compare & route to best DEX
    └─→ Execute swap (2-3s simulation)
    ↓
PostgreSQL + Redis Channels
    ├─→ orders table (history)
    └─→ Live status messages

═══════════════════════════════════════════════════════════════════

ORDER LIFECYCLE
═══════════════════════════════════════════════════════════════════

pending
  ↓ (order queued)
routing
  ↓ (fetching quotes)
building
  ↓ (creating tx)
submitted
  ↓ (sending to network)
confirmed (with txHash)
OR
failed (with error + retry attempt)

═══════════════════════════════════════════════════════════════════

DATABASE & LOGS
═══════════════════════════════════════════════════════════════════

# View orders in PostgreSQL
psql postgres://postgres:password@127.0.0.1:5432/order_engine

> SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;

# Check Redis keys
redis-cli keys 'order:*'

# View server logs
npm run dev  # Output in terminal

═══════════════════════════════════════════════════════════════════

TEST FILES SUMMARY
═══════════════════════════════════════════════════════════════════

dex.test.ts (3 tests)
├─ Raydium quotes price range
├─ Meteora quotes price range
└─ Swap execution

queue.test.ts (2 tests)
├─ Queue name verification
└─ Job processing

misc.test.ts (4 tests)
├─ Sleep utility
├─ DEX selection logic (3x)
└─ Price variance

websocket.test.ts (3 tests) - NEW
├─ Publish order updates
├─ Multiple subscribers
└─ Payload validation

store.test.ts (5 tests) - NEW
├─ Create order
├─ Update status
├─ Error storage
├─ Lifecycle transitions
└─ Concurrent creates

concurrency.test.ts (5 tests) - NEW
├─ Queue concurrency
├─ Retry config
├─ Job data
├─ Queue size
└─ Processing completion

routing.test.ts (9 tests) - NEW
├─ Price variance (2x)
├─ Fee consistency (2x)
├─ Swap execution
├─ DEX selection (2x)
└─ Different amounts

═══════════════════════════════════════════════════════════════════

DOCUMENTATION FILES
═══════════════════════════════════════════════════════════════════

1. README.md
   └─ Project overview, quick start, API docs

2. SETUP_AND_TEST_GUIDE.md
   └─ Comprehensive setup, testing, troubleshooting

3. IMPLEMENTATION_SUMMARY.md
   └─ Architecture, features, metrics

4. DELIVERABLES_CHECKLIST.md
   └─ Verification of all requirements

5. HOW_TO_RUN.md (this file)
   └─ Quick reference for running the project

═══════════════════════════════════════════════════════════════════

PRODUCTION BUILD
═══════════════════════════════════════════════════════════════════

# Build
npm run build

# Run compiled version
npm start

═══════════════════════════════════════════════════════════════════

COMMON ISSUES
═══════════════════════════════════════════════════════════════════

Issue: "Connection refused" (Redis/PostgreSQL)
Solution: docker compose up -d

Issue: Tests timeout
Solution: docker compose restart && sleep 5 && npm run test

Issue: WebSocket no messages
Solution: Check orderId is correct, verify Redis running

Issue: Port 3000 already in use
Solution: PORT=3001 npm run dev

═══════════════════════════════════════════════════════════════════

VERIFICATION CHECKLIST
═══════════════════════════════════════════════════════════════════

Before submitting:

☐ Run: npm run test (all 31 tests pass)
☐ Start: npm run dev (server starts on port 3000)
☐ Submit: POST /api/orders/execute (returns orderId)
☐ Subscribe: WebSocket connection (receives status updates)
☐ Load test: bash load-test.sh (5 concurrent orders)
☐ Import: Postman collection (10+ requests work)
☐ Logs: Check Redis + PostgreSQL are running
☐ Documentation: README + guides reviewed

═══════════════════════════════════════════════════════════════════

SUPPORT
═══════════════════════════════════════════════════════════════════

1. Check SETUP_AND_TEST_GUIDE.md (Troubleshooting section)
2. Review logs: npm run dev output
3. Test database: psql order_engine
4. Test queue: redis-cli ping
5. Run tests: npm run test

═══════════════════════════════════════════════════════════════════

YOU'RE ALL SET!

Start with: bash quickstart.sh
Then: npm run dev

═══════════════════════════════════════════════════════════════════

EOF
