# Quick Start Deployment Guide

Follow these steps in order to deploy your LMS application for free.

## 🚀 Quick Deploy Steps

### 1️⃣ Push to GitHub (if not already done)

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 2️⃣ Deploy Backend to Railway (15 minutes)

1. **Go to https://railway.app** → Sign up/Login with GitHub
2. **Click "New Project"** → "Deploy from GitHub repo"
3. **Select your repository** → Railway detects Node.js automatically
4. **Add PostgreSQL Database**:
   - Click "New" → "Database" → "PostgreSQL"
   - Railway auto-creates `DATABASE_URL` variable
5. **Add Environment Variables** (click on your service → Variables tab):

```bash
PORT=5000
NODE_ENV=production
JWT_SECRET=GENERATE_THIS_SEE_BELOW
SEED_DEFAULT_PASSWORD=YourStrongPassword123!
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GCS_BUCKET_NAME=your-bucket-name
GOOGLE_AI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash-exp
AI_PROVIDER=gemini
AI_TEMPERATURE=0.2
AI_MAX_TOKENS=2048
COVE_ENABLED=true
COVE_CONFIDENCE_THRESHOLD=0.7
```

**Generate JWT_SECRET**: Run this in your terminal:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

6. **For Google Cloud Storage credentials**, add:
```bash
GOOGLE_CLOUD_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_CLOUD_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nKey\nHere\n-----END PRIVATE KEY-----\n"
```
(Copy from your `gcs-key.json` file)

7. **Deploy!** → Railway automatically builds and deploys
8. **Copy your backend URL** (looks like: `https://lms-backend-production-xxxx.railway.app`)

### 3️⃣ Deploy Frontend to Vercel (10 minutes)

1. **Go to https://vercel.com** → Sign up/Login with GitHub
2. **Click "Add New Project"** → Import your GitHub repository
3. **Configure Project**:
   - Framework Preset: **Vite**
   - Root Directory: **`frontend`**
   - Build Command: `npm run build` (auto-detected)
   - Output Directory: `dist` (auto-detected)
4. **Add Environment Variable**:
   - Name: `VITE_API_BASE_URL`
   - Value: `https://your-app.railway.app/api` (your Railway URL from step 2)
5. **Click Deploy!**
6. **Visit your app** at the Vercel URL (e.g., `https://lms-app.vercel.app`)

### 4️⃣ Update Production Environment File

Edit `frontend/.env.production` with your actual Railway URL:

```bash
VITE_API_BASE_URL=https://your-actual-railway-url.railway.app/api
```

Then redeploy frontend (Vercel auto-deploys on git push).

### 5️⃣ Test Your Deployment ✅

1. Visit your Vercel URL
2. Create an account
3. Login as root user:
   - Email: `root@admin.com`
   - Password: Whatever you set as `SEED_DEFAULT_PASSWORD`
4. Test features:
   - Create a course
   - Upload files
   - Test AI chat

## 🎉 Done!

Your LMS is now live at:
- **Frontend**: `https://your-app.vercel.app`
- **Backend**: `https://your-app.railway.app`

## 📝 Important Notes

- **Railway Free Tier**: 500 hours/month (~20 days) + $5 credit
- **Vercel Free Tier**: Unlimited deploys, 100GB bandwidth/month
- **Auto-deploys**: Both platforms auto-deploy when you push to GitHub
- **HTTPS**: Automatically enabled on both platforms
- **Custom Domain**: Can add later in Vercel/Railway settings

## 🔧 Troubleshooting

**Backend not starting?**
- Check Railway logs (click on service → Deployments → View logs)
- Verify all environment variables are set
- Make sure DATABASE_URL exists (auto-created with PostgreSQL)

**Frontend can't reach backend?**
- Check CORS settings in backend
- Verify VITE_API_BASE_URL is correct
- Test backend directly: `https://your-backend.railway.app/api/health`

**Database errors?**
- Railway PostgreSQL should auto-configure
- Check that DATABASE_URL is set in environment variables
- Verify tables are created (check logs for migration errors)

**File upload fails?**
- Verify Google Cloud Storage credentials are correct
- Check bucket permissions (service account needs write access)
- Test GCS connection in Railway logs

## 📚 Full Documentation

For detailed information, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

## 🆘 Need Help?

- Railway Docs: https://docs.railway.app
- Vercel Docs: https://vercel.com/docs
- Check logs in both platforms for specific error messages
