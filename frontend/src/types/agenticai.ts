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

export function getTrustScoreColor(score: number): string {
  if (score >= 90) return '#10b981'; // Green
  if (score >= 70) return '#34d399'; // Light green
  if (score >= 50) return '#fbbf24'; // Yellow
  if (score >= 30) return '#f97316'; // Orange
  return '#ef4444'; // Red
}
