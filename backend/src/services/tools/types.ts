/**
 * Tool/Action Framework Types
 * Defines the interface for tools that agents can use
 */

export interface ToolInput {
  [key: string]: any;
}

export interface ToolOutput {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ToolExecutionContext {
  userId: number;
  userRole: string;
  courseId?: number;
  sessionId?: number;
}

export interface ToolExecutionResult {
  toolName: string;
  input: ToolInput;
  output: ToolOutput;
  executionTimeMs: number;
  executedAt: Date;
}

/**
 * Base interface that all tools must implement
 */
export interface ITool {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };

  /**
   * Execute the tool with given input
   */
  execute(input: ToolInput, context: ToolExecutionContext): Promise<ToolOutput>;

  /**
   * Validate tool input
   */
  validate(input: ToolInput): { valid: boolean; errors?: string[] };
}

/**
 * Tool categories for organization
 */
export enum ToolCategory {
  COURSE_MATERIALS = 'course_materials',
  ASSIGNMENTS = 'assignments',
  STUDENT_PROGRESS = 'student_progress',
  CONTENT_GENERATION = 'content_generation',
  ANALYTICS = 'analytics',
  COMMUNICATION = 'communication',
}

/**
 * Tool metadata for registry
 */
export interface ToolMetadata {
  name: string;
  description: string;
  category: ToolCategory;
  requiresAuth: boolean;
  allowedRoles: string[];
  rateLimit?: {
    maxCalls: number;
    windowMs: number;
  };
}
