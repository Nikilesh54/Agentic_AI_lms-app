# Debugging Steps - FOLLOW IN ORDER

## Issue Summary
- ✅ "Failed to create course" when logged in as root
- ✅ "User with this email already exists" but SQL query shows no user

## STEP 1: Deploy Updated Backend

I've added debug endpoints. Push and deploy:

```bash
git add .
git commit -m "Add debug endpoints for production troubleshooting"
git push
```

Then redeploy on Render.

## STEP 2: Test Database Connection

Visit this URL (replace with your actual backend URL):

```
https://your-backend.onrender.com/api/db-test
```

**What to look for:**
- `success: true` - database is connected
- `userCount` - how many users exist
- `courseCount` - how many courses exist
- `allUsers` - list of ALL users in database
- `student1Exists` - whether Student1@gmail.com exists
- All env variables should show `true`

**Send me the FULL JSON response you see.**

## STEP 3: Check Specific Email

Visit this URL:

```
https://your-backend.onrender.com/api/check-email/Student1@gmail.com
```

This will show:
- Exact email match
- Case-insensitive match
- All emails in the database

**Send me the FULL JSON response.**

## STEP 4: Verify Database Name

Your DATABASE_URL is:
```
postgresql://neondb_owner:npg_Xsq98fPVAMYy@ep-royal-sky-a-hur5xae-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

The database name is **neondb**.

In Neon SQL Editor:
1. Make sure you're querying the **neondb** database (check top-left dropdown)
2. Run: `SELECT current_database();`
3. It should return: `neondb`

**Confirm you're querying the correct database.**

## STEP 5: Course Creation Test

After confirming database connection:

1. Login as root user
2. Try to create a course
3. If it fails, check Render logs:
   - Go to Render dashboard
   - Click on your web service
   - Click "Logs" tab
   - Look for errors when you try to create the course

**Send me the EXACT error message from Render logs.**

## STEP 6: Student1@gmail.com Investigation

After Step 2 and 3, we'll know:
- Does Student1@gmail.com exist in the database?
- Is it a case sensitivity issue?
- Are you querying the wrong database in Neon?

## Most Likely Issues

### Issue A: Wrong Database in Neon SQL Editor

**Problem:** You're querying a different database in Neon SQL Editor than your app uses.

**Solution:**
- Your app uses database name: `neondb`
- In Neon SQL Editor, check the database dropdown (top-left)
- Select `neondb`

### Issue B: Multiple Neon Projects

**Problem:** You might have multiple Neon projects and are looking at the wrong one.

**Solution:**
- In Neon dashboard, confirm you're in the correct project
- The connection string should match

### Issue C: Pooler vs Direct Connection

**Problem:** Your app connects via pooler, Neon SQL Editor uses direct connection.

**Solution:**
- Both should query the same data, but there might be a slight delay
- Try refreshing the query in Neon SQL Editor after a few seconds

### Issue D: Transaction Not Committed

**Problem:** The user was created but transaction rolled back due to an error.

**Solution:**
- The `/api/db-test` endpoint will show the ACTUAL state
- Trust that endpoint more than manual queries

## What I Need From You

**After deploying and testing, send me:**

1. ✅ Full JSON from `/api/db-test` endpoint
2. ✅ Full JSON from `/api/check-email/Student1@gmail.com` endpoint
3. ✅ Screenshot of Neon SQL Editor showing which database you're querying
4. ✅ Error message from Render logs when creating a course
5. ✅ Confirm all environment variables are set in Render:
   - DATABASE_URL
   - JWT_SECRET
   - SEED_DEFAULT_PASSWORD
   - NODE_ENV=production

## Quick Fixes If Issues Persist

### Fix 1: Clear Neon Database and Reseed

If Student1 exists but shouldn't:

```sql
-- In Neon SQL Editor, run:
DELETE FROM users WHERE email = 'Student1@gmail.com';
```

### Fix 2: Check Course Creation Permission

The root user creating courses should work. The code at line 152-189 in [root.ts](c:\Users\nikil\lms-app\backend\src\routes\root.ts#L152-L189) looks correct.

If it's failing, it's likely:
- Missing DATABASE_URL
- Wrong DATABASE_URL format
- Database permission issue

The `/api/db-test` endpoint will reveal this.

## IMPORTANT

Don't trust the Neon SQL Editor until you've confirmed:
1. ✅ You're in the right project
2. ✅ You're querying the right database (neondb)
3. ✅ The query results match what `/api/db-test` shows

The `/api/db-test` endpoint queries the EXACT same database your app uses, so that's the source of truth.
