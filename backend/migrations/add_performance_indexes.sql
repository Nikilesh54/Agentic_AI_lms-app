-- =====================================================
-- Performance Indexes Migration
-- Run this to add indexes for frequently queried columns
-- =====================================================

-- Note: Run this with: psql -U postgres -d lms_db -f add_performance_indexes.sql

BEGIN;

-- =====================================================
-- COURSE MATERIAL EMBEDDINGS INDEXES
-- =====================================================

-- Index for looking up embeddings by material_id (used in verification agent)
CREATE INDEX IF NOT EXISTS idx_course_material_embeddings_material_id
  ON course_material_embeddings(material_id);

-- Composite index for efficient vector search filtering
CREATE INDEX IF NOT EXISTS idx_course_material_embeddings_course_lookup
  ON course_material_embeddings(material_id, chunk_id);

COMMENT ON INDEX idx_course_material_embeddings_material_id IS 'Speeds up verification agent queries for specific materials';
COMMENT ON INDEX idx_course_material_embeddings_course_lookup IS 'Composite index for faster chunk retrieval';

-- =====================================================
-- RESPONSE SOURCES INDEXES
-- =====================================================

-- Index for fetching sources by message_id (used when displaying trust scores)
CREATE INDEX IF NOT EXISTS idx_response_sources_message_id
  ON response_sources(message_id);

-- Index for filtering by source type
CREATE INDEX IF NOT EXISTS idx_response_sources_type
  ON response_sources(source_type);

COMMENT ON INDEX idx_response_sources_message_id IS 'Speeds up source attribution queries';
COMMENT ON INDEX idx_response_sources_type IS 'Allows efficient filtering by source type';

-- =====================================================
-- CHAT MESSAGES INDEXES
-- =====================================================

-- Index for fetching messages by session_id
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id
  ON chat_messages(session_id);

-- Index for user's messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id
  ON chat_messages(user_id);

-- Composite index for session messages ordered by timestamp
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_timestamp
  ON chat_messages(session_id, created_at DESC);

COMMENT ON INDEX idx_chat_messages_session_id IS 'Speeds up conversation history retrieval';
COMMENT ON INDEX idx_chat_messages_user_id IS 'Allows efficient user message queries';
COMMENT ON INDEX idx_chat_messages_session_timestamp IS 'Optimized for chronological message retrieval';

-- =====================================================
-- CHAT SESSIONS INDEXES
-- =====================================================

-- Index for user's sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id
  ON chat_sessions(user_id);

-- Index for course sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_course_id
  ON chat_sessions(course_id);

-- Composite index for user-course session lookup
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_course
  ON chat_sessions(user_id, course_id, created_at DESC);

COMMENT ON INDEX idx_chat_sessions_user_id IS 'Speeds up user session retrieval';
COMMENT ON INDEX idx_chat_sessions_course_id IS 'Allows efficient course session queries';
COMMENT ON INDEX idx_chat_sessions_user_course IS 'Optimized for user-course session listing';

-- =====================================================
-- AGENT AUDIT LOG INDEXES
-- =====================================================

-- Index for filtering by agent type
CREATE INDEX IF NOT EXISTS idx_agent_audit_log_agent_type
  ON agent_audit_log(agent_type);

-- Index for user activity tracking
CREATE INDEX IF NOT EXISTS idx_agent_audit_log_user_id
  ON agent_audit_log(user_id);

-- Index for course-specific audit logs
CREATE INDEX IF NOT EXISTS idx_agent_audit_log_course_id
  ON agent_audit_log(course_id);

-- Composite index for common audit queries
CREATE INDEX IF NOT EXISTS idx_agent_audit_log_user_course_date
  ON agent_audit_log(user_id, course_id, created_at DESC);

-- Index for error tracking
CREATE INDEX IF NOT EXISTS idx_agent_audit_log_errors
  ON agent_audit_log(created_at DESC)
  WHERE error_message IS NOT NULL;

COMMENT ON INDEX idx_agent_audit_log_agent_type IS 'Allows filtering by specific agent';
COMMENT ON INDEX idx_agent_audit_log_user_id IS 'Speeds up user activity reports';
COMMENT ON INDEX idx_agent_audit_log_course_id IS 'Enables course-specific audit queries';
COMMENT ON INDEX idx_agent_audit_log_user_course_date IS 'Optimized for audit log retrieval';
COMMENT ON INDEX idx_agent_audit_log_errors IS 'Partial index for error tracking queries';

-- =====================================================
-- MESSAGE TRUST SCORES INDEXES
-- =====================================================

-- Index for looking up trust score by message
CREATE INDEX IF NOT EXISTS idx_message_trust_scores_message_id
  ON message_trust_scores(message_id);

-- Index for filtering by trust level
CREATE INDEX IF NOT EXISTS idx_message_trust_scores_trust_level
  ON message_trust_scores(trust_level);

-- Index for finding low-trust messages
CREATE INDEX IF NOT EXISTS idx_message_trust_scores_low_trust
  ON message_trust_scores(verification_timestamp DESC)
  WHERE trust_level IN ('lower', 'low');

COMMENT ON INDEX idx_message_trust_scores_message_id IS 'Primary lookup for message trust scores';
COMMENT ON INDEX idx_message_trust_scores_trust_level IS 'Allows filtering by trust level';
COMMENT ON INDEX idx_message_trust_scores_low_trust IS 'Partial index for flagged messages';

-- =====================================================
-- COURSE MATERIALS INDEXES
-- =====================================================

-- Index for course materials by course
CREATE INDEX IF NOT EXISTS idx_course_materials_course_id
  ON course_materials(course_id);

-- Index for finding materials by type
CREATE INDEX IF NOT EXISTS idx_course_materials_file_type
  ON course_materials(file_type);

-- Composite index for course material listing
CREATE INDEX IF NOT EXISTS idx_course_materials_course_upload
  ON course_materials(course_id, uploaded_at DESC);

COMMENT ON INDEX idx_course_materials_course_id IS 'Speeds up course material queries';
COMMENT ON INDEX idx_course_materials_file_type IS 'Allows filtering by file type';
COMMENT ON INDEX idx_course_materials_course_upload IS 'Optimized for material listing';

-- =====================================================
-- ASSIGNMENTS & SUBMISSIONS INDEXES
-- =====================================================

-- Index for assignment submissions by student
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student_id
  ON assignment_submissions(student_id);

-- Index for assignment submissions by assignment
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_assignment_id
  ON assignment_submissions(assignment_id);

-- Composite index for student submission listing
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_student_submitted
  ON assignment_submissions(student_id, submitted_at DESC);

-- Index for graded submissions
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_graded
  ON assignment_submissions(assignment_id, graded_at DESC)
  WHERE grade IS NOT NULL;

-- Index for pending grading
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_pending
  ON assignment_submissions(assignment_id, submitted_at DESC)
  WHERE grade IS NULL;

COMMENT ON INDEX idx_assignment_submissions_student_id IS 'Speeds up student submission queries';
COMMENT ON INDEX idx_assignment_submissions_assignment_id IS 'Allows efficient assignment submission retrieval';
COMMENT ON INDEX idx_assignment_submissions_student_submitted IS 'Optimized for submission history';
COMMENT ON INDEX idx_assignment_submissions_graded IS 'Partial index for graded submissions';
COMMENT ON INDEX idx_assignment_submissions_pending IS 'Partial index for pending grading queue';

-- =====================================================
-- TENTATIVE GRADES INDEXES
-- =====================================================

-- Index for tentative grades by submission
CREATE INDEX IF NOT EXISTS idx_tentative_grades_submission_id
  ON tentative_grades(submission_id);

-- Index for tentative grades by student
CREATE INDEX IF NOT EXISTS idx_tentative_grades_student_id
  ON tentative_grades(student_id);

-- Index for finding finalized grades
CREATE INDEX IF NOT EXISTS idx_tentative_grades_finalized
  ON tentative_grades(finalized_at DESC)
  WHERE is_final = true;

-- Index for pending finalization
CREATE INDEX IF NOT EXISTS idx_tentative_grades_pending
  ON tentative_grades(generated_at DESC)
  WHERE is_final = false;

COMMENT ON INDEX idx_tentative_grades_submission_id IS 'Primary lookup for submission grades';
COMMENT ON INDEX idx_tentative_grades_student_id IS 'Allows student grade queries';
COMMENT ON INDEX idx_tentative_grades_finalized IS 'Partial index for finalized grades';
COMMENT ON INDEX idx_tentative_grades_pending IS 'Partial index for pending review';

-- =====================================================
-- USERS INDEXES
-- =====================================================

-- Index for user lookups by email (already exists as UNIQUE, but explicit for clarity)
-- Index for finding users by role
CREATE INDEX IF NOT EXISTS idx_users_role
  ON users(role);

-- Index for finding users by status
CREATE INDEX IF NOT EXISTS idx_users_status
  ON users(status);

-- Composite index for professor approval queue
CREATE INDEX IF NOT EXISTS idx_users_professor_pending
  ON users(created_at DESC)
  WHERE role = 'professor' AND status = 'pending';

COMMENT ON INDEX idx_users_role IS 'Allows filtering by user role';
COMMENT ON INDEX idx_users_status IS 'Enables status-based queries';
COMMENT ON INDEX idx_users_professor_pending IS 'Optimized for admin approval queue';

-- =====================================================
-- COURSES INDEXES
-- =====================================================

-- Index for instructor courses
CREATE INDEX IF NOT EXISTS idx_courses_instructor_id
  ON courses(instructor_id);

-- Index for active courses
CREATE INDEX IF NOT EXISTS idx_courses_active
  ON courses(created_at DESC)
  WHERE status = 'active';

COMMENT ON INDEX idx_courses_instructor_id IS 'Speeds up instructor course queries';
COMMENT ON INDEX idx_courses_active IS 'Partial index for active courses only';

-- =====================================================
-- VERIFY INDEXES WERE CREATED
-- =====================================================

-- Display all indexes created by this migration
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- Display index sizes to monitor performance
SELECT
  t.tablename,
  i.indexname,
  pg_size_pretty(pg_relation_size(quote_ident(t.tablename)::regclass)) AS table_size,
  pg_size_pretty(pg_relation_size(quote_ident(i.indexname)::regclass)) AS index_size,
  i.idx_scan AS index_scans,
  i.idx_tup_read AS tuples_read,
  i.idx_tup_fetch AS tuples_fetched
FROM pg_tables t
LEFT OUTER JOIN pg_indexes idx ON t.tablename = idx.tablename AND t.schemaname = idx.schemaname
LEFT OUTER JOIN pg_stat_user_indexes i ON i.indexrelname = idx.indexname
WHERE t.schemaname = 'public'
  AND idx.indexname LIKE 'idx_%'
ORDER BY pg_relation_size(quote_ident(i.indexname)::regclass) DESC;

COMMIT;

-- =====================================================
-- ROLLBACK SCRIPT (if needed)
-- =====================================================
-- To remove all indexes created by this migration:
/*
BEGIN;

DROP INDEX IF EXISTS idx_course_material_embeddings_material_id;
DROP INDEX IF EXISTS idx_course_material_embeddings_course_lookup;
DROP INDEX IF EXISTS idx_response_sources_message_id;
DROP INDEX IF EXISTS idx_response_sources_type;
DROP INDEX IF EXISTS idx_chat_messages_session_id;
DROP INDEX IF EXISTS idx_chat_messages_user_id;
DROP INDEX IF EXISTS idx_chat_messages_session_timestamp;
DROP INDEX IF EXISTS idx_chat_sessions_user_id;
DROP INDEX IF EXISTS idx_chat_sessions_course_id;
DROP INDEX IF EXISTS idx_chat_sessions_user_course;
DROP INDEX IF EXISTS idx_agent_audit_log_agent_type;
DROP INDEX IF EXISTS idx_agent_audit_log_user_id;
DROP INDEX IF EXISTS idx_agent_audit_log_course_id;
DROP INDEX IF EXISTS idx_agent_audit_log_user_course_date;
DROP INDEX IF EXISTS idx_agent_audit_log_errors;
DROP INDEX IF EXISTS idx_message_trust_scores_message_id;
DROP INDEX IF EXISTS idx_message_trust_scores_trust_level;
DROP INDEX IF EXISTS idx_message_trust_scores_low_trust;
DROP INDEX IF EXISTS idx_course_materials_course_id;
DROP INDEX IF EXISTS idx_course_materials_file_type;
DROP INDEX IF EXISTS idx_course_materials_course_upload;
DROP INDEX IF EXISTS idx_assignment_submissions_student_id;
DROP INDEX IF EXISTS idx_assignment_submissions_assignment_id;
DROP INDEX IF EXISTS idx_assignment_submissions_student_submitted;
DROP INDEX IF EXISTS idx_assignment_submissions_graded;
DROP INDEX IF EXISTS idx_assignment_submissions_pending;
DROP INDEX IF EXISTS idx_tentative_grades_submission_id;
DROP INDEX IF EXISTS idx_tentative_grades_student_id;
DROP INDEX IF EXISTS idx_tentative_grades_finalized;
DROP INDEX IF EXISTS idx_tentative_grades_pending;
DROP INDEX IF EXISTS idx_users_role;
DROP INDEX IF EXISTS idx_users_status;
DROP INDEX IF EXISTS idx_users_professor_pending;
DROP INDEX IF EXISTS idx_courses_instructor_id;
DROP INDEX IF EXISTS idx_courses_active;

COMMIT;
*/
