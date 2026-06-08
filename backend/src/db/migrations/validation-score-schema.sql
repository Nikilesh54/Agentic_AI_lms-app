-- Add separate validation score + verifier-disagreement flag to trust scores.
-- Forward-only: existing rows keep NULL validation_score (shown as "not computed").
ALTER TABLE message_trust_scores
  ADD COLUMN IF NOT EXISTS validation_score INTEGER,
  ADD COLUMN IF NOT EXISTS validation_min_sentence_score INTEGER,
  ADD COLUMN IF NOT EXISTS verifiers_disagree BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS low_validation_warning BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN message_trust_scores.validation_score IS 'Response->document cosine groundedness (0-100), sentence-level max-pooled';
COMMENT ON COLUMN message_trust_scores.verifiers_disagree IS 'True when the two Groq verifiers disagreed by > threshold';
COMMENT ON COLUMN message_trust_scores.low_validation_warning IS 'True when validation < guard while trust was high';
