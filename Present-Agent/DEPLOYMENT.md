# Deployment Guide - Present-Agent

Complete guide for deploying Present-Agent frontend and backend.

---

## Architecture Overview

- **Frontend:** Next.js app deployed on **Vercel**
- **Backend:** Express API deployed on **Railway**
- **Databases:** PostgreSQL, Neo4j, Qdrant, Redis (all on Railway)

---

## Prerequisites

- GitHub account
- Vercel account (sign up at vercel.com)
- Railway account (sign up at railway.app)
- OpenAI API key

---

## Part 1: Backend Deployment (Railway)

### Step 1: Login to Railway

```bash
cd "/Volumes/Crucial X8/Code/Present-Agent"
railway login
```

This opens a browser for GitHub authentication.

### Step 2: Initialize Project

```bash
railway init
```

Select:
- "Create new project"
- Name it "present-agent" or similar

### Step 3: Add Databases via Railway Dashboard

Go to [railway.app/dashboard](https://railway.app/dashboard) and open your project:

#### 3a. Add PostgreSQL
1. Click **"New"** → **"Database"** → **"PostgreSQL"**
2. Wait for deployment (auto-generates `POSTGRES_URL`)

#### 3b. Add Redis
1. Click **"New"** → **"Database"** → **"Redis"**
2. Wait for deployment (auto-generates `REDIS_URL`)

#### 3c. Add Neo4j
1. Click **"New"** → **"Template"**
2. Search for **"Neo4j"**
3. Click "Deploy Neo4j"
4. Note the connection details (generates `NEO4J_URL`, `NEO4J_USER`, `NEO4J_PASSWORD`)

#### 3d. Add Qdrant (Vector Database)
1. Click **"New"** → **"Template"**
2. Search for **"Qdrant"**
3. Click "Deploy Qdrant"
4. Note the URL (generates `VECTOR_DB_URL`)

### Step 4: Configure Backend Service Environment Variables

In your Railway project, click on your **backend service** (the one with the Dockerfile), then go to **"Variables"** tab and add:

```bash
# Required
OPENAI_API_KEY=sk-...                    # Your OpenAI API key
MODE=five-db                              # Database mode
PORT=3001                                 # API port

# Auto-populated by Railway (verify they exist)
POSTGRES_URL=postgres://...               # Auto-generated
REDIS_URL=redis://...                     # Auto-generated
NEO4J_URL=bolt://...                      # From Neo4j template
NEO4J_USER=neo4j                          # From Neo4j template
NEO4J_PASSWORD=...                        # From Neo4j template
VECTOR_DB_URL=http://...                  # From Qdrant template

# Optional
MODEL_NAME=gpt-4o-mini                    # OpenAI model (default)
EMBEDDING_MODEL=text-embedding-3-small    # Embedding model (default)
LOG_LEVEL=info                            # Logging level
```

### Step 5: Deploy Backend

```bash
railway up
```

This builds and deploys using the Dockerfile.

### Step 6: Generate Public Domain

```bash
railway domain
```

Or via dashboard: Click your service → **"Settings"** → **"Networking"** → **"Generate Domain"**

**Save this URL!** You'll need it for the frontend (e.g., `https://present-agent-production.up.railway.app`)

### Step 7: Verify Backend Deployment

Check logs:
```bash
railway logs
```

Or visit: `https://your-backend-url.railway.app/health` (should return status)

---

## Part 2: Frontend Deployment (Vercel)

The frontend is already deployed at:
**https://present-agent-qwcq3fflb-guillaumeracines-projects.vercel.app**

### Update Frontend Environment Variables

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your **present-agent** project
3. Go to **Settings** → **Environment Variables**
4. Add:

```bash
NEXT_PUBLIC_API_BASE=https://your-backend-url.railway.app
```

Replace `your-backend-url.railway.app` with your actual Railway backend URL from Step 6.

### Redeploy Frontend

```bash
cd "/Volumes/Crucial X8/Code/Present-Agent"
npx vercel --prod
```

Or trigger via Vercel dashboard: **Deployments** → **Redeploy**

---

## Part 3: Initialize Database Schema

After backend is deployed, you need to initialize the databases:

### Option 1: Run Migration Scripts Locally

```bash
# Set environment variables from Railway
export POSTGRES_URL="<from-railway>"
export NEO4J_URL="<from-railway>"
export NEO4J_USER="neo4j"
export NEO4J_PASSWORD="<from-railway>"
export REDIS_URL="<from-railway>"
export VECTOR_DB_URL="<from-railway>"

# Run migrations
npm run db:migrate
```

### Option 2: Run via Railway Shell

```bash
railway run npm run db:migrate
```

### Load Product Data

```bash
# From local
npm run data:import

# Or via Railway
railway run npm run data:import
```

---

## Part 4: Verify Full Stack

1. **Backend Health Check:**
   ```bash
   curl https://your-backend-url.railway.app/health
   ```

2. **Frontend Access:**
   Visit: https://present-agent-qwcq3fflb-guillaumeracines-projects.vercel.app

3. **Test Chat:**
   - Open frontend
   - Type: "Gift for my mom, budget $50"
   - Should return recommendations from backend

---

## Troubleshooting

### Backend Not Starting

**Check logs:**
```bash
railway logs
```

**Common issues:**
- Missing `OPENAI_API_KEY`
- Database connection strings not set
- Port binding (ensure `PORT=3001` is set)

### Frontend Shows "Failed to Load"

**Check:**
1. `NEXT_PUBLIC_API_BASE` is set correctly in Vercel
2. Backend is running (visit `/health` endpoint)
3. CORS is enabled in backend (should be by default)

### Database Connection Errors

**Verify all connection strings:**
```bash
railway variables
```

Make sure:
- `POSTGRES_URL` is set
- `NEO4J_URL`, `NEO4J_USER`, `NEO4J_PASSWORD` are set
- `REDIS_URL` is set
- `VECTOR_DB_URL` is set

### "Cannot find module" Errors

**Rebuild:**
```bash
railway up --detach
```

---

## Monitoring & Logs

### Backend Logs (Railway)
```bash
railway logs --follow
```

Or via dashboard: Click service → **"Deployments"** → Select deployment → **"View Logs"**

### Frontend Logs (Vercel)
1. Go to Vercel dashboard
2. Click project → **"Deployments"**
3. Click deployment → **"View Function Logs"**

---

## Updating Deployment

### Update Backend
```bash
# Make changes
git add .
git commit -m "Update backend"
git push origin main

# Railway auto-deploys on push
# Or manually:
railway up
```

### Update Frontend
```bash
# Vercel auto-deploys on push to main
# Or manually:
npx vercel --prod
```

---

## Cost Estimates

### Railway (Free Tier)
- **$5/month free credit** (enough for hobby projects)
- After free credit:
  - PostgreSQL: ~$5/month
  - Redis: ~$2/month
  - Neo4j: ~$5/month
  - Qdrant: ~$5/month
  - Backend API: ~$5/month
  - **Total: ~$22/month** (if exceeded free tier)

### Vercel (Free Tier)
- **Unlimited** personal projects
- 100 GB bandwidth/month
- Serverless function executions included

---

## Production Checklist

- [ ] Backend deployed on Railway with all databases
- [ ] Frontend deployed on Vercel
- [ ] `NEXT_PUBLIC_API_BASE` set in Vercel
- [ ] All environment variables configured
- [ ] Database schema migrated
- [ ] Product data imported
- [ ] Health check passing
- [ ] Chat functionality tested
- [ ] Logs monitored for errors

---

## Quick Commands Reference

```bash
# Railway
railway login                    # Login
railway init                     # Initialize project
railway up                       # Deploy
railway logs                     # View logs
railway domain                   # Generate/view domain
railway variables                # List environment variables
railway run <command>            # Run command in Railway environment

# Vercel
vercel login                     # Login
vercel --prod                    # Deploy to production
vercel env ls                    # List environment variables
vercel logs                      # View logs
```

---

## Support

- Railway Docs: https://docs.railway.app
- Vercel Docs: https://vercel.com/docs
- Project Issues: https://github.com/GuillaumeRacine/crypto-web-monitor/issues

---

**Deployment created:** 2025-10-07
**Last updated:** 2025-10-07
