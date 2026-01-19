# LMS Application Deployment Guide

This guide will help you deploy your LMS application using free hosting services.

## Architecture Overview

```
┌─────────────────────┐
│  Vercel             │  Frontend (React + Vite)
│  (Free Forever)     │
└──────────┬──────────┘
           │ API Calls
           ↓
┌─────────────────────┐
│  Railway.app        │  Backend (Node.js + Express)
│  ($5/month credit)  │  + PostgreSQL Database
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Google Cloud       │  File Storage + AI API
│  (Pay per use)      │
└─────────────────────┘
```

## Prerequisites

1. GitHub account
2. Vercel account (sign up at https://vercel.com)
3. Railway account (sign up at https://railway.app)
4. Google Cloud project with:
   - Cloud Storage bucket
   - AI API key (Gemini)
   - Service account JSON key file

## Part 1: Deploy Backend to Railway

### Step 1: Create Railway Project

1. Go to https://railway.app and sign in
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect your GitHub account and select your `lms-app` repository
5. Railway will auto-detect the Node.js backend

### Step 2: Add PostgreSQL Database

1. In your Railway project, click "New"
2. Select "Database" → "PostgreSQL"
3. Railway will create a PostgreSQL database and set the `DATABASE_URL` environment variable automatically

### Step 3: Configure Environment Variables

In your Railway backend service, add these environment variables:

```bash
# Server Configuration
PORT=5000
NODE_ENV=production

# Database (DATABASE_URL is automatically set by Railway)
# No need to set DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD

# JWT Secret - GENERATE A STRONG RANDOM STRING
# Run: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
JWT_SECRET=your_generated_secret_here

# Seed Database Password
SEED_DEFAULT_PASSWORD=your_strong_password_here

# Google Cloud Storage Configuration
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_KEYFILE=/app/config/gcs-key.json
GCS_BUCKET_NAME=your-bucket-name

# Google AI Studio Configuration
GOOGLE_AI_API_KEY=your_google_ai_api_key_here
GEMINI_MODEL=gemini-2.0-flash-exp

# AI Service Configuration
AI_PROVIDER=gemini
AI_TEMPERATURE=0.2
AI_MAX_TOKENS=2048
AI_STREAMING_ENABLED=false

# Chain-of-Verification Configuration
COVE_ENABLED=true
COVE_CONFIDENCE_THRESHOLD=0.7
```

### Step 4: Upload Google Cloud Service Account Key

1. In Railway, go to your backend service settings
2. Click on "Variables" tab
3. You need to upload your `gcs-key.json` file:
   - Option A: Encode it as base64 and set as environment variable, then decode in code
   - Option B: Use Railway's volume feature (if available)
   - Option C: Store credentials in environment variables directly

**Recommended approach - Set GCS credentials as environment variables:**

Instead of using a JSON file, extract the credentials and set them as individual environment variables:

```bash
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=your-bucket-name
GOOGLE_CLOUD_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nPrivate\nKey\nHere\n-----END PRIVATE KEY-----\n"
```

### Step 5: Deploy Backend

1. Railway will automatically deploy when you push to your GitHub repository
2. After deployment, note your backend URL (e.g., `https://your-app.railway.app`)
3. Test the health endpoint: `https://your-app.railway.app/api/health`

## Part 2: Deploy Frontend to Vercel

### Step 1: Create Production Environment File

In your `frontend` folder, create a `.env.production` file:

```bash
VITE_API_BASE_URL=https://your-app.railway.app/api
```

Replace `your-app.railway.app` with your actual Railway backend URL.

### Step 2: Deploy to Vercel

1. Go to https://vercel.com and sign in
2. Click "Add New Project"
3. Import your GitHub repository
4. Configure the project:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add environment variable:
   - Key: `VITE_API_BASE_URL`
   - Value: `https://your-app.railway.app/api`
6. Click "Deploy"

### Step 3: Configure CORS in Backend

After deployment, update your backend CORS configuration to allow your Vercel domain.

Edit `backend/src/index.ts` if needed to add your Vercel URL to allowed origins.

## Part 3: Update Frontend API Configuration

Your frontend is already configured to use environment variables. Make sure you have:

1. Created `.env.production` with your Railway backend URL
2. The `api.ts` file uses `import.meta.env.VITE_API_BASE_URL`

## Part 4: Testing Your Deployment

1. Visit your Vercel URL (e.g., `https://your-app.vercel.app`)
2. Test login functionality
3. Test file uploads
4. Test AI chat features
5. Monitor Railway logs for any errors

## Environment Variables Checklist

### Frontend (Vercel)
- ✅ `VITE_API_BASE_URL` - Your Railway backend URL

### Backend (Railway)
- ✅ `PORT` - 5000
- ✅ `NODE_ENV` - production
- ✅ `DATABASE_URL` - Auto-set by Railway
- ✅ `JWT_SECRET` - Generate strong random string
- ✅ `SEED_DEFAULT_PASSWORD` - Strong password for root user
- ✅ `GOOGLE_CLOUD_PROJECT_ID`
- ✅ `GCS_BUCKET_NAME`
- ✅ `GOOGLE_AI_API_KEY`
- ✅ `GEMINI_MODEL`
- ✅ Google Cloud credentials (client_email, private_key)

## Updating Your App

### Frontend Updates
1. Push changes to GitHub
2. Vercel automatically rebuilds and deploys

### Backend Updates
1. Push changes to GitHub
2. Railway automatically rebuilds and deploys

## Monitoring & Logs

### Railway
- View logs in Railway dashboard
- Monitor database performance
- Check resource usage (stay within free tier limits)

### Vercel
- View deployment logs
- Monitor function invocations
- Check bandwidth usage

## Cost Breakdown

- **Vercel Frontend**: $0/month (unlimited)
- **Railway Backend + Database**: ~$0/month (with $5 monthly credit, ~500 hours/month)
- **Google Cloud Storage**: Pay per use (minimal for small usage)
- **Google AI API**: Pay per use (estimate based on usage)

## Troubleshooting

### Backend won't start
- Check Railway logs for errors
- Verify all environment variables are set
- Ensure DATABASE_URL is set by Railway

### Database connection failed
- Verify PostgreSQL service is running in Railway
- Check DATABASE_URL format
- Ensure SSL configuration is correct

### Frontend can't connect to backend
- Verify CORS is configured correctly
- Check VITE_API_BASE_URL is set in Vercel
- Test backend health endpoint directly

### File upload errors
- Verify Google Cloud Storage credentials
- Check bucket permissions
- Ensure service account has proper roles

### AI features not working
- Verify GOOGLE_AI_API_KEY is correct
- Check API quota limits
- Monitor Railway logs for AI API errors

## Security Recommendations

1. **Rotate secrets regularly**: Change JWT_SECRET periodically
2. **Use strong passwords**: For SEED_DEFAULT_PASSWORD
3. **Enable HTTPS only**: Both Vercel and Railway provide HTTPS by default
4. **Monitor API usage**: Watch Google Cloud costs
5. **Set up alerts**: Configure Railway and Vercel alerts for errors

## Scaling Considerations

When you outgrow free tiers:

1. **Railway**: Upgrade to hobby plan ($5-10/month) for more resources
2. **Database**: Consider Neon.tech or Supabase for dedicated database hosting
3. **File Storage**: Evaluate Cloudinary or Supabase Storage as alternatives
4. **CDN**: Vercel Pro for enhanced CDN and analytics

## Next Steps

1. Set up custom domain (optional)
2. Configure monitoring and alerts
3. Set up automated backups for database
4. Implement CI/CD pipeline for automated testing
5. Add performance monitoring (e.g., Sentry)

## Support

- Railway Docs: https://docs.railway.app
- Vercel Docs: https://vercel.com/docs
- Google Cloud Docs: https://cloud.google.com/docs
