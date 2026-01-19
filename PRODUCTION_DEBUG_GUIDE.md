# Production Debugging Guide

## Issues Identified

1. **"Failed to create course"** error when logged in as root
2. **"User with this email already exists"** error but user not visible in Neon
3. Database connectivity unclear

## Step-by-Step Debugging

### Step 1: Test Database Connection

Visit this URL in your browser (replace with your actual backend URL):
```
https://your-backend-url.vercel.app/api/db-test
```

This will tell you:
- ✅ If database is connected
- ✅ How many users exist
- ✅ How many courses exist
- ✅ Which environment variables are set

**Expected Result:**
```json
{
  "success": true,
  "message": "Database connection successful",
  "data": {
    "currentTime": "2026-01-19...",
    "database": "your_neon_db_name",
    "userCount": "1",
    "courseCount": "0",
    "env": {
      "NODE_ENV": "production",
      "hasDatabaseUrl": true,
      "hasJwtSecret": true,
      "hasSeedPassword": true
    }
  }
}
```

### Step 2: Fix Environment Variables

On your hosting platform (Vercel/Railway/Render), set these environment variables:

```bash
# Required - Get from Neon dashboard
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require

# Required - Copy from your local .env
JWT_SECRET=7kN9mP2qR5tW8xA1bC4eF6gH9jL0nM3pQ6sT9vY2zB5dE8fG1hJ4kM7oP0rS3uV6

# Required - Set to your root user's password
SEED_DEFAULT_PASSWORD=your_actual_root_password

# Required
NODE_ENV=production
```

**After setting these, redeploy your backend!**

### Step 3: Check Neon Database Directly

1. Go to Neon Console: https://console.neon.tech
2. Select your project
3. Go to SQL Editor
4. Run these queries:

```sql
-- Check all users (should see root user)
SELECT id, full_name, email, role, status, created_at
FROM users
ORDER BY created_at DESC;

-- Check for Student1@gmail.com
SELECT id, full_name, email, role, status
FROM users
WHERE LOWER(email) = LOWER('Student1@gmail.com');

-- Check all courses
SELECT id, title, description, instructor_id, created_at
FROM courses
ORDER BY created_at DESC;
```

### Step 4: Test Course Creation

After fixing environment variables and redeploying:

1. Login as root user
2. Try to create a course
3. If it fails, check backend logs in your hosting platform

### Step 5: Check Backend Logs

On your hosting platform:

**Vercel:**
- Go to your project dashboard
- Click on "Logs" tab
- Look for errors when creating a course

**Railway:**
- Go to your service
- Click on "Deployments"
- Click on the active deployment
- View logs

**Render:**
- Go to your web service
- Click on "Logs" tab

Look for errors like:
- Database connection errors
- Missing environment variables
- SQL errors

## Common Issues & Solutions

### Issue 1: "Failed to create course"

**Possible causes:**
- Missing `DATABASE_URL` environment variable
- Database connection string is wrong
- SSL mode not enabled in connection string

**Solution:**
```bash
# Make sure your DATABASE_URL has ?sslmode=require at the end
DATABASE_URL=postgresql://user:pass@host.neon.tech/db?sslmode=require
```

### Issue 2: "User with this email already exists"

**Possible causes:**
- User exists but in a different database (you're looking at the wrong one)
- Transaction rolled back but error was thrown
- Case sensitivity issue with email

**Solution:**
Run this in Neon SQL Editor:
```sql
-- Check for all variations of the email
SELECT id, email FROM users WHERE email ILIKE '%student1%';

-- If found, delete it
DELETE FROM users WHERE email = 'Student1@gmail.com';
```

### Issue 3: Root user not seeded

**Cause:** Missing `SEED_DEFAULT_PASSWORD` environment variable

**Solution:**
1. Set `SEED_DEFAULT_PASSWORD` in hosting platform
2. Redeploy backend
3. Backend will automatically seed root user on startup

## Testing Checklist

After fixing environment variables:

- [ ] Visit `/api/db-test` endpoint - shows connection successful
- [ ] Visit `/api/health` endpoint - shows API is running
- [ ] Login as root user - successful
- [ ] Create a new course - successful
- [ ] Create a demo student user - successful
- [ ] Login as student - successful
- [ ] Enroll in course - successful

## Get Your Neon Connection String

1. Go to https://console.neon.tech
2. Select your project
3. Click on "Dashboard"
4. Look for "Connection string"
5. Copy the connection string that looks like:
   ```
   postgresql://username:password@ep-xxx.region.neon.tech/dbname?sslmode=require
   ```
6. Paste this as `DATABASE_URL` in your hosting platform

## Final Steps

1. ✅ Set all environment variables on hosting platform
2. ✅ Redeploy backend
3. ✅ Test `/api/db-test` endpoint
4. ✅ Test course creation
5. ✅ If still failing, check backend logs
6. ✅ Share the specific error message from logs

## Need More Help?

If issues persist after following this guide, check:

1. Backend logs for specific error messages
2. Network tab in browser DevTools for API response
3. Neon dashboard for database connectivity status
4. Ensure all tables are created (run migrations if needed)
