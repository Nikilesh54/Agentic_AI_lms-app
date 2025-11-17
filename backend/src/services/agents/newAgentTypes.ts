import { AIContext } from '../ai/types';

/**
 * Types for the new agent system (Grading Assistant, Subject Chatbot, Integrity Verifier)
 * These agents have a simplified interface compared to the existing HITL system
 */

export interface AgentMessage {
  content: string;
  userId: number;
  role: string;
  sessionId?: number;
  messageId?: number;
  timestamp: Date;
}

export interface AgentResponse {
  content: string;
  confidence: number;
  requiresReview: boolean;
  sources?: ResponseSource[];
  metadata?: Record<string, any>;
}

export interface ResponseSource {
  source_type: 'course_material' | 'internet' | 'professor_note' | 'textbook' | 'other';
  source_id: number | null;
  source_name: string;
  source_url: string | null;
  source_excerpt: string | null;
  page_number: string | null;
  relevance_score: number;
}

// For use in imports
export { ResponseSource as ChatbotResponseSource };

export interface AgentMetadata {
  name: string;
  type: string;
  description: string;
  capabilities: string[];
  tools: string[];
  systemPrompt?: string;
}

// Simple base interface for new agents
export abstract class SimpleBaseAgent {
  protected abstract metadata: AgentMetadata;

  abstract execute(message: AgentMessage, context: AIContext): Promise<AgentResponse>;
}
