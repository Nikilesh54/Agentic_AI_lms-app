import { pool } from '../../config/database';
import { toolRegistry } from './ToolRegistry';
import {
  ToolInput,
  ToolOutput,
  ToolExecutionContext,
  ToolExecutionResult,
} from './types';

/**
 * Executes tools and manages execution lifecycle
 * Handles logging, error handling, and rate limiting
 */
export class ToolExecutor {
  /**
   * Execute a tool by name
   */
  async execute(
    toolName: string,
    input: ToolInput,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      // Get tool from registry
      const tool = toolRegistry.get(toolName);
      if (!tool) {
        throw new Error(`Tool ${toolName} not found`);
      }

      // Get metadata
      const metadata = toolRegistry.getMetadata(toolName);
      if (!metadata) {
        throw new Error(`Metadata for tool ${toolName} not found`);
      }

      // Check role authorization
      if (!metadata.allowedRoles.includes('*') &&
          !metadata.allowedRoles.includes(context.userRole)) {
        throw new Error(`User role ${context.userRole} not authorized for tool ${toolName}`);
      }

      // Validate input
      const validation = tool.validate(input);
      if (!validation.valid) {
        throw new Error(`Invalid input: ${validation.errors?.join(', ')}`);
      }

      // Check rate limit
      if (metadata.rateLimit) {
        await this.checkRateLimit(toolName, context.userId, metadata.rateLimit);
      }

      // Execute tool
      const output = await tool.execute(input, context);

      // Calculate execution time
      const executionTimeMs = Date.now() - startTime;

      // Log execution
      await this.logExecution({
        toolName,
        input,
        output,
        executionTimeMs,
        executedAt: new Date(),
      }, context);

      return {
        toolName,
        input,
        output,
        executionTimeMs,
        executedAt: new Date(),
      };
    } catch (error: any) {
      const executionTimeMs = Date.now() - startTime;

      const result: ToolExecutionResult = {
        toolName,
        input,
        output: {
          success: false,
          error: error.message,
        },
        executionTimeMs,
        executedAt: new Date(),
      };

      // Log failed execution
      await this.logExecution(result, context);

      return result;
    }
  }

  /**
   * Execute multiple tools in sequence
   */
  async executeMany(
    toolCalls: Array<{ name: string; input: ToolInput }>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    for (const call of toolCalls) {
      const result = await this.execute(call.name, call.input, context);
      results.push(result);
    }

    return results;
  }

  /**
   * Execute multiple tools in parallel
   */
  async executeParallel(
    toolCalls: Array<{ name: string; input: ToolInput }>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult[]> {
    const promises = toolCalls.map(call =>
      this.execute(call.name, call.input, context)
    );

    return Promise.all(promises);
  }

  /**
   * Log tool execution to database
   */
  private async logExecution(
    result: ToolExecutionResult,
    context: ToolExecutionContext
  ): Promise<void> {
    try {
      await pool.query(
        `INSERT INTO tool_executions
         (session_id, message_id, tool_name, tool_input, tool_output, execution_status, error_message, execution_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          context.sessionId || null,
          null, // message_id can be added later
          result.toolName,
          JSON.stringify(result.input),
          JSON.stringify(result.output.data),
          result.output.success ? 'success' : 'error',
          result.output.error || null,
          result.executionTimeMs,
        ]
      );
    } catch (error) {
      console.error('Error logging tool execution:', error);
      // Don't throw - logging failure shouldn't break tool execution
    }
  }

  /**
   * Check rate limit for a tool
   */
  private async checkRateLimit(
    toolName: string,
    userId: number,
    rateLimit: { maxCalls: number; windowMs: number }
  ): Promise<void> {
    const windowStart = new Date(Date.now() - rateLimit.windowMs);

    const result = await pool.query(
      `SELECT COUNT(*) as call_count
       FROM tool_executions
       WHERE tool_name = $1
         AND executed_at > $2
         AND EXISTS (
           SELECT 1 FROM chat_sessions cs
           WHERE cs.id = tool_executions.session_id
             AND cs.student_id = $3
         )`,
      [toolName, windowStart, userId]
    );

    const callCount = parseInt(result.rows[0]?.call_count || '0');

    if (callCount >= rateLimit.maxCalls) {
      throw new Error(
        `Rate limit exceeded for tool ${toolName}. ` +
        `Max ${rateLimit.maxCalls} calls per ${rateLimit.windowMs}ms.`
      );
    }
  }

  /**
   * Get execution history for a session
   */
  async getExecutionHistory(sessionId: number, limit: number = 50): Promise<any[]> {
    const result = await pool.query(
      `SELECT *
       FROM tool_executions
       WHERE session_id = $1
       ORDER BY executed_at DESC
       LIMIT $2`,
      [sessionId, limit]
    );

    return result.rows;
  }

  /**
   * Get tool usage statistics
   */
  async getUsageStats(
    toolName?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<any> {
    let query = `
      SELECT
        tool_name,
        COUNT(*) as total_executions,
        COUNT(CASE WHEN execution_status = 'success' THEN 1 END) as successful,
        COUNT(CASE WHEN execution_status = 'error' THEN 1 END) as failed,
        AVG(execution_time_ms) as avg_execution_time_ms,
        MAX(execution_time_ms) as max_execution_time_ms,
        MIN(execution_time_ms) as min_execution_time_ms
      FROM tool_executions
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (toolName) {
      query += ` AND tool_name = $${paramIndex}`;
      params.push(toolName);
      paramIndex++;
    }

    if (startDate) {
      query += ` AND executed_at >= $${paramIndex}`;
      params.push(startDate);
      paramIndex++;
    }

    if (endDate) {
      query += ` AND executed_at <= $${paramIndex}`;
      params.push(endDate);
      paramIndex++;
    }

    query += ' GROUP BY tool_name ORDER BY total_executions DESC';

    const result = await pool.query(query, params);
    return result.rows;
  }
}

// Export singleton instance
export const toolExecutor = new ToolExecutor();
