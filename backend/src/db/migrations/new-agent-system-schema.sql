-- Migration for New Agent System
-- Includes: Grading Assistant, Subject-Specific Chatbot with Source Attribution, and Integrity Verification Agent

-- =====================================================
-- 1. Tentative Grades Table (Grading Assistant Agent)
-- =====================================================
CREATE TABLE IF NOT EXISTS tentative_grades (
  id SERIAL PRIMARY KEY,
  submission_id INTEGER NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tentative_grade INTEGER NOT NULL,
  max_points INTEGER NOT NULL,
  grading_rationale TEXT NOT NULL,
  rubric_breakdown JSONB DEFAULT '{}', -- Breakdown by rubric criteria
  strengths TEXT[], -- Array of identified strengths
  areas_for_improvement TEXT[], -- Array of areas needing improvement
  confidence_score DECIMAL(3,2) DEFAULT 0.70, -- AI confidence in the grade (0-1)
  is_final BOOLEAN DEFAULT false, -- Whether professor has finalized this grade
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  finalized_at TIMESTAMP,
  finalized_by INTEGER REFERENCES users(id),
  UNIQUE(submission_id) -- One tentative grade per submission
);

CREATE INDEX IF NOT EXISTS idx_tentative_grades_submission_id ON tentative_grades(submission_id);
CREATE INDEX IF NOT EXISTS idx_tentative_grades_assignment_id ON tentative_grades(assignment_id);
CREATE INDEX IF NOT EXISTS idx_tentative_grades_student_id ON tentative_grades(student_id);

-- =====================================================
-- 2. Source Attributions Table (For Chatbot Responses)
-- =====================================================
CREATE TABLE IF NOT EXISTS response_sources (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL, -- 'course_material', 'internet', 'professor_note'
  source_id INTEGER, -- Reference to course_materials.id if applicable
  source_name VARCHAR(500) NOT NULL,
  source_url TEXT, -- URL for internet sources
  source_excerpt TEXT, -- Relevant excerpt from the source
  page_number VARCHAR(50), -- Page or section number
  relevance_score DECIMAL(3,2) DEFAULT 0.80, -- How relevant this source is (0-1)
  cited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT source_type_check CHECK (source_type IN ('course_material', 'internet', 'professor_note', 'textbook', 'other'))
);

CREATE INDEX IF NOT EXISTS idx_response_sources_message_id ON response_sources(message_id);
CREATE INDEX IF NOT EXISTS idx_response_sources_source_id ON response_sources(source_id);
CREATE INDEX IF NOT EXISTS idx_response_sources_source_type ON response_sources(source_type);

-- =====================================================
-- 3. Trust Scores Table (Integrity Verification Agent)
-- =====================================================
CREATE TABLE IF NOT EXISTS message_trust_scores (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  trust_score INTEGER NOT NULL, -- 0-100 scale
  trust_level VARCHAR(50) NOT NULL, -- 'highest', 'high', 'medium', 'lower', 'low'
  verification_reasoning TEXT NOT NULL, -- Explanation of the score
  source_verification_details JSONB DEFAULT '{}', -- Details about source verification
  conflicts_detected TEXT[], -- Any conflicts with course materials
  verification_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  verified_by VARCHAR(100) DEFAULT 'integrity_verification_agent',
  CONSTRAINT trust_level_check CHECK (trust_level IN ('highest', 'high', 'medium', 'lower', 'low')),
  CONSTRAINT trust_score_range CHECK (trust_score >= 0 AND trust_score <= 100),
  UNIQUE(message_id) -- One trust score per message
);

CREATE INDEX IF NOT EXISTS idx_trust_scores_message_id ON message_trust_scores(message_id);
CREATE INDEX IF NOT EXISTS idx_trust_scores_trust_level ON message_trust_scores(trust_level);
CREATE INDEX IF NOT EXISTS idx_trust_scores_trust_score ON message_trust_scores(trust_score);

-- =====================================================
-- 4. Grading Rubrics Table (For Grading Assistant)
-- =====================================================
CREATE TABLE IF NOT EXISTS grading_rubrics (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  rubric_name VARCHAR(255) NOT NULL,
  criteria JSONB NOT NULL, -- Array of criteria with weights
  total_points INTEGER NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(assignment_id) -- One rubric per assignment
);

CREATE INDEX IF NOT EXISTS idx_grading_rubrics_assignment_id ON grading_rubrics(assignment_id);
CREATE INDEX IF NOT EXISTS idx_grading_rubrics_course_id ON grading_rubrics(course_id);

-- =====================================================
-- 5. Course Materials Content Table (For RAG/Search)
-- =====================================================
-- Enhanced course materials with extracted text content for AI search
CREATE TABLE IF NOT EXISTS course_material_content (
  id SERIAL PRIMARY KEY,
  material_id INTEGER NOT NULL REFERENCES course_materials(id) ON DELETE CASCADE,
  content_text TEXT NOT NULL, -- Extracted text content
  content_chunks JSONB DEFAULT '[]', -- Chunked content for RAG
  metadata JSONB DEFAULT '{}', -- Additional metadata (page numbers, sections, etc.)
  last_indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(material_id)
);

CREATE INDEX IF NOT EXISTS idx_material_content_material_id ON course_material_content(material_id);

-- =====================================================
-- 6. Agent Audit Log (Track Agent Actions)
-- =====================================================
CREATE TABLE IF NOT EXISTS agent_audit_log (
  id SERIAL PRIMARY KEY,
  agent_type VARCHAR(100) NOT NULL, -- 'grading_assistant', 'chatbot', 'integrity_verification'
  action_type VARCHAR(100) NOT NULL, -- 'generate_grade', 'answer_question', 'verify_response'
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  session_id INTEGER REFERENCES chat_sessions(id) ON DELETE SET NULL,
  assignment_id INTEGER REFERENCES assignments(id) ON DELETE SET NULL,
  input_data JSONB DEFAULT '{}',
  output_data JSONB DEFAULT '{}',
  confidence_score DECIMAL(3,2),
  execution_time_ms INTEGER, -- How long the agent took to respond
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_log_agent_type ON agent_audit_log(agent_type);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON agent_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_course_id ON agent_audit_log(course_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON agent_audit_log(created_at);

-- =====================================================
-- 7. Update chat_agents table to support new agent types
-- =====================================================
-- Add new agent types if the constraint exists
DO $$
BEGIN
  -- Drop the old constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chat_agents_type_check'
    AND table_name = 'chat_agents'
  ) THEN
    ALTER TABLE chat_agents DROP CONSTRAINT chat_agents_type_check;
  END IF;

  -- Add updated constraint
  ALTER TABLE chat_agents ADD CONSTRAINT chat_agents_type_check
    CHECK (agent_type IN (
      'course_assistant',
      'instructor_assistant',
      'admin_assistant',
      'grading_assistant',
      'subject_chatbot',
      'integrity_verifier'
    ));
END $$;

-- =====================================================
-- 8. Update chat_messages to support enhanced metadata
-- =====================================================
-- The message_metadata JSONB field will now include:
-- - sources: Array of source attributions
-- - trustScore: Trust score object
-- - tentativeGrade: Grading information (for grading assistant)
-- No schema change needed, just documentation

COMMENT ON COLUMN chat_messages.message_metadata IS 'Enhanced metadata including sources, trust scores, and agent-specific data';
COMMENT ON TABLE tentative_grades IS 'Stores AI-generated tentative grades for student submissions (Grading Assistant Agent)';
COMMENT ON TABLE response_sources IS 'Source attributions for chatbot responses (Subject-Specific Chatbot)';
COMMENT ON TABLE message_trust_scores IS 'Trust scores and verification details for chat responses (Integrity Verification Agent)';
COMMENT ON TABLE grading_rubrics IS 'Professor-defined grading rubrics for assignments';
COMMENT ON TABLE course_material_content IS 'Extracted and indexed content from course materials for AI search';
COMMENT ON TABLE agent_audit_log IS 'Audit trail of all agent actions and decisions';
