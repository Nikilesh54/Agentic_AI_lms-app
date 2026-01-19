# Quick Deploy Guide - 100% Free (Corrected)

Deploy your LMS for free using Render + Neon + Vercel.

## ⚠️ Important Note About Free Tier

**Render.com Free Tier:**
- ✅ Free forever
- ⚠️ **Cold starts**: App sleeps after 15 min idle, takes 30-60s to wake up
- ✅ Perfect for personal projects, demos, or low-traffic apps

**Alternative if cold starts are unacceptable:**
- **Koyeb**: $5.50/month recurring credit (no cold starts!)

## 🚀 Deploy Steps (30 minutes total)

### 1️⃣ Create Database (Neon.tech) - 5 min

1. Go to https://neon.tech → Sign up
2. Create new project: `lms-database`
3. Copy connection string (looks like):
   ```
   postgresql://user:pass@ep-xyz.region.aws.neon.tech/neondb?sslmode=require
   ```
4. Save it for next step

### 2️⃣ Deploy Backend (Render.com) - 15 min

1. Go to https://render.com → Sign up with GitHub
2. New + → Web Service
3. Connect your repository
4. Configure:
   - Name: `lms-backend`
   - Build: `npm install && npm run build`
   - Start: `npm start`
   - Plan: **FREE** ⚠️ (cold starts)

5. **Environment Variables** (click Advanced):

```bash
NODE_ENV=production
PORT=5000

# Paste your Neon connection string from step 1
DATABASE_URL=postgresql://user:pass@ep-xyz.aws.neon.tech/neondb?sslmode=require

# Generate JWT_SECRET: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=paste_generated_secret_here

SEED_DEFAULT_PASSWORD=ChooseStrongPassword123!

# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=your-bucket-name
GOOGLE_AI_API_KEY=your-gemini-key
GEMINI_MODEL=gemini-2.0-flash-exp

# AI Config
AI_PROVIDER=gemini
AI_TEMPERATURE=0.2
AI_MAX_TOKENS=2048
COVE_ENABLED=true
COVE_CONFIDENCE_THRESHOLD=0.7

# GCS Credentials (from your gcs-key.json file)
GOOGLE_CLOUD_CLIENT_EMAIL=service-account@project.iam.gserviceaccount.com
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nKey\n-----END PRIVATE KEY-----\n"
```

6. Click "Create Web Service"
7. Wait for deployment (3-5 min)
8. Copy your URL: `https://lms-backend.onrender.com`
9. Test: `https://lms-backend.onrender.com/api/health`

### 3️⃣ Deploy Frontend (Vercel) - 10 min

1. **First, update local file**:

   Edit `frontend/.env.production`:
   ```bash
   VITE_API_BASE_URL=https://lms-backend.onrender.com/api
   ```

   Commit and push:
   ```bash
   git add .
   git commit -m "Add production config"
   git push
   ```

2. Go to https://vercel.com → Sign up with GitHub
3. New Project → Import your repo
4. Settings:
   - Framework: **Vite**
   - Root: **frontend**
   - Build: `npm run build`
   - Output: `dist`
5. Environment Variables:
   - `VITE_API_BASE_URL` = `https://lms-backend.onrender.com/api`
6. Deploy!
7. Visit your app: `https://your-app.vercel.app`

### 4️⃣ Test Your App ✅

1. Visit Vercel URL
2. **First load**: 30-60 seconds (backend waking up)
3. Login as root:
   - Email: `root@admin.com`
   - Password: Your `SEED_DEFAULT_PASSWORD`
4. Create course, upload files, test features
5. **After 15 min idle**: First request will be slow again

## 💰 Actual Costs

- Vercel: **$0/month**
- Render: **$0/month**
- Neon: **$0/month**
- Google Cloud Storage: **~$0.50-2/month** (pay per use)
- Google AI: **~$0.50-5/month** (pay per use)

**Total: ~$1-7/month** (only Google services)

## ⚠️ Cold Starts Explained

**What happens:**
- Render free tier spins down after 15 minutes of no requests
- Next request takes 30-60 seconds to wake up
- Then runs normally until idle again

**Is this acceptable?**
- ✅ **Yes** for: Personal projects, demos, learning, low-traffic apps
- ❌ **No** for: Production apps with users expecting fast response

**Solutions:**
1. **Accept it** - Most student projects are fine
2. **Keep-alive ping** - Use cron-job.org to ping every 14 min (keeps it awake)
3. **Use Koyeb instead** - $5.50/month recurring credit, no cold starts
4. **Upgrade Render** - $7/month for always-on

## 🔄 Auto-Deployment

Both Vercel and Render auto-deploy when you push to GitHub! 🎉

Just:
```bash
git add .
git commit -m "Your changes"
git push
```

Both platforms rebuild automatically.

## 🆘 Troubleshooting

**Backend super slow on first load?**
- ✅ Normal! Free tier cold start (30-60s)
- Wait it out, then it'll be fast

**Database connection error?**
- Check DATABASE_URL has `?sslmode=require` at end
- Verify Neon database is running

**Frontend can't reach backend?**
- Test backend directly in browser
- Check CORS configuration
- Verify environment variable in Vercel

## 📚 Full Documentation

See [DEPLOYMENT_GUIDE_FREE.md](./DEPLOYMENT_GUIDE_FREE.md) for complete details.

## Alternative: Koyeb (No Cold Starts)

If cold starts are unacceptable:

1. Go to https://koyeb.com
2. Same deployment steps as Render
3. Get $5.50/month recurring credit
4. No cold starts!
5. Always-on services

## Summary

✅ Deploy in 30 minutes
✅ 100% free (except Google services ~$1-7/month)
⚠️ Trade-off: Cold starts on Render free tier
✅ Perfect for learning, demos, personal projects

Good luck! 🚀
