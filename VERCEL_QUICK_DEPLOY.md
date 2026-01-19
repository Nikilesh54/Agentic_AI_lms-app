# Quick Vercel Deployment - 10 Minutes

Follow these exact steps to deploy your frontend to Vercel.

---

## Before You Start

**You need your Render backend URL!**

Find it in Render dashboard (looks like):
- `https://lms-backend.onrender.com`
- or `https://lms-backend-xxxx.onrender.com`

Copy this URL - you'll need it!

---

## Step 1: Update Frontend Config (2 min)

1. Open `frontend/.env.production` file
2. Replace the URL with YOUR Render backend URL:
   ```bash
   VITE_API_BASE_URL=https://YOUR-BACKEND-URL.onrender.com/api
   ```
   **IMPORTANT**: Add `/api` at the end!

3. Save the file
4. Commit and push:
   ```bash
   git add frontend/.env.production
   git commit -m "Update production API URL"
   git push
   ```

---

## Step 2: Create Vercel Project (5 min)

1. **Go to**: https://vercel.com
2. **Click**: "Sign Up" → "Continue with GitHub"
3. **Click**: "Add New..." → "Project"
4. **Import**: Select your `Agentic_AI_lms-app` repository

---

## Step 3: Configure Settings (2 min)

### Root Directory:
- Click **"Edit"**
- Enter: `frontend`
- Click **"Continue"**

### Build Settings (auto-detected):
- ✅ Framework: **Vite**
- ✅ Build Command: `npm run build`
- ✅ Output Directory: `dist`

### Environment Variables:
Click **"Environment Variables"** and add:

```
Name:  VITE_API_BASE_URL
Value: https://YOUR-BACKEND-URL.onrender.com/api
```

Replace `YOUR-BACKEND-URL.onrender.com` with your actual Render URL!

---

## Step 4: Deploy! (1 min)

1. **Click**: "Deploy"
2. **Wait**: 1-2 minutes
3. **Done!** You'll get a URL like:
   - `https://agentic-ai-lms-app.vercel.app`

---

## Step 5: Test Your App (2 min)

1. **Visit**: Your Vercel URL
2. **Wait**: 30-60 seconds on first load (backend cold start)
3. **Login**:
   - Email: `root@admin.com`
   - Password: Your `SEED_DEFAULT_PASSWORD`
4. **Test**: Create course, upload files, test AI chat

---

## Troubleshooting

### Problem: Blank Page
**Solution**: Check browser console (F12). Verify `VITE_API_BASE_URL` is correct.

### Problem: Can't Connect to Backend
**Solution**:
1. Test backend: Visit `https://your-backend.onrender.com/api/health`
2. Should show: `{"message":"LMS API is running!"}`
3. If not working, check Render logs

### Problem: Build Failed
**Solution**: Make sure Root Directory is set to `frontend`

### Problem: Backend Super Slow
**Normal**: First request after 15 min takes 30-60s (Render free tier cold start)

---

## Quick Settings Summary

| Setting | Value |
|---------|-------|
| Root Directory | `frontend` |
| Framework | Vite |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| Environment Variable | `VITE_API_BASE_URL` |
| Variable Value | `https://your-backend.onrender.com/api` |

---

## That's It! 🎉

Your LMS is now live:
- **Frontend**: `https://your-app.vercel.app`
- **Backend**: `https://your-backend.onrender.com`

Auto-deploys on every git push! 🚀

---

## Need More Help?

See the full guide: [VERCEL_DEPLOYMENT_GUIDE.md](./VERCEL_DEPLOYMENT_GUIDE.md)
