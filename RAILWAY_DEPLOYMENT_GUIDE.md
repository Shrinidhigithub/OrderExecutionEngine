# Railway Deployment Guide

## Prerequisites
- GitHub account 
- Your code pushed to GitHub 

## Step-by-Step Deployment (5-10 minutes)

### 1. Create Railway Account
1. Go to: https://railway.app/
2. Click **"Login"** or **"Start a New Project"**
3. Sign in with your **GitHub account** (Shrinidhigithub)
4. Authorize Railway to access your GitHub repos

### 2. Create New Project
1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Search for and select: **`OrderExecutionEngine`**
4. Railway will detect it's a Node.js project

### 3. Add PostgreSQL Database
1. In your project dashboard, click **"+ New"**
2. Select **"Database"**
3. Choose **"Add PostgreSQL"**
4. Railway will create a PostgreSQL instance (free tier)
5. It auto-generates `DATABASE_URL` environment variable

### 4. Add Redis Database
1. Click **"+ New"** again
2. Select **"Database"**
3. Choose **"Add Redis"**
4. Railway will create a Redis instance (free tier)
5. It auto-generates `REDIS_URL` environment variable

### 5. Configure Environment Variables
Railway auto-detects and links databases, but verify:
1. Click on your **service** (OrderExecutionEngine)
2. Go to **"Variables"** tab
3. Ensure these exist (Railway adds them automatically):
   - `DATABASE_URL` (from PostgreSQL)
   - `REDIS_URL` (from Redis)
4. Optionally add:
   - `PORT` = `3000` (if not auto-detected)

### 6. Configure Build & Start Commands
1. Go to **"Settings"** tab in your service
2. Verify:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
3. Railway should auto-detect these from your `package.json`

### 7. Deploy
1. Railway automatically deploys on push to `main` branch
2. Click **"Deploy"** button if needed
3. Wait 2-5 minutes for build + deployment
4. Watch the **"Deployments"** tab for progress

### 8. Get Your Public URL
1. Go to **"Settings"** tab
2. Scroll to **"Networking"** section
3. Click **"Generate Domain"**
4. Railway will give you a public URL like:
   ```
   https://orderexecutionengine-production-xxxx.up.railway.app
   ```
5. **Copy this URL** — you'll add it to your README

### 9. Test Your Deployment
Open your public URL in a browser:
```
https://your-app.up.railway.app/
```

You should see a response (or 404 if no root route — that's ok).

Test the API:
```bash
curl -X POST https://your-app.up.railway.app/api/orders/execute \
  -H "Content-Type: application/json" \
  -d '{"tokenIn":"SOL","tokenOut":"USDC","amount":100}'
```

Expected response:
```json
{
  "orderId": "some-uuid",
  "websocket": "/api/orders/execute?orderId=some-uuid"
}
```

### 10. Enable Auto-Deploy from GitHub
1. Go to **"Settings"** → **"Service"** tab
2. Ensure **"Watch Paths"** includes `/` (root)
3. Now every push to `main` branch auto-deploys

## Troubleshooting

### Build fails with "Cannot find module"
- Railway might not have installed dependencies
- Check **"Deployments"** logs
- Ensure `package.json` and `package-lock.json` are pushed to GitHub

### App crashes on start
- Check **"Deployments"** → **"View Logs"**
- Common issues:
  - Missing `DATABASE_URL` or `REDIS_URL` (add in Variables tab)
  - Port binding issue (Railway sets `PORT` env var automatically)

### WebSocket connections fail
- Railway supports WebSockets by default
- Ensure your Fastify server listens on `0.0.0.0` (already configured)

### Database connection errors
- Check PostgreSQL and Redis services are running
- Verify environment variables are linked correctly
- Railway auto-injects connection strings

## Free Tier Limits
- **500 execution hours/month** (plenty for demo + evaluation)
- **PostgreSQL**: 100MB storage
- **Redis**: 25MB storage
- **Bandwidth**: 100GB/month

## Next Steps
1. Get your public URL
2. Add URL to `README.md`:
   ```markdown
   ## Live Demo
   **Deployed at:** https://your-app.up.railway.app
   ```
3. Commit and push:
   ```bash
   git add README.md
   git commit -m "Add deployment URL to README"
   git push origin main
   ```
4. Railway will auto-redeploy (takes 1-2 min)

## Support
- Railway Docs: https://docs.railway.app/
- Discord: https://discord.gg/railway

---

**Estimated Total Time:** 5-10 minutes

After deployment, move to next deliverable: **YouTube demo video**
