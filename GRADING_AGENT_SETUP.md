# Auto-Grading Agent - Quick Setup Guide

## Prerequisites
- PostgreSQL database running
- Node.js and npm installed
- Google AI API key (Gemini)

---

## Step 1: Apply Database Migration

Navigate to backend and run the migration:

```bash
cd backend
psql -U postgres -d lms_db -f migrations/add_ai_grading_criteria.sql
```

**Expected output**:
- Column `ai_grading_criteria` added to `assignments` table
- Index created for performance
- Trigger added for `updated_at` timestamp

---

## Step 2: Verify Environment Variables

Check your `backend/.env` file has:

```bash
# AI Service Configuration
AI_PROVIDER=gemini
GOOGLE_AI_API_KEY=your_actual_api_key_here
GEMINI_MODEL=gemini-2.0-flash-exp
AI_TEMPERATURE=0.7
AI_MAX_TOKENS=2048

# Database Configuration
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/lms_db
```

---

## Step 3: Install Dependencies (if needed)

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

---

## Step 4: Start the Application

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd frontend
npm run dev
```

---

## Step 5: Test the Auto-Grading

### As Professor:
1. Login to professor account
2. Create a new assignment with:
   - **Title**: "Essay on Climate Change"
   - **Description**: "Write a comprehensive essay discussing the impact of climate change"
   - **Question**: "Discuss three major effects of climate change and propose solutions"
   - **Points**: 100
3. Click "Create Assignment"
4. Wait 10 seconds, then check database:
   ```sql
   SELECT id, title, ai_grading_criteria FROM assignments ORDER BY created_at DESC LIMIT 1;
   ```
5. You should see extracted criteria in JSON format

### As Student:
1. Login to student account
2. Navigate to the course and find the assignment
3. Submit assignment with text answer
4. Click "Submit"
5. Wait 15-20 seconds, then refresh the page
6. **Warning Modal should appear** before showing tentative grade
7. Click "I Understand - Show Tentative Grade"
8. Verify you see:
   - ⚠️ Warning badge
   - Red disclaimer banner
   - Tentative grade score
   - Rubric breakdown
   - Strengths and improvements

### As Professor (Final Step):
1. Go to assignment submissions
2. View the student's tentative grade
3. Review AI feedback
4. Finalize the grade with your own feedback
5. Student should now see final grade (tentative grade disappears)

---

## Verification Checklist

- [ ] Migration applied successfully
- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Professor can create assignments
- [ ] `ai_grading_criteria` populates in database
- [ ] Student can submit assignments
- [ ] Tentative grade generates automatically
- [ ] Warning modal appears on first view
- [ ] Tentative grade displays with warnings
- [ ] Professor can finalize grades
- [ ] Final grade replaces tentative grade

---

## Troubleshooting

### Criteria not extracting
Check backend logs for:
```
✓ AI grading criteria extracted for assignment {id}
```

If you see errors:
1. Verify AI_PROVIDER and GOOGLE_AI_API_KEY in .env
2. Check Google AI API quota
3. Restart backend server

### Tentative grades not generating
Check backend logs for:
```
✓ Tentative grade generated for submission {id}
```

If you see errors:
1. Verify assignment has criteria or rubric
2. Check database connection
3. Review agent logs in console

### Modal not appearing
1. Open browser DevTools console
2. Check for JavaScript errors
3. Verify CSS file loaded
4. Clear browser cache

---

## Database Verification Queries

```sql
-- Check if migration applied
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'assignments' AND column_name = 'ai_grading_criteria';

-- View extracted criteria
SELECT
  id,
  title,
  ai_grading_criteria->>'complexity_level' as complexity,
  jsonb_array_length(ai_grading_criteria->'requirements') as num_requirements,
  jsonb_array_length(ai_grading_criteria->'key_topics') as num_topics
FROM assignments
WHERE ai_grading_criteria IS NOT NULL;

-- View tentative grades
SELECT
  tg.id,
  a.title as assignment,
  u.full_name as student,
  tg.tentative_grade,
  tg.max_points,
  tg.confidence_score,
  tg.is_final
FROM tentative_grades tg
JOIN assignment_submissions sub ON tg.submission_id = sub.id
JOIN assignments a ON sub.assignment_id = a.id
JOIN users u ON tg.student_id = u.id
ORDER BY tg.generated_at DESC;
```

---

## Success Indicators

When everything is working correctly:

1. **Backend Console**:
   ```
   ✓ AI grading criteria extracted for assignment 123
   ✓ Tentative grade generated for submission 456
   ```

2. **Database**:
   - `assignments.ai_grading_criteria` field populated
   - `tentative_grades` table has new records
   - Confidence scores between 0.5-0.9

3. **Frontend**:
   - Warning modal appears smoothly
   - Animations working (pulsing icon, shaking warning)
   - Tentative grade displays with full breakdown
   - No console errors

---

## Next Steps

Once verified working:
1. Test with different assignment types
2. Monitor AI accuracy and confidence scores
3. Gather professor feedback on tentative grades
4. Monitor API usage and costs
5. Consider adding rubric templates for common assignments

---

**Need Help?**
Check `GRADING_AGENT_IMPLEMENTATION.md` for detailed technical documentation.
