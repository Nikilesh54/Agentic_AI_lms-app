import { AIMessage, AIContext, AIResponse } from '../ai/types';

/**
 * Agent types corresponding to different roles
 */
export enum AgentType {
  // Student-facing agents
  TUTOR = 'tutor',
  QUIZ_MASTER = 'quiz_master',
  STUDY_COACH = 'study_coach',
  ASSIGNMENT_HELPER = 'assignment_helper',

  // Professor-facing agents
  GRADING_ASSISTANT = 'grading_assistant',
  CONTENT_CREATOR = 'content_creator',
  ANALYTICS_AGENT = 'analytics_agent',

  // Admin-facing agents
  SYSTEM_MONITOR = 'system_monitor',
  POLICY_ADVISOR = 'policy_advisor',

  // Generic
  COURSE_ASSISTANT = 'course_assistant',
}

/**
 * Agent execution context
 */
export interface AgentExecutionContext {
  userId: number;
  userRole: string;
  courseId?: number;
  sessionId: number;
  conversationHistory: AIMessage[];
  aiContext: AIContext;
}

/**
 * Agent response with metadata
 */
export interface AgentResponse extends AIResponse {
  agentType: AgentType;
  shouldHandoff?: {
    toAgent: AgentType;
    reason: string;
  };
  shouldEscalate?: {
    reason: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
  };
}

/**
 * Agent capabilities
 */
export interface AgentCapabilities {
  canExplainConcepts: boolean;
  canGenerateQuizzes: boolean;
  canAccessGrades: boolean;
  canCreateContent: boolean;
  canAnalyzeProgress: boolean;
  canProvideGradingFeedback: boolean;
}

/**
 * Agent metadata
 */
export interface AgentMetadata {
  name: string;
  description: string;
  agentType: AgentType;
  systemPrompt: string;
  capabilities: AgentCapabilities;
  allowedRoles: string[];
  tools: string[]; // Names of tools this agent can use
}
