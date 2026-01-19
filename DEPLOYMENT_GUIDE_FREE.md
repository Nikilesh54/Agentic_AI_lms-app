# LMS Deployment Guide - 100% Free Version

Deploy your LMS application using completely free services with no credit card required (except Neon.tech for database).

## 🆓 Free Hosting Architecture

```
┌─────────────────────┐
│  Vercel             │  Frontend (React + Vite)
│  FREE FOREVER       │  ✅ Unlimited deployments
└──────────┬──────────┘
           │ API Calls
           ↓
┌─────────────────────┐
│  Render.com         │  Backend (Node.js + Express)
│  FREE FOREVER       │  ⚠️ Cold starts (30-60s wake time)
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Neon.tech          │  PostgreSQL Database
│  FREE FOREVER       │  ✅ 0.5GB storage
└─────────────────────┘

┌─────────────────────┐
│  Google Cloud       │  File Storage + AI
│  PAY PER USE        │  (Minimal cost for small usage)
└─────────────────────┘
```

## Cost Breakdown

- **Vercel**: $0/month forever ✅
- **Render.com**: $0/month forever ✅ (with cold starts)
- **Neon.tech**: $0/month forever ✅ (0.5GB limit)
- **Google Cloud Storage**: ~$0.50-2/month for small usage
- **Google AI API**: ~$0.50-5/month depending on usage

**Total: ~$1-7/month** (only Google services, everything else is free)

## Part 1: Set Up Database (Neon.tech)

### Step 1: Create Neon Database

1. Go to https://neon.tech
2. Sign up (GitHub or email)
3. Click "Create Project"
4. Name: `lms-database`
5. Region: Choose closest to you
6. Click "Create Project"

### Step 2: Get Connection String

1. In your Neon dashboard, find "Connection Details"
2. Copy the **connection string** (looks like):
   ```
   postgresql://username:password@ep-xyz.region.aws.neon.tech/neondb?sslmode=require
   ```
3. Save this - you'll need it for Render

## Part 2: Deploy Backend (Render.com)

### Step 1: Create Render Account

1. Go to https://render.com
2. Sign up with GitHub
3. No credit card required! ✅

### Step 2: Create Web Service

1. Click "New +" → "Web Service"
2. Connect your GitHub repository
3. Configure:
   - **Name**: `lms-backend`
   - **Region**: Choose closest to you (Oregon is default)
   - **Branch**: `main`
   - **Root Directory**: Leave blank (or `backend` if needed)
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Plan**: **Free** ⚠️ (services spin down after 15 min inactivity)

### Step 3: Add Environment Variables

Click "Advanced" → Add environment variables:

```bash
NODE_ENV=production
PORT=5000

# Database - Paste your Neon connection string
DATABASE_URL=postgresql://username:password@ep-xyz.region.aws.neon.tech/neondb?sslmode=require

# JWT Secret - Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_generated_secret_here

# Root user password
SEED_DEFAULT_PASSWORD=YourStrongPassword123!

# Google Cloud Storage
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=your-bucket-name

# Google AI
GOOGLE_AI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash-exp

# AI Configuration
AI_PROVIDER=gemini
AI_TEMPERATURE=0.2
AI_MAX_TOKENS=2048
COVE_ENABLED=true
COVE_CONFIDENCE_THRESHOLD=0.7
```

**For Google Cloud credentials** (service account), add:
```bash
GOOGLE_CLOUD_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nKey\nHere\n-----END PRIVATE KEY-----\n"
```

### Step 4: Deploy

1. Click "Create Web Service"
2. Render builds and deploys (takes 3-5 minutes)
3. Copy your backend URL: `https://lms-backend.onrender.com`
4. Test health endpoint: `https://lms-backend.onrender.com/api/health`

## Part 3: Deploy Frontend (Vercel)

### Step 1: Update Environment Variable

Edit `frontend/.env.production`:

```bash
VITE_API_BASE_URL=https://lms-backend.onrender.com/api
```

Commit and push:
```bash
git add frontend/.env.production
git commit -m "Update production API URL"
git push
```

### Step 2: Deploy to Vercel

1. Go to https://vercel.com
2. Sign up with GitHub
3. Click "Add New Project"
4. Import your repository
5. Configure:
   - **Framework**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
6. Add Environment Variable:
   - `VITE_API_BASE_URL` = `https://lms-backend.onrender.com/api`
7. Click "Deploy"

### Step 3: Get Your URL

Your app is live at: `https://your-app.vercel.app`

## ⚠️ Important: Cold Starts on Render Free Tier

**What happens:**
- After 15 minutes of inactivity, Render spins down your backend
- First request takes 30-60 seconds to wake up
- Subsequent requests are fast

**User Experience:**
- First login of the day: 30-60 second wait
- After that: Normal speed
- If no activity for 15 min: Next request is slow again

**Solutions:**
1. **Accept it** - Most personal projects are fine with this
2. **Keep-alive service** - Use a free cron service to ping your API every 14 minutes (cron-job.org)
3. **Upgrade later** - If needed, Render paid tier is $7/month for always-on

## Alternative: Koyeb (No Cold Starts!)

If cold starts are unacceptable, use **Koyeb** instead:

### Koyeb Free Tier
- ✅ $5.50/month credit (recurring monthly!)
- ✅ No cold starts
- ✅ Always-on services
- ✅ Better performance than Render free

**Deploy to Koyeb:**
1. Go to https://koyeb.com
2. Connect GitHub
3. Deploy with same environment variables
4. Get $5.50 credit every month (enough for small apps)

## Testing Your Deployment

1. Visit your Vercel URL
2. **First load might be slow** (30-60s if backend is asleep)
3. Create account and login
4. Test features:
   - Create course
   - Upload files
   - AI chat
5. After 15 min idle, first request will be slow again

## Monitoring & Logs

### Render.com
- Dashboard → Your service → Logs
- View real-time logs
- Monitor cold starts

### Neon.tech
- Dashboard shows database usage
- Monitor storage (0.5GB limit)
- Check query performance

### Vercel
- Dashboard → Your project → Deployments
- View build logs
- Monitor bandwidth (100GB/month limit)

## Staying Within Free Limits

### Neon Database (0.5GB limit)
- Should be fine for small class (50-100 students)
- Monitor storage in Neon dashboard
- If exceeded: Upgrade to $19/month or migrate to Supabase (500MB free)

### Render (Free tier)
- No bandwidth limits
- 750 hours/month (enough for 1 service)
- Spin-down after 15 min inactivity
- No CPU/memory limits during active use

### Vercel (Free tier)
- 100GB bandwidth/month
- Unlimited deployments
- Should be plenty for small-medium usage

## Upgrading When Needed

When you outgrow free tiers:

1. **Backend**: Render $7/month (no cold starts)
2. **Database**: Neon $19/month or Supabase $25/month
3. **Consider**: Railway ($5 initial, then pay-as-you-go)

## Reducing Google Cloud Costs

### Option 1: Switch to Supabase Storage (Free 1GB)
1. Create Supabase project
2. Use Supabase Storage API instead of Google Cloud Storage
3. Free tier: 1GB storage, 2GB bandwidth

### Option 2: Optimize Google Cloud Usage
- Set up lifecycle policies to delete old files
- Compress files before upload
- Use "Coldline" storage for old files

## Troubleshooting

### Backend takes forever to load
- **Normal on first request** after 15 min idle (Render free tier)
- Wait 30-60 seconds
- Consider setting up keep-alive ping

### Database connection error
- Verify DATABASE_URL is correct
- Check Neon database is active
- Ensure `?sslmode=require` is in connection string

### Frontend can't reach backend
- Test backend directly: `https://your-backend.onrender.com/api/health`
- Check CORS settings
- Verify VITE_API_BASE_URL in Vercel environment variables

### File uploads fail
- Check Google Cloud Storage credentials
- Verify bucket permissions
- Check Render logs for specific errors

## Security Notes

1. **Never commit** `.env` files to git ✅ (already in .gitignore)
2. **Rotate secrets** regularly (JWT_SECRET)
3. **Use strong passwords** for SEED_DEFAULT_PASSWORD
4. **Monitor usage** in Google Cloud Console
5. **Set up billing alerts** in Google Cloud

## Summary: What You Get Free

✅ **Frontend hosting** (Vercel)
✅ **Backend hosting** (Render with cold starts)
✅ **PostgreSQL database** (Neon 0.5GB)
✅ **HTTPS** (automatic on all platforms)
✅ **Auto-deploy** on git push
⚠️ **File storage & AI** (Google Cloud - pay per use)

**Trade-off**: 30-60 second cold starts on Render free tier
**Cost**: ~$1-7/month for Google services only

## Next Steps

1. Follow this guide to deploy
2. Test your application
3. Monitor usage and costs
4. Set up keep-alive service if cold starts are annoying
5. Upgrade individual services as needed

Good luck with your deployment! 🚀
