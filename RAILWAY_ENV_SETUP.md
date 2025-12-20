# Railway Environment Variables Setup – Step by Step

## Problem
Your app is trying to connect to `127.0.0.1:5432` (PostgreSQL) and `127.0.0.1:6379` (Redis), which don't exist on Railway. You need to use the actual service connection strings.

## Solution

### Step 1: Check If You Have PostgreSQL and Redis Services

1. Go to https://railway.app/dashboard
2. Select your **OrderExecutionEngine** project
3. Look in the left sidebar for services. You should see:
   - A Node.js service (your app)
   - A PostgreSQL service
   - A Redis service

**If you DON'T see PostgreSQL and Redis:**
- Click **"New"** (top right button)
- Select **"Database"** → **"PostgreSQL"**
- Wait for it to provision (2-3 minutes)
- Repeat: Click **"New"** → **"Database"** → **"Redis"**

**If they exist**, continue to Step 2.

### Step 2: Get the Connection Strings

#### For PostgreSQL:
1. Click on your **PostgreSQL** service in the sidebar
2. Click the **"Connect"** tab
3. Look for **"DATABASE_URL"** – copy the full value (it looks like `postgresql://user:password@host:port/database`)
4. **Do NOT use localhost values** – it should have a Railway hostname like `postgres.railway.internal` or similar

#### For Redis:
1. Click on your **Redis** service in the sidebar
2. Click the **"Connect"** tab
3. Look for **"REDIS_URL"** – copy the full value (looks like `redis://:password@host:port`)
4. **Do NOT use localhost values** – it should have a Railway hostname

### Step 3: Update Your Node Service Variables

1. Click on your **Node.js service** (OrderExecutionEngine)
2. Click the **"Variables"** tab
3. You should see existing variables. Look for:
   - `DATABASE_URL`
   - `REDIS_URL`

**If they don't exist**, click "New Variable" and add them.

**Replace the values:**
- Remove the localhost values (postgresql://postgres:password@127.0.0.1:5432/order_engine, redis://127.0.0.1:6379)
- Paste the actual values from Step 2

**Example of what it should look like:**
```
DATABASE_URL = postgresql://postgres:abc123@postgres.railway.internal:5432/railway
REDIS_URL = redis://:xyz789@redis.railway.internal:6379
```

### Step 4: Trigger a Redeploy

1. Click your **Node.js service**
2. Click the menu (three dots) → **"Redeploy"**
3. Watch the logs – you should see:
   ```
   Initializing database...
   Database initialized successfully
   Checking Redis connectivity...
   Redis connectivity OK
   Starting worker pool...
   Starting server on port 3000...
   Server listening at http://0.0.0.0:3000
   ```

### Step 5: Verify It Works

Test the health endpoint:
```bash
curl https://orderexecutionengine-production-471f.up.railway.app/health
```

Expected response:
```json
{
  "timestamp": "2025-12-20T14:32:15.123Z",
  "database": "ok",
  "redis": "ok",
  "status": "ok"
}
```

If you see `"database": "error"` or `"redis": "error"`, the connection strings are still wrong.

## Troubleshooting

### Still seeing ECONNREFUSED?
- **Check the Variables tab** – Make sure DATABASE_URL and REDIS_URL are set and don't contain `127.0.0.1`
- **Confirm services are running** – PostgreSQL and Redis services should show "Running" (green status)
- **Wait 2-3 minutes** – After changing vars, Railway may need time to redeploy
- **Check latest logs** – Click "Logs" tab and scroll to the bottom

### Can't find the connection strings?
- In Railway, click the PostgreSQL or Redis service
- Look for a "Connect" tab or button
- If you see "Database URL" or "URI", that's what you need to copy

### Services not provisioning?
- Click the PostgreSQL or Redis service
- Check the status (should be green "Running")
- If it says "Deploying", wait 3-5 minutes

## Quick Reference

What you're changing:
- **FROM:** `postgresql://postgres:password@127.0.0.1:5432/order_engine`
- **TO:** `postgresql://[user]:[password]@[railway-host]:[port]/[database]`

- **FROM:** `redis://127.0.0.1:6379`
- **TO:** `redis://:[password]@[railway-host]:[port]`

The Railway-provided values will have hostnames like:
- `postgres.railway.internal`
- `redis.railway.internal`
- Or an IP address

**Do NOT include `127.0.0.1` in production!**
