import { getAIService } from '../ai/AIServiceFactory';
import { AIMessage } from '../ai/types';
import { toolExecutor } from '../tools/ToolExecutor';
import {
  AgentType,
  AgentExecutionContext,
  AgentResponse,
  AgentMetadata,
} from './types';

/**
 * Base Agent class
 * All specialized agents extend this class
 */
export abstract class BaseAgent {
  protected abstract metadata: AgentMetadata;

  /**
   * Get agent metadata
   */
  getMetadata(): AgentMetadata {
    return this.metadata;
  }

  /**
   * Execute the agent with a user message
   */
  async execute(
    message: string,
    context: AgentExecutionContext
  ): Promise<AgentResponse> {
    try {
      // Build conversation messages
      const messages: AIMessage[] = [
        ...context.conversationHistory,
        {
          role: 'user',
          content: message,
        },
      ];

      // Get AI service
      const aiService = getAIService();

      // Generate AI response
      const aiResponse = await aiService.generateResponse(
        messages,
        context.aiContext,
        this.metadata.systemPrompt
      );

      // Execute tools if requested
      if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
        const toolResults = await toolExecutor.executeMany(
          aiResponse.toolCalls.map(tc => ({
            name: tc.name,
            input: tc.arguments,
          })),
          {
            userId: context.userId,
            userRole: context.userRole,
            courseId: context.courseId,
            sessionId: context.sessionId,
          }
        );

        // Add tool results to context
        context.aiContext.toolResults = toolResults.map(tr => ({
          toolCallId: tr.toolName,
          result: tr.output.data,
          error: tr.output.error,
        }));

        // Regenerate response with tool results
        const messagesWithTools: AIMessage[] = [
          ...messages,
          {
            role: 'assistant',
            content: aiResponse.content,
            metadata: { toolCalls: aiResponse.toolCalls },
          },
          {
            role: 'user',
            content: `Tool results: ${JSON.stringify(toolResults.map(tr => ({
              tool: tr.toolName,
              result: tr.output,
            })))}`,
          },
        ];

        const finalResponse = await aiService.generateResponse(
          messagesWithTools,
          context.aiContext,
          this.metadata.systemPrompt
        );

        return this.buildAgentResponse(finalResponse, context);
      }

      return this.buildAgentResponse(aiResponse, context);
    } catch (error: any) {
      console.error(`Error in agent ${this.metadata.agentType}:`, error);

      return {
        content: 'I apologize, but I encountered an error processing your request. Please try again or contact your instructor for assistance.',
        confidence: 0,
        requiresReview: true,
        agentType: this.metadata.agentType,
        shouldEscalate: {
          reason: `Agent error: ${error.message}`,
          priority: 'high',
        },
      };
    }
  }

  /**
   * Build agent response from AI response
   */
  protected buildAgentResponse(
    aiResponse: any,
    context: AgentExecutionContext
  ): AgentResponse {
    const response: AgentResponse = {
      ...aiResponse,
      agentType: this.metadata.agentType,
    };

    // Check if handoff is needed
    const handoff = this.shouldHandoff(aiResponse, context);
    if (handoff) {
      response.shouldHandoff = handoff;
    }

    // Check if escalation is needed
    const escalation = this.shouldEscalate(aiResponse, context);
    if (escalation) {
      response.shouldEscalate = escalation;
    }

    return response;
  }

  /**
   * Determine if conversation should be handed off to another agent
   * Override in specialized agents for custom handoff logic
   */
  protected shouldHandoff(
    aiResponse: any,
    context: AgentExecutionContext
  ): { toAgent: AgentType; reason: string } | null {
    return null; // No handoff by default
  }

  /**
   * Determine if conversation should be escalated to human
   * Override in specialized agents for custom escalation logic
   */
  protected shouldEscalate(
    aiResponse: any,
    context: AgentExecutionContext
  ): { reason: string; priority: 'low' | 'medium' | 'high' | 'critical' } | null {
    // Escalate if response requires review
    if (aiResponse.requiresReview) {
      return {
        reason: 'Response requires human review',
        priority: 'medium',
      };
    }

    // Escalate if confidence is very low
    if (aiResponse.confidence < 0.4) {
      return {
        reason: 'Low confidence response',
        priority: 'medium',
      };
    }

    return null;
  }

  /**
   * Get tools available to this agent
   */
  getAvailableTools(): string[] {
    return this.metadata.tools;
  }

  /**
   * Check if agent can handle a specific task
   */
  canHandle(task: string, userRole: string): boolean {
    return this.metadata.allowedRoles.includes('*') ||
           this.metadata.allowedRoles.includes(userRole);
  }
}
