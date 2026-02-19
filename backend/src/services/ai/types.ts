/**
 * Core types for AI service layer
 * These types are provider-agnostic and support multiple AI backends
 */

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  metadata?: Record<string, any>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  toolCallId: string;
  result: any;
  error?: string;
}

export interface AIResponse {
  content: string;
  confidence: number; // 0-1 confidence score
  requiresReview: boolean;
  uncertainAspects?: string[]; // What AI is unsure about
  sources?: Array<{ id: number; name: string; relevance: number }>;
  toolCalls?: ToolCall[];
  metadata?: Record<string, any>;
  verificationResult?: VerificationResult;
}

export interface VerificationResult {
  wasVerified: boolean;
  originalConfidence: number;
  finalConfidence: number;
  improvementPercentage: number;
  verificationSteps: VerificationStep[];
  totalApiCalls: number;
  verificationTimeMs: number;
}

export interface VerificationStep {
  step: 'generate_questions' | 'answer_questions' | 'revise_response';
  questions?: string[];
  answers?: string[];
  revisedContent?: string;
  confidence?: number;
  status: 'success' | 'failure';
  errorMessage?: string;
}

export interface StreamChunk {
  content: string;
  isComplete: boolean;
  toolCalls?: ToolCall[];
}

export interface AIContext {
  conversationHistory: AIMessage[];
  relevantMaterials?: any[];
  activeAssignments?: any[];
  studentContext?: any;
  courseMetadata?: any;
  instructorPreferences?: any;
  toolResults?: ToolResult[];
  webSearchResults?: any[];
}

export interface Intent {
  type: string;
  topic?: string;
  count?: number;
  confidence: number;
  entities?: Record<string, any>;
}

export interface AIServiceConfig {
  provider: 'mock' | 'openai' | 'anthropic' | 'gemini' | 'groq' | 'custom';
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  streamingEnabled?: boolean;
}

/**
 * Main AI Service Interface
 * All AI providers must implement this interface
 */
export interface IAIService {
  /**
   * Generate a response from the AI
   */
  generateResponse(
    messages: AIMessage[],
    context: AIContext,
    systemPrompt?: string,
    options?: { jsonMode?: boolean }
  ): Promise<AIResponse>;

  /**
   * Generate streaming response
   */
  streamResponse(
    messages: AIMessage[],
    context: AIContext,
    systemPrompt?: string
  ): AsyncGenerator<StreamChunk>;

  /**
   * Analyze user intent
   */
  analyzeIntent(message: string): Promise<Intent>;

  /**
   * Calculate confidence score for a response
   */
  calculateConfidence(response: string, context: AIContext): Promise<number>;

  /**
   * Check if response requires human review
   */
  shouldRequireReview(response: AIResponse, context: AIContext): Promise<boolean>;
}

/**
 * Available tool definitions that AI can use
 */
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
}
