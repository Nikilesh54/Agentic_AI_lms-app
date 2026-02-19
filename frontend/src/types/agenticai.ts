/**
 * TypeScript interfaces for AgenticAI features
 * (Grading Assistant, Subject Chatbot, Integrity Verification)
 */

// =====================================================
// Trust Scores & Source Attribution
// =====================================================

export type TrustLevel = 'highest' | 'high' | 'medium' | 'lower' | 'low';

export type SourceType = 'course_material' | 'internet' | 'professor_note' | 'textbook' | 'other';

export interface ResponseSource {
  id: number;
  message_id: number;
  source_type: SourceType;
  source_id: number | null;
  source_name: string;
  source_url: string | null;
  source_excerpt: string | null;
  page_number: string | null;
  relevance_score: number;
  cited_at: string;
}

export interface TrustScore {
  id: number;
  message_id: number;
  trust_score: number; // 0-100
  trust_level: TrustLevel;
  verification_reasoning: string;
  source_verification_details: {
    verification_details?: Array<{
      source: string;
      claimed_content: string;
      actual_content: string;
      match_quality: 'exact' | 'paraphrase' | 'partial' | 'mismatch' | 'missing';
      evidence: string;
    }>;
    evidence_summary?: string;
  };
  conflicts_detected: string[];
  verification_timestamp: string;
  verified_by: string;
}

// =====================================================
// Tentative Grades & Grading
// =====================================================

export interface RubricCriterion {
  name: string;
  description: string;
  points: number;
  excellent_description?: string;
  good_description?: string;
  fair_description?: string;
  poor_description?: string;
}

export interface GradingRubric {
  id: number;
  assignment_id: number;
  course_id: number;
  rubric_name: string;
  criteria: RubricCriterion[];
  total_points: number;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface RubricBreakdownItem {
  criterion: string;
  points_awarded: number;
  points_possible: number;
  justification: string;
}

export interface TentativeGrade {
  id: number;
  submission_id: number;
  assignment_id: number;
  student_id: number;
  tentative_grade: number;
  max_points: number;
  grading_rationale: string;
  rubric_breakdown: RubricBreakdownItem[];
  strengths: string[];
  areas_for_improvement: string[];
  confidence_score: number; // 0-1
  is_final: boolean;
  generated_at: string;
  finalized_at: string | null;
  finalized_by: number | null;
}

// =====================================================
// Agent Metadata
// =====================================================

export interface AgentMetadata {
  name: string;
  type: string;
  description: string;
  capabilities: string[];
}

// =====================================================
// Helper functions
// =====================================================

export function getTrustLevelColor(level: TrustLevel): string {
  switch (level) {
    case 'highest':
      return '#10b981'; // Green
    case 'high':
      return '#34d399'; // Light green
    case 'medium':
      return '#fbbf24'; // Yellow
    case 'lower':
      return '#f97316'; // Orange
    case 'low':
      return '#ef4444'; // Red
    default:
      return '#6b7280'; // Gray
  }
}

export function getTrustLevelLabel(level: TrustLevel): string {
  switch (level) {
    case 'highest':
      return 'Highest Trust';
    case 'high':
      return 'High Trust';
    case 'medium':
      return 'Medium Trust';
    case 'lower':
      return 'Lower Trust';
    case 'low':
      return 'Low Trust';
    default:
      return 'Unknown';
  }
}

// =====================================================
// Fact-Check Results (Groq Independent Verification)
// =====================================================

export type AccuracyLevel = 'highly_accurate' | 'mostly_accurate' | 'partially_accurate' | 'inaccurate';

export interface ClaimVerification {
  claim: string;
  verdict: 'accurate' | 'inaccurate' | 'partially_accurate' | 'unverifiable';
  explanation: string;
  confidence: number;
}

export interface FactCheckResult {
  id: number;
  message_id: number;
  overall_accuracy_score: number;
  accuracy_level: AccuracyLevel;
  summary: string;
  claims_checked: ClaimVerification[];
  total_claims: number;
  verified_claims: number;
  unverifiable_claims: number;
  inaccurate_claims: number;
  status: 'pending' | 'completed' | 'error' | 'rate_limited' | 'skipped';
  processing_time_ms: number;
  groq_model: string;
  created_at: string;
  completed_at: string | null;
}

// =====================================================
// Emotional Filter Display Data
// =====================================================

export interface EmotionalFilterData {
  applied: boolean;
  detectedEmotion: string;
  emotionIntensity: 'low' | 'moderate' | 'high';
  appliedTone: string;
  processingTimeMs: number;
}

export function getTrustScoreColor(score: number): string {
  if (score >= 90) return '#10b981'; // Green
  if (score >= 70) return '#34d399'; // Light green
  if (score >= 50) return '#fbbf24'; // Yellow
  if (score >= 30) return '#f97316'; // Orange
  return '#ef4444'; // Red
}

export function getAccuracyScoreColor(score: number): string {
  if (score >= 90) return '#10b981';
  if (score >= 70) return '#34d399';
  if (score >= 50) return '#fbbf24';
  if (score >= 30) return '#f97316';
  return '#ef4444';
}

export function getAccuracyLevelLabel(level: AccuracyLevel): string {
  switch (level) {
    case 'highly_accurate': return 'Highly Accurate';
    case 'mostly_accurate': return 'Mostly Accurate';
    case 'partially_accurate': return 'Partially Accurate';
    case 'inaccurate': return 'Inaccurate';
    default: return 'Unknown';
  }
}

export function getVerdictColor(verdict: string): string {
  switch (verdict) {
    case 'accurate': return '#10b981';
    case 'partially_accurate': return '#fbbf24';
    case 'inaccurate': return '#ef4444';
    case 'unverifiable': return '#6b7280';
    default: return '#6b7280';
  }
}

export function getEmotionEmoji(emotion: string): string {
  const map: Record<string, string> = {
    neutral: '',
    frustrated: '',
    confused: '',
    anxious: '',
    discouraged: '',
    curious: '',
    engaged: '',
    confident: '',
    overwhelmed: '',
    impatient: '',
  };
  return map[emotion] || '';
}

export function getEmotionColor(emotion: string): string {
  const map: Record<string, string> = {
    neutral: '#6b7280',
    frustrated: '#ef4444',
    confused: '#f97316',
    anxious: '#eab308',
    discouraged: '#f97316',
    curious: '#3b82f6',
    engaged: '#10b981',
    confident: '#10b981',
    overwhelmed: '#ef4444',
    impatient: '#f97316',
  };
  return map[emotion] || '#6b7280';
}
