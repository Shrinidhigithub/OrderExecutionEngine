# Railway Debugging Checklist

The error `ENOTFOUND redis.railway.internal` means the Redis hostname doesn't exist on Railway. Follow this checklist:

## Immediate Actions

### 1. Check If Redis Service Exists
Go to: https://railway.app/dashboard

In your **OrderExecutionEngine** project:
- **Left sidebar**: Look for "Redis" service
  - ✅ If you see it → Go to Step 2
  - ❌ If you DON'T see it → **CREATE IT NOW:**
    - Click "New" (top right)
    - Select "Database" → "Redis"
    - Wait 2-3 minutes for it to provision
    - Come back here

### 2. Check If PostgreSQL Service Exists
- **Left sidebar**: Look for "Postgres" or "PostgreSQL" service
  - ✅ If you see it → Go to Step 3
  - ❌ If you DON'T see it → **CREATE IT NOW:**
    - Click "New" (top right)
    - Select "Database" → "PostgreSQL"
    - Wait 2-3 minutes for it to provision
    - Come back here

### 3. Check Service Status
Both Redis and PostgreSQL should show **green "Running"** status:
- Click on **Redis** service → Status should be green
- Click on **PostgreSQL** service → Status should be green

If either shows:
- 🟡 "Deploying" → Wait 3-5 minutes
- 🔴 "Failed" → Click it → "Logs" tab → Check what went wrong

### 4. Check Your Node Service Variables
Click your **Node.js service** (OrderExecutionEngine):
- Click **"Variables"** tab
- You should see these variables listed:
  ```
  DATABASE_URL = <some value>
  REDIS_URL = <some value>
  PORT = 3000
  ```

**Copy the exact values you see and share them with me** (mask passwords if you want).

### 5. If Variables Are Missing
If `DATABASE_URL` or `REDIS_URL` don't exist:
- Click "New Variable"
- Enter the name: `DATABASE_URL`
- Enter the value: (go to PostgreSQL service → "Connect" tab → copy DATABASE_URL)
- Repeat for `REDIS_URL`

### 6. Get Correct Connection Strings (If Needed)

**For PostgreSQL:**
1. Click your **PostgreSQL** service in sidebar
2. Click **"Connect"** tab
3. Copy the value next to **"DATABASE_URL"**
4. It should look like: `postgresql://postgres:xxxxx@railway.app:xxxxx/railway`

**For Redis:**
1. Click your **Redis** service in sidebar
2. Click **"Connect"** tab
3. Copy the value next to **"REDIS_URL"** or **"Redis URL"**
4. It should look like: `redis://:xxxxx@railway.app:xxxxx`

### 7. Set Variables in Node Service
1. Click your **Node.js service**
2. Click **"Variables"** tab
3. **Update or create these:**
   - `DATABASE_URL` = `<value from step 6 PostgreSQL>`
   - `REDIS_URL` = `<value from step 6 Redis>`
4. Click **"Save"** (if there's a save button)

### 8. Redeploy
1. Click **Node.js service**
2. Click menu (three dots) → **"Redeploy"**
3. Watch **"Logs"** tab
4. You should see:
   ```
   Initializing database...
   Database initialized successfully
   Checking Redis connectivity...
   Redis connectivity OK
   Starting worker pool...
   Starting server on port 3000...
   Server listening at http://0.0.0.0:3000
   ```

### 9. Test Health Endpoint
```bash
curl https://orderexecutionengine-production-471f.up.railway.app/health
```

Expected response:
```json
{
  "timestamp": "2025-12-20T...",
  "database": "ok",
  "redis": "ok",
  "status": "ok"
}
```

---

## Common Issues & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| `ENOTFOUND redis.railway.internal` | Redis service doesn't exist or REDIS_URL is wrong | Create Redis service or copy correct REDIS_URL |
| `ENOTFOUND postgres.railway.internal` | PostgreSQL service doesn't exist or DATABASE_URL is wrong | Create PostgreSQL service or copy correct DATABASE_URL |
| `connect ECONNREFUSED 127.0.0.1:6379` | Using localhost | Use Railway service URLs, not `127.0.0.1` |
| `Deploying` status (yellow) | Service still starting | Wait 3-5 minutes, then redeploy Node app |

---

## What NOT to Do ❌

- ❌ Don't use `127.0.0.1` or `localhost` (these are for local development only)
- ❌ Don't hardcode `redis.railway.internal` (won't resolve without proper service link)
- ❌ Don't use the `${{ }}` reference syntax unless your services are explicitly named in Railway
- ❌ Don't skip creating the services if they don't exist

---

## Need Help?

If after following these steps you still see errors:
1. Share the exact `DATABASE_URL` and `REDIS_URL` values from your Node service Variables tab (mask the password part like `xxxxx` if you want)
2. Share the current error from the Logs tab
3. I'll help you fix it

**Most common fix**: 80% of the time, the issue is that **PostgreSQL or Redis service doesn't exist**. Check Step 1 & 2 first!
