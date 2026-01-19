# Production Testing Guide

After deploying the updated backend to Render, test these endpoints in order.

Replace `YOUR_BACKEND_URL` with your actual Render URL (e.g., `https://your-app.onrender.com`)

## Test 1: Health Check

```bash
curl https://YOUR_BACKEND_URL/api/health
```

**Expected:**
```json
{
  "message": "LMS API is running!"
}
```

## Test 2: Database Connection

```bash
curl https://YOUR_BACKEND_URL/api/db-test
```

**What to check:**
- `success: true`
- `userCount` should be at least 1 (root user)
- `allUsers` - you should see your root user
- `student1Exists` - tells us if Student1@gmail.com exists
- All env variables should be `true`

## Test 3: Check Student1 Email

```bash
curl https://YOUR_BACKEND_URL/api/check-email/Student1@gmail.com
```

**What to check:**
- `exactMatch` - exact match for Student1@gmail.com
- `caseInsensitiveMatch` - case-insensitive match
- `allEmails` - all emails in the database

## Test 4: Test Course Creation (No Auth Required)

```bash
curl -X POST https://YOUR_BACKEND_URL/api/test-create-course \
  -H "Content-Type: application/json" \
  -d '{"title": "Debug Test Course", "description": "Testing course creation"}'
```

**Expected if working:**
```json
{
  "success": true,
  "message": "Test course created successfully",
  "course": {
    "id": 1,
    "title": "Debug Test Course",
    "description": "Testing course creation",
    ...
  }
}
```

**If this works, then database is fine and the issue is in authentication/authorization.**

## Test 5: Try Creating Course Through Root User

1. Login to your frontend as root user
2. Try to create a course through the UI
3. Check browser DevTools → Network tab
4. Look at the response from the POST request
5. Copy the error message

## Interpreting Results

### If Test 2 shows `student1Exists: true`

The user DOES exist in the database. The issue is:
- You're looking at the wrong database in Neon SQL Editor
- Or you're in a different Neon project

**Solution:** Use the `/api/check-email/` endpoint as source of truth.

### If Test 4 succeeds but root user course creation fails

The issue is with:
- Authentication (JWT token invalid)
- Authorization (root role check failing)
- Missing headers in the request

**Solution:** Check browser DevTools Network tab for the actual error response.

### If Test 4 fails

The issue is with:
- Database connection
- Database permissions
- SQL syntax (unlikely, but possible)

**Solution:** Check the error message in the response.

## Common Issues

### Issue: "relation 'courses' does not exist"

**Cause:** Tables not created in Neon database.

**Solution:**
1. Backend should auto-create tables on startup
2. Check Render logs to see if table creation succeeded
3. If not, manually run the SQL from `database.ts` in Neon SQL Editor

### Issue: Connection timeout

**Cause:** Wrong DATABASE_URL or network issue.

**Solution:**
1. Verify DATABASE_URL is correct in Render
2. Check Neon dashboard to ensure database is running
3. Try removing `&channel_binding=require` from DATABASE_URL

### Issue: JWT_SECRET not set

**Cause:** Missing JWT_SECRET in Render.

**Solution:**
Add it in Render environment variables:
```
JWT_SECRET=7kN9mP2qR5tW8xA1bC4eF6gH9jL0nM3pQ6sT9vY2zB5dE8fG1hJ4kM7oP0rS3uV6
```

## Next Steps

1. Run all 5 tests above
2. Send me the results of each test
3. Send me the error from Render logs when you try to create a course as root
4. Based on results, we'll know exactly where the issue is

The debug endpoints I added will tell us:
- ✅ Is the database connected?
- ✅ Does Student1@gmail.com actually exist?
- ✅ Can we create courses directly?
- ✅ Are environment variables set correctly?

This will pinpoint the exact issue.
