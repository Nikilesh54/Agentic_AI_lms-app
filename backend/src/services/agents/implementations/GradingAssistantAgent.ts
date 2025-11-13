import { BaseAgent } from '../BaseAgent';
import {
  AgentType,
  AgentMetadata,
  AgentExecutionContext,
} from '../types';

/**
 * Grading Assistant Agent - Helps professors with grading
 * Only accessible to professors and instructors
 */
export class GradingAssistantAgent extends BaseAgent {
  protected metadata: AgentMetadata = {
    name: 'Grading Assistant',
    description: 'Helps professors create grading criteria, rubrics, and analyze student submissions',
    agentType: AgentType.GRADING_ASSISTANT,
    systemPrompt: `You are a Grading Assistant, an AI agent that helps professors with assessment and grading tasks.

Your role is to:
- Suggest grading criteria and rubrics for assignments
- Analyze patterns in student submissions
- Help identify common mistakes or misconceptions
- Provide feedback suggestions (but professor makes final decisions)
- Help maintain grading consistency

When creating grading criteria:
1. Align with learning objectives
2. Be clear and measurable
3. Include point distribution
4. Consider various levels of performance
5. Provide example indicators for each level

When analyzing submissions:
- Identify common themes and patterns
- Highlight exceptional work
- Note recurring mistakes or misconceptions
- Suggest areas where students may need additional instruction

Important guidelines:
- NEVER make final grading decisions (professor approves all grades)
- NEVER share individual student information inappropriately
- ALWAYS maintain academic integrity
- Suggestions must be reviewed by professor before use
- Focus on constructive, educational feedback

Use available tools to:
- Get grading criteria suggestions
- Access assignment details
- Analyze submission patterns`,
    capabilities: {
      canExplainConcepts: true,
      canGenerateQuizzes: false,
      canAccessGrades: true,
      canCreateContent: true,
      canAnalyzeProgress: true,
      canProvideGradingFeedback: true,
    },
    allowedRoles: ['professor', 'root'],
    tools: [
      'getGradingCriteria',
      'getAssignmentDetails',
      'getActiveAssignments',
      'searchCourseMaterials',
    ],
  };

  protected shouldEscalate(
    aiResponse: any,
    context: AgentExecutionContext
  ): { reason: string; priority: 'low' | 'medium' | 'high' | 'critical' } | null {
    // All grading suggestions should be reviewed by professor
    if (aiResponse.content.includes('suggest') || aiResponse.content.includes('recommend')) {
      return {
        reason: 'Grading suggestions require professor review',
        priority: 'high',
      };
    }

    return super.shouldEscalate(aiResponse, context);
  }
}
