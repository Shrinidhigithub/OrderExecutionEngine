# Railway Deployment Issue: Missing Database Services

## Problem
Your Order Execution Engine deployed successfully to Railway, but the application fails to start because it requires:
1. **PostgreSQL** - for persistent order storage
2. **Redis** - for BullMQ job queue and pub/sub messaging

## Solution: Add Services to Railway

### Step-by-Step Fix

#### 1. Go to Your Railway Project
- Visit: https://railway.app/dashboard
- Select your "OrderExecutionEngine" project

#### 2. Add PostgreSQL Database
1. Click the **"New"** button (top right)
2. Select **"Database"** → **"PostgreSQL"**
3. Railway creates the instance automatically
4. **No configuration needed** - Railway auto-injects `DATABASE_URL` env var

#### 3. Add Redis Cache
1. Click **"New"** button again
2. Select **"Database"** → **"Redis"**
3. Railway creates the instance automatically
4. **No configuration needed** - Railway auto-injects `REDIS_URL` env var

#### 4. Redeploy Your Application
1. Click on your Node.js service
2. Click the **menu (three dots)** → **"Redeploy"**
3. Watch the deployment logs
4. Should complete successfully this time

#### 5. Verify It Works
Test the health endpoint:
```bash
curl https://orderexecutionengine-production-471f.up.railway.app/health
```

**Expected response:**
```json
{"status":"ok","timestamp":"2025-12-20T14:32:15.123Z"}
```

## Why This Was Failing

Your application code connects to:
```typescript
// src/queue/worker.ts
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

// src/store/orderStore.ts
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@127.0.0.1:5432/order_engine';
```

Without these services, the app tries to connect to localhost services that don't exist on Railway, causing startup to fail.

## After Adding Services

Once you add PostgreSQL and Redis to Railway:
1. Your Node.js service will automatically receive the connection strings as environment variables
2. The app will start successfully
3. Orders will be processed through the queue and stored in the database
4. WebSocket connections will receive real-time updates

## Testing Your Deployment

Once the app is running on Railway, you can test it:

```bash
# Submit an order
curl -X POST https://orderexecutionengine-production-471f.up.railway.app/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{"tokenIn":"SOL","tokenOut":"USDC","amount":10}'

# Response will be like:
# {"orderId":"550e8400-e29b-41d4-a716-446655440000","websocket":"/api/orders/execute?orderId=..."}
```

## Troubleshooting

**Still not working after adding services?**

1. **Check Railway logs**
   - Click your Node.js service
   - Click "Logs" tab
   - Look for error messages

2. **Verify environment variables**
   - Click your Node.js service
   - Click "Variables" tab
   - Should see `DATABASE_URL` and `REDIS_URL` populated

3. **Ensure services are healthy**
   - Go to your PostgreSQL service → Status should be "Running" (green)
   - Go to your Redis service → Status should be "Running" (green)

4. **Force redeploy if needed**
   - Click your Node.js service menu → "Redeploy"

## Need Help?

See documentation:
- **RAILWAY_SETUP.md** - Detailed Railway setup guide
- **README.md** - Full project documentation
- **SETUP_AND_TEST_GUIDE.md** - Local testing guide
