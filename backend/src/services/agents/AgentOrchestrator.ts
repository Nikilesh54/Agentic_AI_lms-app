import { pool } from '../../config/database';
import { agentRegistry } from './AgentRegistry';
import { BaseAgent } from './BaseAgent';
import {
  AgentType,
  AgentExecutionContext,
  AgentResponse,
} from './types';

/**
 * Agent Orchestrator - Routes messages to appropriate agents
 * Handles agent handoffs and human escalations
 */
export class AgentOrchestrator {
  /**
   * Process a message and route to appropriate agent
   */
  async processMessage(
    message: string,
    context: AgentExecutionContext,
    preferredAgentType?: AgentType
  ): Promise<AgentResponse> {
    try {
      // Select agent
      const agent = await this.selectAgent(message, context, preferredAgentType);

      if (!agent) {
        throw new Error('No suitable agent found for this task');
      }

      // Execute agent
      const response = await agent.execute(message, context);

      // Handle agent handoff
      if (response.shouldHandoff) {
        return await this.handleHandoff(
          message,
          context,
          response,
          agent.getMetadata().agentType,
          response.shouldHandoff.toAgent
        );
      }

      // Handle human escalation
      if (response.shouldEscalate) {
        await this.handleEscalation(context, response);
      }

      return response;
    } catch (error: any) {
      console.error('Error in agent orchestrator:', error);

      return {
        content: 'I apologize, but I encountered an error. Your instructor has been notified.',
        confidence: 0,
        requiresReview: true,
        agentType: AgentType.COURSE_ASSISTANT,
        shouldEscalate: {
          reason: `Orchestrator error: ${error.message}`,
          priority: 'critical',
        },
      };
    }
  }

  /**
   * Select the most appropriate agent for the task
   */
  private async selectAgent(
    message: string,
    context: AgentExecutionContext,
    preferredAgentType?: AgentType
  ): Promise<BaseAgent | null> {
    // Use preferred agent if specified
    if (preferredAgentType) {
      const agent = agentRegistry.get(preferredAgentType);
      if (agent && agent.canHandle(message, context.userRole)) {
        return agent;
      }
    }

    // Get last agent used in this session
    const lastAgent = await this.getLastAgentUsed(context.sessionId);
    if (lastAgent) {
      const agent = agentRegistry.get(lastAgent);
      if (agent && agent.canHandle(message, context.userRole)) {
        return agent;
      }
    }

    // Select based on message content and user role
    return agentRegistry.selectAgent(message, context.userRole);
  }

  /**
   * Handle agent handoff
   */
  private async handleHandoff(
    message: string,
    context: AgentExecutionContext,
    previousResponse: AgentResponse,
    fromAgent: AgentType,
    toAgent: AgentType
  ): Promise<AgentResponse> {
    console.log(`Handing off from ${fromAgent} to ${toAgent}`);

    // Log the handoff
    await this.logHandoff(
      context.sessionId,
      fromAgent,
      toAgent,
      previousResponse.shouldHandoff?.reason || 'Agent handoff'
    );

    // Get the new agent
    const newAgent = agentRegistry.get(toAgent);
    if (!newAgent) {
      console.error(`Target agent ${toAgent} not found`);
      return previousResponse; // Return previous response if handoff fails
    }

    // Add handoff context to conversation
    const handoffMessage = {
      role: 'system' as const,
      content: `[Handoff from ${fromAgent} to ${toAgent}: ${previousResponse.shouldHandoff?.reason}]`,
    };
    context.conversationHistory.push(handoffMessage);

    // Execute with new agent
    const newResponse = await newAgent.execute(message, context);
    newResponse.metadata = {
      ...newResponse.metadata,
      handedOffFrom: fromAgent,
      handoffReason: previousResponse.shouldHandoff?.reason,
    };

    return newResponse;
  }

  /**
   * Handle human escalation
   */
  private async handleEscalation(
    context: AgentExecutionContext,
    response: AgentResponse
  ): Promise<void> {
    if (!response.shouldEscalate) return;

    try {
      // Create intervention request
      await pool.query(
        `INSERT INTO intervention_queue
         (session_id, trigger_type, trigger_reason, priority, status)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          context.sessionId,
          'AI_ESCALATION',
          response.shouldEscalate.reason,
          response.shouldEscalate.priority,
          'pending',
        ]
      );

      console.log(`Escalated session ${context.sessionId}: ${response.shouldEscalate.reason}`);
    } catch (error) {
      console.error('Error creating intervention:', error);
    }
  }

  /**
   * Get the last agent used in a session
   */
  private async getLastAgentUsed(sessionId: number): Promise<AgentType | null> {
    try {
      const result = await pool.query(
        `SELECT agent_type
         FROM chat_messages
         WHERE session_id = $1
           AND sender_type = 'agent'
           AND agent_type IS NOT NULL
         ORDER BY created_at DESC
         LIMIT 1`,
        [sessionId]
      );

      return result.rows[0]?.agent_type || null;
    } catch (error) {
      console.error('Error getting last agent:', error);
      return null;
    }
  }

  /**
   * Log agent handoff to database
   */
  private async logHandoff(
    sessionId: number,
    fromAgent: AgentType,
    toAgent: AgentType,
    reason: string
  ): Promise<void> {
    try {
      // Get agent IDs
      const fromAgentId = await this.getAgentId(fromAgent);
      const toAgentId = await this.getAgentId(toAgent);

      await pool.query(
        `INSERT INTO agent_collaborations
         (session_id, from_agent_id, to_agent_id, handoff_reason)
         VALUES ($1, $2, $3, $4)`,
        [sessionId, fromAgentId, toAgentId, reason]
      );
    } catch (error) {
      console.error('Error logging handoff:', error);
    }
  }

  /**
   * Get agent database ID by type
   */
  private async getAgentId(agentType: AgentType): Promise<number | null> {
    try {
      const result = await pool.query(
        'SELECT id FROM chat_agents WHERE agent_type = $1 LIMIT 1',
        [agentType]
      );

      return result.rows[0]?.id || null;
    } catch (error) {
      console.error('Error getting agent ID:', error);
      return null;
    }
  }

  /**
   * Get orchestration statistics
   */
  async getStats(sessionId?: number): Promise<any> {
    try {
      let query = `
        SELECT
          COUNT(*) as total_handoffs,
          from_agent_id,
          to_agent_id,
          handoff_reason
        FROM agent_collaborations
      `;

      const params: any[] = [];

      if (sessionId) {
        query += ' WHERE session_id = $1';
        params.push(sessionId);
      }

      query += ' GROUP BY from_agent_id, to_agent_id, handoff_reason';

      const result = await pool.query(query, params);

      return {
        handoffs: result.rows,
        totalHandoffs: result.rows.reduce((sum, row) => sum + parseInt(row.total_handoffs), 0),
      };
    } catch (error) {
      console.error('Error getting orchestration stats:', error);
      return { handoffs: [], totalHandoffs: 0 };
    }
  }
}

// Export singleton instance
export const agentOrchestrator = new AgentOrchestrator();
