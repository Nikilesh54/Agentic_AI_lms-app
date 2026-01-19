# Database Migration Guide: Local PostgreSQL → Neon

Complete guide to transfer your local `lms_db` database to Neon.tech.

---

## Prerequisites

✅ pgAdmin installed (you have this)
✅ Local database: `lms_db` with data
✅ Neon account created
✅ Neon connection string from earlier

---

## Method 1: Using pgAdmin (Recommended - Easy GUI)

### Step 1: Export Local Database

1. **Open pgAdmin**
2. **Connect to your local server**:
   - Expand "Servers" → "PostgreSQL"
   - Enter password if prompted
3. **Right-click on `lms_db` database**
4. **Select "Backup..."**
5. **Configure backup**:
   - **Filename**: Choose location like `C:\Users\nikil\Desktop\lms_backup.sql`
   - **Format**: Plain (*.sql)
   - **Encoding**: UTF8
   - **Role name**: postgres
6. **Go to "Dump Options #1" tab**:
   - ✅ Check "Pre-data"
   - ✅ Check "Data"
   - ✅ Check "Post-data"
7. **Go to "Dump Options #2" tab**:
   - ✅ Check "Use INSERT commands"
   - ✅ Check "Include CREATE DATABASE statement" (UNCHECK this!)
   - ✅ Check "Include DROP DATABASE statement" (UNCHECK this!)
8. **Click "Backup"**
9. **Wait for completion** (bottom right will show "Process completed")

### Step 2: Clean Up Backup File (Important!)

The backup file might have some Neon-incompatible commands. Let's clean it:

1. **Open the backup file** in a text editor (VS Code, Notepad++)
2. **Remove these lines** if they exist:
   ```sql
   CREATE DATABASE lms_db;
   DROP DATABASE lms_db;
   \connect lms_db
   ```
3. **Save the file**

### Step 3: Connect to Neon Database

1. **In pgAdmin, right-click "Servers"** → **"Register" → "Server"**
2. **General tab**:
   - **Name**: `Neon - LMS Database`
3. **Connection tab**:
   - **Host name/address**: `ep-xyz.region.aws.neon.tech` (from your connection string)
   - **Port**: `5432`
   - **Maintenance database**: `neondb` (or your database name)
   - **Username**: Copy from connection string
   - **Password**: Copy from connection string
   - ✅ Check "Save password"
4. **SSL tab**:
   - **SSL mode**: Require
5. **Click "Save"**

### Step 4: Import to Neon

1. **In pgAdmin, connect to Neon server**
2. **Find your database** (usually `neondb`)
3. **Right-click on the database** → **"Query Tool"**
4. **Open your backup file**:
   - Click folder icon (📁) → Select `lms_backup.sql`
   - Or copy-paste the entire SQL content
5. **Click "Execute" (▶️ button)**
6. **Wait for import to complete**
   - You'll see messages in the bottom panel
   - Check for any errors

### Step 5: Verify Migration

1. **In pgAdmin, refresh the Neon database**
2. **Expand**: Schemas → public → Tables
3. **Verify all tables exist**:
   - users
   - courses
   - enrollments
   - assignments
   - announcements
   - course_materials
   - assignment_submissions
   - chat_sessions
   - chat_messages
   - etc.
4. **Check data**: Right-click a table → "View/Edit Data" → "All Rows"

---

## Method 2: Using Command Line (Advanced)

### Step 1: Set Password Environment Variable

```bash
# Windows PowerShell
$env:PGPASSWORD="040601"

# Or create .pgpass file
# In C:\Users\nikil\AppData\Roaming\postgresql\pgpass.conf
# Add line: localhost:5432:lms_db:postgres:040601
```

### Step 2: Export Database

```bash
cd C:\Users\nikil\lms-app\backend

# Export to SQL file
pg_dump -h localhost -p 5432 -U postgres -d lms_db -f lms_backup.sql

# Or export with custom format (smaller, faster)
pg_dump -h localhost -p 5432 -U postgres -d lms_db -F c -f lms_backup.dump
```

### Step 3: Import to Neon

**Using SQL file:**
```bash
# Replace with your Neon connection string
psql "postgresql://user:password@ep-xyz.region.aws.neon.tech/neondb?sslmode=require" -f lms_backup.sql
```

**Using dump file:**
```bash
pg_restore --verbose --no-owner --no-acl -h ep-xyz.region.aws.neon.tech -p 5432 -U neondb_owner -d neondb lms_backup.dump
```

---

## Method 3: Using Neon's Web SQL Editor

If the above methods don't work:

1. **Go to Neon Console**: https://console.neon.tech
2. **Select your project** → **SQL Editor**
3. **Copy your backup SQL** (in smaller chunks if large)
4. **Paste and execute** in the SQL editor
5. **Repeat** for the entire backup

---

## Troubleshooting

### Error: "relation already exists"

**Solution**: Your Render deployment already created the tables. You have two options:

**Option A: Drop and recreate** (if you want fresh import)
```sql
-- In Neon SQL Editor, drop all tables first
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Then import your backup
```

**Option B: Keep existing schema, only import data**
When exporting from pgAdmin:
- Go to "Dump Options #1"
- ✅ Check ONLY "Data"
- ⬜ Uncheck "Pre-data" and "Post-data"

### Error: "permission denied"

**Solution**: Neon user might not have permissions. Use the `--no-owner --no-acl` flags:
```bash
pg_restore --no-owner --no-acl -d neondb lms_backup.dump
```

### Error: "database is too large"

**Solution**: Neon free tier has 0.5GB limit. Check your database size:
```sql
SELECT pg_size_pretty(pg_database_size('lms_db'));
```

If over 0.5GB, you might need to:
1. Delete old/test data
2. Upgrade Neon plan
3. Use a different database service

### Import is very slow

**Solution**: Disable constraints during import:
```sql
-- Before import
SET session_replication_role = replica;

-- Import your data here

-- After import
SET session_replication_role = DEFAULT;
```

---

## Quick Summary

**Easiest Method (pgAdmin):**
1. Open pgAdmin → Right-click `lms_db` → Backup → Save as SQL
2. Register Neon server in pgAdmin
3. Open Query Tool on Neon database
4. Execute your backup SQL

**Important Notes:**
- Remove `CREATE DATABASE` and `DROP DATABASE` from backup
- Use SSL when connecting to Neon
- Verify data after migration

---

## After Migration

Once migration is complete:

1. **Test your deployed app**: Visit your Vercel URL
2. **Try logging in** with existing users
3. **Check if data appears** correctly
4. **If login fails**: The root user might not exist in Neon
   - Your Render backend will create it on first startup
   - Use the credentials from your `SEED_DEFAULT_PASSWORD` env var

---

## Need Help?

If you encounter issues:
1. Check Neon dashboard for connection details
2. Verify SSL is enabled
3. Check Neon logs for errors
4. Make sure database size is under 0.5GB (free tier limit)
