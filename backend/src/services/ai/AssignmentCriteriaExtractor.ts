import { getAIService } from './AIServiceFactory';
import { AIMessage, AIResponse } from './types';

/**
 * Assignment Criteria Extractor Service
 *
 * Purpose: Analyzes assignment descriptions and extracts grading criteria
 * that will be used for automated tentative grading.
 *
 * This service runs ONCE when an assignment is created/published,
 * extracting requirements that are stored and reused for all submissions.
 */

export interface ExtractedCriteria {
  requirements: string[];          // Core requirements that must be met
  key_topics: string[];             // Main topics/concepts to be addressed
  evaluation_points: EvaluationPoint[];  // Specific evaluation criteria
  complexity_level: string;         // Estimated complexity (simple, moderate, complex)
  estimated_effort: string;         // Estimated effort (short, medium, long)
  rubric_suggestion?: RubricSuggestion;  // Suggested rubric if not provided
}

export interface EvaluationPoint {
  criterion: string;                // What to evaluate (e.g., "Citation quality")
  description: string;              // How to evaluate it
  weight: number;                   // Suggested weight/importance (0-100)
}

export interface RubricSuggestion {
  total_points: number;
  criteria: Array<{
    name: string;
    description: string;
    max_points: number;
    levels: Array<{
      score: number;
      description: string;
    }>;
  }>;
}

export class AssignmentCriteriaExtractor {
  private aiService = getAIService();

  private getSystemPrompt(): string {
    return `You are an expert educational assessment analyst. Your role is to analyze assignment descriptions and extract comprehensive grading criteria.

Your responsibilities:
1. Identify all explicit and implicit requirements from the assignment description
2. Extract key topics and concepts students need to address
3. Define specific evaluation points with appropriate weights
4. Assess the complexity level and estimated effort
5. Suggest a detailed rubric structure if one isn't provided

IMPORTANT GUIDELINES:
- Be thorough but concise in extracting requirements
- Focus on measurable, objective criteria where possible
- Consider both content requirements and format/structure requirements
- Weight evaluation points based on their importance in the assignment
- Distinguish between required elements and optional/bonus elements
- Consider common academic standards (clarity, organization, citation, analysis depth, etc.)

OUTPUT FORMAT:
Return a JSON object with this exact structure:
{
  "requirements": ["requirement 1", "requirement 2", ...],
  "key_topics": ["topic 1", "topic 2", ...],
  "evaluation_points": [
    {
      "criterion": "criterion name",
      "description": "how to evaluate",
      "weight": 25
    },
    ...
  ],
  "complexity_level": "simple|moderate|complex",
  "estimated_effort": "short|medium|long",
  "rubric_suggestion": {
    "total_points": 100,
    "criteria": [
      {
        "name": "criterion name",
        "description": "what this measures",
        "max_points": 30,
        "levels": [
          {"score": 30, "description": "Excellent"},
          {"score": 20, "description": "Good"},
          {"score": 10, "description": "Needs improvement"},
          {"score": 0, "description": "Missing"}
        ]
      },
      ...
    ]
  }
}

Be precise and ensure all weights sum to approximately 100.`;
  }

  /**
   * Extract grading criteria from assignment data
   */
  async extractCriteria(
    title: string,
    description: string,
    questionText: string,
    maxPoints: number = 100
  ): Promise<ExtractedCriteria> {
    try {
      // Build the analysis prompt
      const userPrompt = this.buildAnalysisPrompt(title, description, questionText, maxPoints);

      // Prepare messages
      const messages: AIMessage[] = [
        {
          role: 'system',
          content: this.getSystemPrompt()
        },
        {
          role: 'user',
          content: userPrompt
        }
      ];

      // Generate AI response
      const aiResponse: AIResponse = await this.aiService.generateResponse(
        messages,
        { conversationHistory: messages },
        this.getSystemPrompt()
      );

      // Parse and validate the response
      const criteria = this.parseAIResponse(aiResponse.content);

      // Normalize weights to match maxPoints
      this.normalizeWeights(criteria, maxPoints);

      return criteria;
    } catch (error) {
      console.error('Error extracting assignment criteria:', error);

      // Return a basic fallback criteria
      return this.getFallbackCriteria(title, description, questionText, maxPoints);
    }
  }

  /**
   * Build the analysis prompt for the AI
   */
  private buildAnalysisPrompt(
    title: string,
    description: string,
    questionText: string,
    maxPoints: number
  ): string {
    return `Please analyze this assignment and extract comprehensive grading criteria:

ASSIGNMENT TITLE:
${title}

ASSIGNMENT DESCRIPTION:
${description || 'No description provided'}

ASSIGNMENT QUESTION/INSTRUCTIONS:
${questionText || 'No detailed instructions provided'}

MAXIMUM POINTS:
${maxPoints} points

Extract all requirements, topics, evaluation criteria, and suggest a detailed rubric structure. Return your analysis as JSON following the specified format.`;
  }

  /**
   * Parse AI response into structured criteria
   */
  private parseAIResponse(content: string): ExtractedCriteria {
    try {
      // Extract JSON from response (might be wrapped in markdown code blocks)
      let jsonStr = content.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(jsonStr);

      // Validate required fields
      if (!parsed.requirements || !Array.isArray(parsed.requirements)) {
        throw new Error('Invalid requirements field');
      }
      if (!parsed.key_topics || !Array.isArray(parsed.key_topics)) {
        throw new Error('Invalid key_topics field');
      }
      if (!parsed.evaluation_points || !Array.isArray(parsed.evaluation_points)) {
        throw new Error('Invalid evaluation_points field');
      }

      return {
        requirements: parsed.requirements,
        key_topics: parsed.key_topics,
        evaluation_points: parsed.evaluation_points,
        complexity_level: parsed.complexity_level || 'moderate',
        estimated_effort: parsed.estimated_effort || 'medium',
        rubric_suggestion: parsed.rubric_suggestion
      };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      console.error('Raw content:', content);
      throw new Error('Failed to parse AI criteria extraction response');
    }
  }

  /**
   * Normalize evaluation point weights to match max points
   */
  private normalizeWeights(criteria: ExtractedCriteria, maxPoints: number): void {
    if (!criteria.evaluation_points || criteria.evaluation_points.length === 0) {
      return;
    }

    const totalWeight = criteria.evaluation_points.reduce((sum, point) => sum + point.weight, 0);

    if (totalWeight === 0) {
      // Distribute evenly
      const evenWeight = Math.floor(maxPoints / criteria.evaluation_points.length);
      criteria.evaluation_points.forEach(point => {
        point.weight = evenWeight;
      });
    } else {
      // Normalize to maxPoints
      const factor = maxPoints / totalWeight;
      criteria.evaluation_points.forEach(point => {
        point.weight = Math.round(point.weight * factor);
      });
    }

    // Also normalize rubric suggestion if present
    if (criteria.rubric_suggestion) {
      criteria.rubric_suggestion.total_points = maxPoints;

      const totalRubricPoints = criteria.rubric_suggestion.criteria.reduce(
        (sum, c) => sum + c.max_points,
        0
      );

      if (totalRubricPoints > 0) {
        const factor = maxPoints / totalRubricPoints;
        criteria.rubric_suggestion.criteria.forEach(criterion => {
          criterion.max_points = Math.round(criterion.max_points * factor);
        });
      }
    }
  }

  /**
   * Fallback criteria when AI extraction fails
   */
  private getFallbackCriteria(
    title: string,
    description: string,
    questionText: string,
    maxPoints: number
  ): ExtractedCriteria {
    return {
      requirements: [
        'Complete the assignment as described',
        'Submit before the due date',
        'Follow any formatting guidelines'
      ],
      key_topics: [title],
      evaluation_points: [
        {
          criterion: 'Content Quality',
          description: 'Completeness and accuracy of the submission',
          weight: 40
        },
        {
          criterion: 'Organization',
          description: 'Clear structure and logical flow',
          weight: 30
        },
        {
          criterion: 'Following Instructions',
          description: 'Adherence to assignment requirements',
          weight: 30
        }
      ],
      complexity_level: 'moderate',
      estimated_effort: 'medium',
      rubric_suggestion: {
        total_points: maxPoints,
        criteria: [
          {
            name: 'Content Quality',
            description: 'Completeness and accuracy of the submission',
            max_points: Math.round(maxPoints * 0.4),
            levels: [
              { score: Math.round(maxPoints * 0.4), description: 'Excellent - Complete and accurate' },
              { score: Math.round(maxPoints * 0.3), description: 'Good - Mostly complete' },
              { score: Math.round(maxPoints * 0.2), description: 'Fair - Partially complete' },
              { score: 0, description: 'Incomplete or inaccurate' }
            ]
          },
          {
            name: 'Organization',
            description: 'Clear structure and logical flow',
            max_points: Math.round(maxPoints * 0.3),
            levels: [
              { score: Math.round(maxPoints * 0.3), description: 'Excellent - Well organized' },
              { score: Math.round(maxPoints * 0.2), description: 'Good - Generally organized' },
              { score: Math.round(maxPoints * 0.1), description: 'Fair - Somewhat disorganized' },
              { score: 0, description: 'Poor organization' }
            ]
          },
          {
            name: 'Following Instructions',
            description: 'Adherence to assignment requirements',
            max_points: Math.round(maxPoints * 0.3),
            levels: [
              { score: Math.round(maxPoints * 0.3), description: 'Excellent - All requirements met' },
              { score: Math.round(maxPoints * 0.2), description: 'Good - Most requirements met' },
              { score: Math.round(maxPoints * 0.1), description: 'Fair - Some requirements met' },
              { score: 0, description: 'Requirements not met' }
            ]
          }
        ]
      }
    };
  }

  /**
   * Re-extract criteria (useful when assignment is updated)
   */
  async updateCriteria(
    assignmentId: number,
    title: string,
    description: string,
    questionText: string,
    maxPoints: number
  ): Promise<ExtractedCriteria> {
    const criteria = await this.extractCriteria(title, description, questionText, maxPoints);

    // Log the update
    console.log(`Updated AI grading criteria for assignment ${assignmentId}`);

    return criteria;
  }
}

// Export singleton instance
export const assignmentCriteriaExtractor = new AssignmentCriteriaExtractor();
