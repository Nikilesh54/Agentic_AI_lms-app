-- Migration: Groq-based Independent Fact-Checking System
-- Stores results of Groq's independent fact-check of Gemini responses

CREATE TABLE IF NOT EXISTS fact_check_results (
  id SERIAL PRIMARY KEY,
  message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,

  -- Overall results
  overall_accuracy_score INTEGER NOT NULL DEFAULT 0,
  accuracy_level VARCHAR(50) NOT NULL DEFAULT 'pending',
  summary TEXT NOT NULL DEFAULT '',

  -- Claim-by-claim breakdown
  claims_checked JSONB DEFAULT '[]',
  total_claims INTEGER DEFAULT 0,
  verified_claims INTEGER DEFAULT 0,
  unverifiable_claims INTEGER DEFAULT 0,
  inaccurate_claims INTEGER DEFAULT 0,

  -- Processing metadata
  status VARCHAR(50) DEFAULT 'pending',
  error_message TEXT,
  processing_time_ms INTEGER,
  groq_model VARCHAR(100),

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,

  UNIQUE(message_id)
);

CREATE INDEX IF NOT EXISTS idx_fact_check_message_id ON fact_check_results(message_id);
CREATE INDEX IF NOT EXISTS idx_fact_check_status ON fact_check_results(status);
