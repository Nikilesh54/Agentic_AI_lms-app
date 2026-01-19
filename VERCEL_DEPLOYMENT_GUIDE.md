# Vercel Frontend Deployment Guide

Complete step-by-step guide to deploy your React frontend to Vercel.

## Prerequisites

✅ Backend is deployed on Render (DONE!)
✅ You have your Render backend URL (e.g., `https://lms-backend.onrender.com`)

---

## Step 1: Update Frontend Environment Variable

**Before deploying**, update the frontend to point to your production backend:

1. Open `frontend/.env.production`
2. Replace `https://your-app.railway.app/api` with your actual Render URL
3. Example:
   ```bash
   VITE_API_BASE_URL=https://lms-backend.onrender.com/api
   ```
4. Save the file
5. Commit and push:
   ```bash
   git add frontend/.env.production
   git commit -m "Update production API URL"
   git push
   ```

---

## Step 2: Sign Up / Login to Vercel

1. Go to https://vercel.com
2. Click **"Sign Up"** (or "Login" if you have an account)
3. Choose **"Continue with GitHub"**
4. Authorize Vercel to access your GitHub account

---

## Step 3: Create New Project

1. On Vercel dashboard, click **"Add New..."** → **"Project"**
2. Click **"Import"** next to your repository:
   - `Nikilesh54/Agentic_AI_lms-app`
3. If you don't see your repo, click **"Adjust GitHub App Permissions"** to grant access

---

## Step 4: Configure Project Settings

### Framework Preset
- **Framework**: Automatically detects **Vite** ✅

### Root Directory
- Click **"Edit"** next to Root Directory
- Enter: `frontend`
- Click **"Continue"**

### Build & Development Settings
These should auto-populate, but verify:
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Install Command**: `npm install`

---

## Step 5: Add Environment Variables

Click **"Environment Variables"** section:

**Add this variable:**

| Name | Value |
|------|-------|
| `VITE_API_BASE_URL` | `https://your-backend.onrender.com/api` |

**Important:** Replace `your-backend.onrender.com` with your actual Render backend URL!

Example:
```
Name: VITE_API_BASE_URL
Value: https://lms-backend.onrender.com/api
```

Click **"Add"** to save the variable.

---

## Step 6: Deploy!

1. Click **"Deploy"** button
2. Vercel will:
   - Clone your repository
   - Install dependencies
   - Build your React app
   - Deploy to global CDN
3. Wait 1-2 minutes for deployment to complete

---

## Step 7: Get Your Live URL

Once deployment completes:

1. You'll see **"Congratulations!"** message
2. Your app URL will be shown, like:
   - `https://agentic-ai-lms-app.vercel.app`
   - or `https://your-project-name-xxxx.vercel.app`
3. Click **"Visit"** to open your live app!

---

## Step 8: Test Your Application

1. Visit your Vercel URL
2. **First load might take 30-60 seconds** (backend cold start on Render free tier)
3. Test login:
   - Email: `root@admin.com`
   - Password: Your `SEED_DEFAULT_PASSWORD` from Render environment
4. Test features:
   - Create a course
   - Upload files
   - Test AI chat
   - Create assignments

---

## Troubleshooting

### ❌ Build Failed

**Error**: `npm run build failed`

**Solution**:
1. Check Vercel build logs for specific error
2. Make sure you set **Root Directory** to `frontend`
3. Verify `package.json` has correct scripts

### ❌ Blank Page / Won't Load

**Error**: App loads but shows blank page

**Solution**:
1. Check browser console (F12 → Console tab)
2. Look for CORS errors
3. Verify `VITE_API_BASE_URL` is set correctly in Vercel environment variables
4. Make sure backend URL ends with `/api`

### ❌ Can't Connect to Backend

**Error**: "Network Error" or API requests fail

**Solution**:
1. Test backend directly in browser:
   - Visit `https://your-backend.onrender.com/api/health`
   - Should return: `{"message":"LMS API is running!"}`
2. If backend is down, check Render logs
3. If backend is up, check CORS settings in backend
4. Verify environment variable in Vercel dashboard

### ❌ Backend Super Slow

**Normal on Render Free Tier**:
- First request after 15 min idle takes 30-60 seconds
- This is expected behavior (cold start)
- Subsequent requests are fast

### ❌ Wrong API URL

**Error**: 404 errors or wrong backend

**Solution**:
1. Go to Vercel dashboard → Your project
2. Click **"Settings"** → **"Environment Variables"**
3. Edit `VITE_API_BASE_URL` to correct URL
4. Click **"Save"**
5. Go to **"Deployments"** → Click **"..."** on latest deploy → **"Redeploy"**

---

## Environment Variables Reference

### Frontend (Vercel)

| Variable | Value | Required |
|----------|-------|----------|
| `VITE_API_BASE_URL` | Your Render backend URL + `/api` | ✅ Yes |

Example:
```bash
VITE_API_BASE_URL=https://lms-backend.onrender.com/api
```

**Note**: Must include `/api` at the end!

---

## Auto-Deployment

Vercel automatically deploys when you push to GitHub:

1. Make changes to your code
2. Commit and push:
   ```bash
   git add .
   git commit -m "Your changes"
   git push
   ```
3. Vercel detects the push and rebuilds automatically
4. New version goes live in 1-2 minutes

---

## Custom Domain (Optional)

Want to use your own domain instead of `vercel.app`?

1. Go to Vercel dashboard → Your project
2. Click **"Settings"** → **"Domains"**
3. Enter your domain (e.g., `mylms.com`)
4. Follow Vercel's DNS configuration instructions
5. Wait for DNS to propagate (can take up to 48 hours)

**Free domains**: Get a free domain from:
- Freenom (free .tk, .ml, .ga domains)
- InfinityFree (free .rf.gd domains)
- Or use Vercel's provided domain

---

## Performance & Limits

### Vercel Free Tier Limits:
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Auto-scaling

### Should Be More Than Enough For:
- Student projects
- Portfolio demos
- Small classes (50-100 students)
- Development/testing

---

## Monitoring

### View Deployment Logs:
1. Vercel dashboard → Your project
2. Click **"Deployments"** tab
3. Click on any deployment
4. View real-time logs

### View Analytics:
1. Click **"Analytics"** tab
2. See:
   - Page views
   - Unique visitors
   - Top pages
   - Performance metrics

---

## Quick Reference

| Action | Where |
|--------|-------|
| View live site | `https://your-project.vercel.app` |
| View deployments | Vercel → Deployments tab |
| Update env vars | Vercel → Settings → Environment Variables |
| View logs | Vercel → Deployments → Click deployment |
| Redeploy | Vercel → Deployments → ... → Redeploy |
| Domain settings | Vercel → Settings → Domains |

---

## Summary Checklist

Before deploying:
- ✅ Update `frontend/.env.production` with backend URL
- ✅ Commit and push changes

During deployment:
- ✅ Set Root Directory to `frontend`
- ✅ Add `VITE_API_BASE_URL` environment variable
- ✅ Verify build settings

After deployment:
- ✅ Test login
- ✅ Test all features
- ✅ Verify backend connection
- ✅ Check for errors in browser console

---

## Cost

**Total Cost: $0/month**

- Vercel: FREE
- Render: FREE (with cold starts)
- Neon: FREE (0.5GB database)

Only pay for Google Cloud services (~$1-7/month for storage + AI API)

---

## You're Done! 🎉

Your LMS is now live at:
- **Frontend**: `https://your-app.vercel.app`
- **Backend**: `https://your-backend.onrender.com`

Share the URL with your students/users and enjoy your fully deployed LMS!

---

## Need Help?

- Vercel Docs: https://vercel.com/docs
- Vercel Community: https://github.com/vercel/vercel/discussions
- Check browser console (F12) for errors
- Check Vercel deployment logs for build errors
