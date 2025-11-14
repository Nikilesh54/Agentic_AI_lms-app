import { BaseAgent } from '../BaseAgent';
import {
  AgentType,
  AgentMetadata,
  AgentExecutionContext,
} from '../types';

/**
 * Tutor Agent - Explains concepts and answers questions
 * Primary agent for student learning support
 */
export class TutorAgent extends BaseAgent {
  protected metadata: AgentMetadata = {
    name: 'Tutor',
    description: 'Explains concepts, answers questions, and helps students understand course materials',
    agentType: AgentType.TUTOR,
    systemPrompt: `You are a helpful AI tutor for students in an online learning management system.

Your role is to:
- Explain concepts clearly and in multiple ways if needed
- Answer student questions about course materials
- Provide examples and analogies to aid understanding
- Guide students to think critically rather than giving direct answers
- Be encouraging and supportive
- Use the student's course materials as the primary source of truth

Important rules:
- NEVER give direct answers to assignment questions
- NEVER discuss grades (escalate to professor)
- NEVER make promises about deadlines or course policies
- Always encourage students to think through problems themselves
- If unsure, admit it and suggest checking course materials or asking the professor

When a student seems to be asking for assignment help:
1. Ask them to explain what they've tried so far
2. Guide them through the thinking process
3. Provide hints and related examples, not answers
4. Encourage them to apply the concepts themselves

Use available tools to:
- Search course materials for relevant information
- Find examples from course content
- Reference related assignments (without giving answers)`,
    capabilities: {
      canExplainConcepts: true,
      canGenerateQuizzes: false,
      canAccessGrades: false,
      canCreateContent: false,
      canAnalyzeProgress: false,
      canProvideGradingFeedback: false,
    },
    allowedRoles: ['student'],
    tools: [
      'searchCourseMaterials',
      'getCourseMaterials',
      'getActiveAssignments',
      'getAssignmentDetails',
      'explainConcept',
    ],
  };

  protected shouldHandoff(
    aiResponse: any,
    context: AgentExecutionContext
  ): { toAgent: AgentType; reason: string } | null {
    const content = aiResponse.content.toLowerCase();

    // Hand off to quiz master if student wants practice questions
    if (content.includes('practice') || content.includes('quiz')) {
      const hasQuizKeywords =
        content.includes('generate') ||
        content.includes('create') ||
        content.includes('make');

      if (hasQuizKeywords) {
        return {
          toAgent: AgentType.QUIZ_MASTER,
          reason: 'Student requested practice questions/quiz generation',
        };
      }
    }

    // Hand off to study coach if discussing study plans
    if (content.includes('study plan') || content.includes('schedule')) {
      return {
        toAgent: AgentType.STUDY_COACH,
        reason: 'Student needs help with study planning',
      };
    }

    return null;
  }

  protected shouldEscalate(
    aiResponse: any,
    context: AgentExecutionContext
  ): { reason: string; priority: 'low' | 'medium' | 'high' | 'critical' } | null {
    const content = aiResponse.content.toLowerCase();

    // Escalate grade discussions
    if (content.includes('grade') || content.includes('score')) {
      return {
        reason: 'Student asking about grades',
        priority: 'high',
      };
    }

    // Escalate if student is asking for direct answers
    if (content.includes('the answer is') || content.includes('solution:')) {
      return {
        reason: 'AI provided what looks like a direct answer',
        priority: 'critical',
      };
    }

    return super.shouldEscalate(aiResponse, context);
  }
}
