-- Migration: Add AI-extracted grading criteria to assignments
-- This allows us to analyze assignment requirements once and reuse them for all submissions
-- Created: 2026-01-16

-- Add ai_grading_criteria JSONB field to assignments table
-- This will store AI-extracted requirements, evaluation criteria, and key points
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assignments' AND column_name = 'ai_grading_criteria'
  ) THEN
    ALTER TABLE assignments ADD COLUMN ai_grading_criteria JSONB;

    -- Add a comment explaining the field structure
    COMMENT ON COLUMN assignments.ai_grading_criteria IS
      'AI-extracted grading criteria containing: requirements (array), key_topics (array), evaluation_points (array), complexity_level (string), estimated_effort (string)';
  END IF;
END $$;

-- Add index for faster queries on assignments with AI criteria
CREATE INDEX IF NOT EXISTS idx_assignments_has_ai_criteria
ON assignments ((ai_grading_criteria IS NOT NULL));

-- Add updated_at trigger if it doesn't exist
CREATE OR REPLACE FUNCTION update_assignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_assignments_updated_at ON assignments;
CREATE TRIGGER trigger_assignments_updated_at
  BEFORE UPDATE ON assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_assignments_updated_at();
