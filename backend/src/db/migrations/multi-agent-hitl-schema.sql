-- ============================================
-- MULTI-AGENT HITL (Human-in-the-Loop) SCHEMA
-- ============================================

-- Add new columns to existing chat_messages table
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS agent_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS requires_review BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id),
ADD COLUMN IF NOT EXISTS review_status VARCHAR(20),
ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(3,2),
ADD COLUMN IF NOT EXISTS tool_calls JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT '[]';

-- Add check constraint for review_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chat_messages_review_status_check'
  ) THEN
    ALTER TABLE chat_messages
    ADD CONSTRAINT chat_messages_review_status_check
    CHECK (review_status IN ('pending', 'approved', 'rejected', 'modified', NULL));
  END IF;
END $$;

-- ============================================
-- AGENT COLLABORATIONS TABLE
-- Tracks agent handoffs and multi-agent conversations
-- ============================================
CREATE TABLE IF NOT EXISTS agent_collaborations (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  from_agent_id INTEGER REFERENCES chat_agents(id) ON DELETE SET NULL,
  to_agent_id INTEGER NOT NULL REFERENCES chat_agents(id) ON DELETE CASCADE,
  handoff_reason TEXT,
  context_data JSONB DEFAULT '{}',
  success BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_collaborations_session_id
ON agent_collaborations(session_id);

CREATE INDEX IF NOT EXISTS idx_agent_collaborations_from_agent
ON agent_collaborations(from_agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_collaborations_to_agent
ON agent_collaborations(to_agent_id);

-- ============================================
-- MESSAGE APPROVALS TABLE
-- Tracks approval workflow for AI-generated messages
-- ============================================
CREATE TABLE IF NOT EXISTS message_approvals (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  draft_content TEXT NOT NULL,
  final_content TEXT,
  reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  review_status VARCHAR(20) DEFAULT 'pending',
  review_notes TEXT,
  reviewed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT message_approvals_review_status_check
    CHECK (review_status IN ('pending', 'approved', 'rejected', 'modified'))
);

CREATE INDEX IF NOT EXISTS idx_message_approvals_message_id
ON message_approvals(message_id);

CREATE INDEX IF NOT EXISTS idx_message_approvals_reviewer_id
ON message_approvals(reviewer_id);

CREATE INDEX IF NOT EXISTS idx_message_approvals_status
ON message_approvals(review_status);

-- ============================================
-- INTERVENTION QUEUE TABLE
-- Manages human interventions in AI conversations
-- ============================================
CREATE TABLE IF NOT EXISTS intervention_queue (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL,
  trigger_type VARCHAR(100) NOT NULL,
  trigger_reason TEXT,
  priority VARCHAR(20) DEFAULT 'medium',
  assigned_to INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending',
  resolution_notes TEXT,
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT intervention_queue_priority_check
    CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT intervention_queue_status_check
    CHECK (status IN ('pending', 'in_progress', 'resolved', 'dismissed'))
);

CREATE INDEX IF NOT EXISTS idx_intervention_queue_session_id
ON intervention_queue(session_id);

CREATE INDEX IF NOT EXISTS idx_intervention_queue_status
ON intervention_queue(status);

CREATE INDEX IF NOT EXISTS idx_intervention_queue_priority
ON intervention_queue(priority);

CREATE INDEX IF NOT EXISTS idx_intervention_queue_assigned_to
ON intervention_queue(assigned_to);

CREATE INDEX IF NOT EXISTS idx_intervention_queue_created_at
ON intervention_queue(created_at);

-- ============================================
-- AGENT LEARNINGS TABLE
-- Stores learnings from human interventions
-- ============================================
CREATE TABLE IF NOT EXISTS agent_learnings (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER NOT NULL REFERENCES chat_agents(id) ON DELETE CASCADE,
  intervention_id INTEGER REFERENCES intervention_queue(id) ON DELETE SET NULL,
  original_response TEXT,
  corrected_response TEXT,
  learning_summary TEXT,
  learning_category VARCHAR(100),
  applied_to_prompts BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  applied_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_agent_learnings_agent_id
ON agent_learnings(agent_id);

CREATE INDEX IF NOT EXISTS idx_agent_learnings_intervention_id
ON agent_learnings(intervention_id);

CREATE INDEX IF NOT EXISTS idx_agent_learnings_category
ON agent_learnings(learning_category);

-- ============================================
-- TOOL EXECUTIONS TABLE
-- Tracks tool/action executions by agents
-- ============================================
CREATE TABLE IF NOT EXISTS tool_executions (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  message_id INTEGER REFERENCES chat_messages(id) ON DELETE SET NULL,
  tool_name VARCHAR(100) NOT NULL,
  tool_input JSONB NOT NULL,
  tool_output JSONB,
  execution_status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  execution_time_ms INTEGER,
  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT tool_executions_status_check
    CHECK (execution_status IN ('pending', 'running', 'success', 'error'))
);

CREATE INDEX IF NOT EXISTS idx_tool_executions_session_id
ON tool_executions(session_id);

CREATE INDEX IF NOT EXISTS idx_tool_executions_message_id
ON tool_executions(message_id);

CREATE INDEX IF NOT EXISTS idx_tool_executions_tool_name
ON tool_executions(tool_name);

CREATE INDEX IF NOT EXISTS idx_tool_executions_status
ON tool_executions(execution_status);

-- ============================================
-- AI MONITORING METRICS TABLE
-- Tracks performance and usage metrics
-- ============================================
CREATE TABLE IF NOT EXISTS ai_monitoring_metrics (
  id SERIAL PRIMARY KEY,
  agent_id INTEGER REFERENCES chat_agents(id) ON DELETE SET NULL,
  session_id INTEGER REFERENCES chat_sessions(id) ON DELETE SET NULL,
  metric_type VARCHAR(100) NOT NULL,
  metric_value DECIMAL(10,2),
  metric_data JSONB DEFAULT '{}',
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_monitoring_metrics_agent_id
ON ai_monitoring_metrics(agent_id);

CREATE INDEX IF NOT EXISTS idx_ai_monitoring_metrics_metric_type
ON ai_monitoring_metrics(metric_type);

CREATE INDEX IF NOT EXISTS idx_ai_monitoring_metrics_recorded_at
ON ai_monitoring_metrics(recorded_at);

-- ============================================
-- CONTEXT MATERIALS TABLE
-- Stores material chunks for context retrieval
-- ============================================
CREATE TABLE IF NOT EXISTS context_materials (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  material_id INTEGER REFERENCES course_materials(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_context_materials_course_id
ON context_materials(course_id);

CREATE INDEX IF NOT EXISTS idx_context_materials_material_id
ON context_materials(material_id);

-- Full-text search index for context materials
CREATE INDEX IF NOT EXISTS idx_context_materials_content_fts
ON context_materials USING gin(to_tsvector('english', content));

-- ============================================
-- AGENT CONVERSATION CONTEXT TABLE
-- Maintains conversation context and memory
-- ============================================
CREATE TABLE IF NOT EXISTS agent_conversation_context (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  context_key VARCHAR(255) NOT NULL,
  context_value JSONB NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, context_key)
);

CREATE INDEX IF NOT EXISTS idx_agent_conversation_context_session_id
ON agent_conversation_context(session_id);

CREATE INDEX IF NOT EXISTS idx_agent_conversation_context_key
ON agent_conversation_context(context_key);

-- ============================================
-- Add useful views for monitoring
-- ============================================

-- View: Active interventions summary
CREATE OR REPLACE VIEW active_interventions_summary AS
SELECT
  iq.id,
  iq.trigger_type,
  iq.priority,
  iq.status,
  cs.session_name,
  c.title as course_name,
  u.full_name as student_name,
  reviewer.full_name as assigned_to_name,
  iq.created_at,
  EXTRACT(EPOCH FROM (NOW() - iq.created_at))/3600 as hours_pending
FROM intervention_queue iq
JOIN chat_sessions cs ON iq.session_id = cs.id
JOIN courses c ON cs.course_id = c.id
JOIN users u ON cs.student_id = u.id
LEFT JOIN users reviewer ON iq.assigned_to = reviewer.id
WHERE iq.status IN ('pending', 'in_progress')
ORDER BY
  CASE iq.priority
    WHEN 'critical' THEN 1
    WHEN 'high' THEN 2
    WHEN 'medium' THEN 3
    WHEN 'low' THEN 4
  END,
  iq.created_at ASC;

-- View: Agent performance metrics
CREATE OR REPLACE VIEW agent_performance_summary AS
SELECT
  ca.id as agent_id,
  ca.name as agent_name,
  ca.agent_type,
  COUNT(DISTINCT cs.id) as total_sessions,
  COUNT(cm.id) as total_messages,
  AVG(cm.confidence_score) as avg_confidence,
  SUM(CASE WHEN cm.requires_review THEN 1 ELSE 0 END) as messages_requiring_review,
  SUM(CASE WHEN cm.review_status = 'approved' THEN 1 ELSE 0 END) as messages_approved,
  SUM(CASE WHEN cm.review_status = 'rejected' THEN 1 ELSE 0 END) as messages_rejected
FROM chat_agents ca
LEFT JOIN chat_sessions cs ON ca.id = cs.agent_id
LEFT JOIN chat_messages cm ON cs.id = cm.session_id AND cm.sender_type = 'agent'
WHERE ca.is_active = true
GROUP BY ca.id, ca.name, ca.agent_type;

-- View: Daily AI usage statistics
CREATE OR REPLACE VIEW daily_ai_usage_stats AS
SELECT
  DATE(cm.created_at) as date,
  COUNT(DISTINCT cs.session_id) as active_sessions,
  COUNT(cm.id) as total_messages,
  COUNT(DISTINCT cs.student_id) as unique_users,
  AVG(cm.confidence_score) as avg_confidence,
  COUNT(DISTINCT CASE WHEN iq.id IS NOT NULL THEN cs.id END) as sessions_with_interventions
FROM chat_messages cm
JOIN chat_sessions cs ON cm.session_id = cs.id
LEFT JOIN intervention_queue iq ON cs.id = iq.session_id
WHERE cm.sender_type = 'agent'
GROUP BY DATE(cm.created_at)
ORDER BY DATE(cm.created_at) DESC;

COMMENT ON TABLE agent_collaborations IS 'Tracks agent handoffs and multi-agent collaboration';
COMMENT ON TABLE message_approvals IS 'Manages approval workflow for AI-generated messages';
COMMENT ON TABLE intervention_queue IS 'Queue of conversations requiring human intervention';
COMMENT ON TABLE agent_learnings IS 'Stores patterns learned from human corrections';
COMMENT ON TABLE tool_executions IS 'Logs all tool/action executions by agents';
COMMENT ON TABLE ai_monitoring_metrics IS 'Performance and usage metrics for monitoring';
COMMENT ON TABLE context_materials IS 'Chunked course materials for context retrieval';
COMMENT ON TABLE agent_conversation_context IS 'Maintains conversation state and memory';
