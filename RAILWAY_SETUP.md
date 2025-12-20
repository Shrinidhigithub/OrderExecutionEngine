# Railway Deployment Setup Guide

## Current Issue
The application requires PostgreSQL and Redis services which are not yet configured on Railway.

## Solution: Add Services to Railway Project

### Step 1: Add PostgreSQL Database
1. Go to your Railway project dashboard: https://railway.app/project/YOUR_PROJECT_ID
2. Click "New" → "Database" → "PostgreSQL"
3. Railway will create a PostgreSQL instance and automatically set the `DATABASE_URL` environment variable

### Step 2: Add Redis Cache
1. Click "New" → "Database" → "Redis"
2. Railway will create a Redis instance and automatically set the `REDIS_URL` environment variable

### Step 3: Verify Environment Variables
After adding both services, Railway should automatically inject these environment variables:
- `DATABASE_URL`: Connection string for PostgreSQL
- `REDIS_URL`: Connection string for Redis

You can verify this in the "Variables" tab of your service settings.

### Step 4: Redeploy
Once services are added:
1. Go to your Node.js service
2. Click the three dots menu → "Redeploy"
3. The app should now start successfully with database connections

## Alternative: Manual Environment Variables
If Railway doesn't auto-inject variables, manually add them:

**For PostgreSQL:**
- Key: `DATABASE_URL`
- Value: `postgresql://user:password@host:port/database`

**For Redis:**
- Key: `REDIS_URL`  
- Value: `redis://:password@host:port`

## Testing After Deployment
Once deployed, test with:
```bash
curl https://orderexecutionengine-production-471f.up.railway.app/health
```

Should return:
```json
{"status":"ok","timestamp":"2025-12-20T..."}
```

## Troubleshooting
If the app still fails to start:
1. Check Railway deployment logs (View logs in dashboard)
2. Verify `DATABASE_URL` and `REDIS_URL` are set correctly
3. Ensure PostgreSQL and Redis services are in a "Running" state
4. Check that the build completed successfully (should show `dist/index.js`)
