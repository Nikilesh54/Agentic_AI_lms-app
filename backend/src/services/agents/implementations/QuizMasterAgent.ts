import { BaseAgent } from '../BaseAgent';
import {
  AgentType,
  AgentMetadata,
  AgentExecutionContext,
} from '../types';

/**
 * Quiz Master Agent - Generates practice questions and quizzes
 */
export class QuizMasterAgent extends BaseAgent {
  protected metadata: AgentMetadata = {
    name: 'Quiz Master',
    description: 'Generates practice questions, quizzes, and provides immediate feedback',
    agentType: AgentType.QUIZ_MASTER,
    systemPrompt: `You are Quiz Master, an AI agent specialized in creating practice questions and quizzes.

Your role is to:
- Generate high-quality practice questions on any topic
- Create quizzes with appropriate difficulty levels
- Provide immediate feedback on practice attempts
- Offer hints without giving away answers
- Track which concepts students struggle with

Types of questions you can create:
- Multiple choice questions (MCQs)
- True/False questions
- Short answer questions
- Problem-solving questions

When generating questions:
1. Align with course materials and learning objectives
2. Vary difficulty based on student's progress
3. Include clear explanations for correct answers
4. Provide hints for incorrect attempts
5. Never create questions that directly match assignment questions

After students answer:
- Provide constructive feedback
- Explain why answers are correct or incorrect
- Suggest related concepts to review if they struggle
- Offer additional practice if needed

Use available tools to:
- Generate quiz questions
- Search course materials for question content
- Analyze which topics need more practice`,
    capabilities: {
      canExplainConcepts: true,
      canGenerateQuizzes: true,
      canAccessGrades: false,
      canCreateContent: true,
      canAnalyzeProgress: false,
      canProvideGradingFeedback: false,
    },
    allowedRoles: ['student', 'professor'],
    tools: [
      'generateQuiz',
      'searchCourseMaterials',
      'explainConcept',
    ],
  };

  protected shouldHandoff(
    aiResponse: any,
    context: AgentExecutionContext
  ): { toAgent: AgentType; reason: string } | null {
    const content = aiResponse.content.toLowerCase();

    // Hand off to tutor if student needs concept explanation
    if (content.includes('don\'t understand') || content.includes('explain')) {
      const needsDeepExplanation =
        content.includes('confused') ||
        content.includes('help me understand');

      if (needsDeepExplanation) {
        return {
          toAgent: AgentType.TUTOR,
          reason: 'Student needs detailed concept explanation',
        };
      }
    }

    return null;
  }
}
