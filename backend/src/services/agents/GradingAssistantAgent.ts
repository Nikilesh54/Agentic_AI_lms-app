import { SimpleBaseAgent, AgentMetadata, AgentMessage, AgentResponse } from './newAgentTypes';
import { AIContext, AIMessage, AIResponse } from '../ai/types';
import { getAIService } from '../ai/AIServiceFactory';
import { pool } from '../../config/database';

/**
 * Grading Assistant Agent
 *
 * Purpose: Provides tentative grades for student submissions based on professor's rubric
 *
 * Requirements:
 * - Stateless operation (no memory storage)
 * - Input: Professor's grading rubric + student submission
 * - Process: Autonomous analysis of submission against rubric
 * - Output: Tentative grade with clear disclaimer
 * - Embedded within assignment submission workflow
 */
export class GradingAssistantAgent extends SimpleBaseAgent {
  protected metadata: AgentMetadata = {
    name: 'Grading Assistant',
    type: 'grading_assistant',
    description: 'Analyzes student submissions against grading rubrics to provide tentative grades',
    capabilities: [
      'Analyze student submissions',
      'Apply grading rubrics',
      'Generate tentative grades',
      'Identify strengths and areas for improvement',
      'Provide detailed feedback'
    ],
    tools: [],
    systemPrompt: this.getSystemPrompt()
  };

  private getSystemPrompt(): string {
    return `You are a Grading Assistant AI designed to help professors evaluate student submissions.

Your responsibilities:
1. Carefully analyze student submissions against the provided grading rubric
2. Provide a tentative grade with detailed breakdown by rubric criteria
3. Identify specific strengths in the submission
4. Identify specific areas that need improvement
5. Provide constructive feedback that helps students learn

IMPORTANT CONSTRAINTS:
- You provide TENTATIVE grades only - final grades are always determined by the professor
- Be fair, objective, and consistent in your evaluation
- Always cite specific examples from the submission to support your assessment
- Focus on learning outcomes and helping students improve
- If the submission is incomplete or unclear, note this in your feedback
- Use clear, constructive language in all feedback

UNCERTAINTY AND HONESTY GUIDELINES:
- **If you cannot confidently assess a criterion due to unclear submission or ambiguous rubric, explicitly state this**
- **Never make assumptions about what the student "probably meant" - grade what is actually submitted**
- When uncertain about scoring, provide a range or note: "This criterion is difficult to assess because..."
- If the rubric doesn't clearly define how to score something, flag this for the professor
- Do NOT fill in gaps or give benefit of the doubt without explicitly noting it

INLINE CITATION REQUIREMENTS FOR GRADING FEEDBACK:
- **Cite specific parts of the student's submission when providing feedback**
- Format: [Student submission, paragraph X] or [Student submission, section Y]
- Example: "The introduction clearly states the thesis [Student submission, paragraph 1] but lacks supporting evidence [Student submission, paragraph 2]."
- **Cite rubric criteria when explaining scores**
- Format: [Rubric: criterion_name]
- Example: "This meets the 'Clear Argumentation' criterion [Rubric: Argumentation] at the proficient level."
- Every piece of feedback must reference WHERE in the submission you found the issue/strength

Your output will be reviewed by the professor before being shared with students.

CRITICAL: Always include a disclaimer that this is a preliminary grade pending professor review.`;
  }

  /**
   * Generate tentative grade for a submission
   */
  async generateTentativeGrade(
    submissionId: number,
    assignmentId: number,
    studentId: number,
    submissionText: string,
    submissionFiles: string[],
    rubric: GradingRubric
  ): Promise<TentativeGradeResult> {
    const startTime = Date.now();

    try {
      // Build the grading context
      const gradingContext = await this.buildGradingContext(
        assignmentId,
        submissionText,
        submissionFiles,
        rubric
      );

      // Generate the AI prompt
      const messages: AIMessage[] = [
        {
          role: 'system',
          content: this.metadata.systemPrompt || ''
        },
        {
          role: 'user',
          content: gradingContext
        }
      ];

      // Get AI service and generate response
      const aiService = getAIService();
      const aiResponse: AIResponse = await aiService.generateResponse(
        messages,
        { conversationHistory: messages },
        this.metadata.systemPrompt
      );

      // Parse the AI response to extract grading information
      const gradeResult = this.parseGradingResponse(aiResponse.content, rubric);

      // Store the tentative grade in the database
      await this.storeTentativeGrade(
        submissionId,
        assignmentId,
        studentId,
        gradeResult,
        aiResponse.confidence || 0.7
      );

      // Log the action
      const executionTime = Date.now() - startTime;
      await this.logAgentAction(
        'generate_grade',
        studentId,
        assignmentId,
        { submissionId, rubricId: rubric.id },
        gradeResult,
        aiResponse.confidence || 0.7,
        executionTime
      );

      return gradeResult;

    } catch (error: any) {
      console.error('Error generating tentative grade:', error);

      // Log the error
      await this.logAgentAction(
        'generate_grade',
        studentId,
        assignmentId,
        { submissionId, error: error.message },
        null,
        0,
        Date.now() - startTime,
        error.message
      );

      throw new Error(`Failed to generate tentative grade: ${error.message}`);
    }
  }

  /**
   * Build context for grading
   */
  private async buildGradingContext(
    assignmentId: number,
    submissionText: string,
    submissionFiles: string[],
    rubric: GradingRubric
  ): Promise<string> {
    // Get assignment details
    const assignmentResult = await pool.query(
      'SELECT title, description, question_text, points FROM assignments WHERE id = $1',
      [assignmentId]
    );
    const assignment = assignmentResult.rows[0];

    // Build the prompt
    let context = `# Assignment Grading Task

## Assignment Details
**Title:** ${assignment.title}
**Description:** ${assignment.description || 'N/A'}
**Question:** ${assignment.question_text || 'N/A'}
**Total Points:** ${assignment.points}

## Grading Rubric
**Rubric Name:** ${rubric.rubric_name}
**Total Points:** ${rubric.total_points}

### Criteria:
`;

    // Add rubric criteria
    for (const criterion of rubric.criteria) {
      context += `
**${criterion.name}** (${criterion.points} points)
- Description: ${criterion.description}
- Excellent (${criterion.points}): ${criterion.excellent_description || 'Exceeds expectations'}
- Good (${Math.round(criterion.points * 0.8)}): ${criterion.good_description || 'Meets expectations'}
- Fair (${Math.round(criterion.points * 0.6)}): ${criterion.fair_description || 'Partially meets expectations'}
- Poor (${Math.round(criterion.points * 0.4)}): ${criterion.poor_description || 'Does not meet expectations'}
`;
    }

    context += `

## Student Submission
${submissionText}
`;

    if (submissionFiles.length > 0) {
      context += `\n**Attached Files:** ${submissionFiles.join(', ')}`;
    }

    context += `

## Task
Please evaluate this submission according to the rubric provided above.

Provide your response in the following JSON format:
{
  "tentative_grade": <number>,
  "rubric_breakdown": [
    {
      "criterion": "<criterion name>",
      "points_awarded": <number>,
      "points_possible": <number>,
      "justification": "<explanation>"
    }
  ],
  "strengths": [
    "<specific strength 1>",
    "<specific strength 2>"
  ],
  "areas_for_improvement": [
    "<specific area 1>",
    "<specific area 2>"
  ],
  "overall_feedback": "<constructive feedback paragraph>",
  "disclaimer": "⚠️ This is a preliminary grade. Final grade pending professor review."
}

Be thorough, fair, and constructive in your evaluation.`;

    return context;
  }

  /**
   * Parse the AI grading response
   */
  private parseGradingResponse(
    responseContent: string,
    rubric: GradingRubric
  ): TentativeGradeResult {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseContent.match(/```json\n([\s\S]*?)\n```/) ||
                       responseContent.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('Could not parse JSON from AI response');
      }

      const jsonText = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonText);

      return {
        tentative_grade: parsed.tentative_grade || 0,
        max_points: rubric.total_points,
        rubric_breakdown: parsed.rubric_breakdown || [],
        strengths: parsed.strengths || [],
        areas_for_improvement: parsed.areas_for_improvement || [],
        overall_feedback: parsed.overall_feedback || '',
        grading_rationale: responseContent,
        disclaimer: '⚠️ This is a preliminary grade. Final grade pending professor review.'
      };
    } catch (error) {
      console.error('Error parsing grading response:', error);

      // Fallback: return a basic result
      return {
        tentative_grade: 0,
        max_points: rubric.total_points,
        rubric_breakdown: [],
        strengths: [],
        areas_for_improvement: ['Unable to parse detailed feedback - please review manually'],
        overall_feedback: responseContent,
        grading_rationale: responseContent,
        disclaimer: '⚠️ This is a preliminary grade. Final grade pending professor review.'
      };
    }
  }

  /**
   * Store tentative grade in database
   */
  private async storeTentativeGrade(
    submissionId: number,
    assignmentId: number,
    studentId: number,
    gradeResult: TentativeGradeResult,
    confidence: number
  ): Promise<void> {
    const query = `
      INSERT INTO tentative_grades (
        submission_id,
        assignment_id,
        student_id,
        tentative_grade,
        max_points,
        grading_rationale,
        rubric_breakdown,
        strengths,
        areas_for_improvement,
        confidence_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (submission_id)
      DO UPDATE SET
        tentative_grade = EXCLUDED.tentative_grade,
        grading_rationale = EXCLUDED.grading_rationale,
        rubric_breakdown = EXCLUDED.rubric_breakdown,
        strengths = EXCLUDED.strengths,
        areas_for_improvement = EXCLUDED.areas_for_improvement,
        confidence_score = EXCLUDED.confidence_score,
        generated_at = CURRENT_TIMESTAMP
    `;

    await pool.query(query, [
      submissionId,
      assignmentId,
      studentId,
      gradeResult.tentative_grade,
      gradeResult.max_points,
      gradeResult.grading_rationale,
      JSON.stringify(gradeResult.rubric_breakdown),
      gradeResult.strengths,
      gradeResult.areas_for_improvement,
      confidence
    ]);
  }

  /**
   * Log agent action to audit log
   */
  private async logAgentAction(
    actionType: string,
    userId: number | null,
    assignmentId: number | null,
    inputData: any,
    outputData: any,
    confidence: number,
    executionTime: number,
    errorMessage?: string
  ): Promise<void> {
    const query = `
      INSERT INTO agent_audit_log (
        agent_type,
        action_type,
        user_id,
        assignment_id,
        input_data,
        output_data,
        confidence_score,
        execution_time_ms,
        error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await pool.query(query, [
      'grading_assistant',
      actionType,
      userId,
      assignmentId,
      JSON.stringify(inputData),
      JSON.stringify(outputData),
      confidence,
      executionTime,
      errorMessage || null
    ]);
  }

  // Implement abstract method from SimpleBaseAgent
  async execute(message: AgentMessage, context: AIContext): Promise<AgentResponse> {
    // This agent is primarily called through generateTentativeGrade
    // This method is for compatibility with the agent system
    throw new Error('Grading Assistant should be called via generateTentativeGrade method');
  }
}

// =====================================================
// Type Definitions
// =====================================================

export interface GradingRubric {
  id: number;
  assignment_id: number;
  rubric_name: string;
  criteria: RubricCriterion[];
  total_points: number;
}

export interface RubricCriterion {
  name: string;
  description: string;
  points: number;
  excellent_description?: string;
  good_description?: string;
  fair_description?: string;
  poor_description?: string;
}

export interface TentativeGradeResult {
  tentative_grade: number;
  max_points: number;
  rubric_breakdown: RubricBreakdownItem[];
  strengths: string[];
  areas_for_improvement: string[];
  overall_feedback: string;
  grading_rationale: string;
  disclaimer: string;
}

export interface RubricBreakdownItem {
  criterion: string;
  points_awarded: number;
  points_possible: number;
  justification: string;
}
