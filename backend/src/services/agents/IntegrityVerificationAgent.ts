import { SimpleBaseAgent, AgentMetadata, AgentMessage, AgentResponse, ResponseSource } from './newAgentTypes';
import { AIContext, AIMessage } from '../ai/types';
import { getAIService } from '../ai/AIServiceFactory';
import { pool } from '../../config/database';

/**
 * Integrity Verification Agent
 *
 * Purpose: Independently verify chatbot responses and assign trust scores
 *
 * Trust Score Scale (0-100):
 * - Highest Trust (90-100): Direct quote from professor's course materials, exact match
 * - High Trust (70-89): Paraphrased content from course materials, accurate interpretation
 * - Medium Trust (50-69): Direct quote from reputable external sources
 * - Lower Trust (30-49): Paraphrased external content
 * - Low Trust (0-29): Unverified sources, conflicting information
 *
 * Display Format:
 * Trust Score: [XX/100]
 * Reason: [Brief explanation of score]
 */
export class IntegrityVerificationAgent extends SimpleBaseAgent {
  protected metadata: AgentMetadata = {
    name: 'Integrity Verifier',
    type: 'integrity_verifier',
    description: 'Verifies chatbot responses and assigns trust scores based on source quality',
    capabilities: [
      'Verify response accuracy',
      'Calculate trust scores',
      'Cross-reference sources',
      'Detect conflicts with course materials',
      'Evaluate source credibility'
    ],
    tools: [],
    systemPrompt: this.getSystemPrompt()
  };

  private getSystemPrompt(): string {
    return `You are an Integrity Verification Agent responsible for evaluating the trustworthiness of chatbot responses.

Your responsibilities:
1. Analyze chatbot responses and their cited sources
2. Assign trust scores (0-100) based on source quality and accuracy
3. Detect conflicts between response and course materials
4. Provide clear reasoning for trust scores
5. Help students understand the reliability of information

TRUST SCORING CRITERIA:

**Highest Trust (90-100):**
- Direct quote from professor's uploaded course materials
- Exact match with no interpretation needed
- Fully verifiable against authoritative course content
- No conflicts or discrepancies

**High Trust (70-89):**
- Paraphrased content from professor's course materials
- Accurate interpretation of course content
- Maintains original meaning and context
- Minor or no conflicts

**Medium Trust (50-69):**
- Direct quote from reputable external sources
- Academic journals, official documentation, recognized textbooks
- Verifiable and authoritative
- May have minor conflicts with course-specific content

**Lower Trust (30-49):**
- Paraphrased content from external sources
- Some interpretation involved
- Less authoritative sources (blogs, wikis, general websites)
- May contain conflicts with course materials

**Low Trust (0-29):**
- Unverified or questionable sources
- Significant interpretation or synthesis
- Conflicting information with course materials
- Unreliable or outdated sources
- No sources provided

Your output should be JSON with this structure:
{
  "trust_score": <0-100>,
  "trust_level": "<highest|high|medium|lower|low>",
  "reasoning": "<clear explanation>",
  "source_analysis": [
    {
      "source": "<source name>",
      "credibility": "<assessment>",
      "verification_status": "<verified|partially_verified|unverified>"
    }
  ],
  "conflicts": ["<any conflicts detected>"],
  "recommendations": "<suggestions for student>"
}`;
  }

  /**
   * Verify a chatbot response and assign trust score
   */
  async verifyResponse(
    messageId: number,
    messageContent: string,
    sources: ResponseSource[],
    courseId: number
  ): Promise<TrustScoreResult> {
    const startTime = Date.now();

    try {
      // Get course materials for cross-reference
      const courseMaterials = await this.getCourseMaterials(courseId);

      // Build verification context
      const verificationContext = this.buildVerificationContext(
        messageContent,
        sources,
        courseMaterials
      );

      // Generate verification using AI
      const messages: AIMessage[] = [
        {
          role: 'system',
          content: this.metadata.systemPrompt || ''
        },
        {
          role: 'user',
          content: verificationContext
        }
      ];

      const aiService = getAIService();
      const aiResponse = await aiService.generateResponse(
        messages,
        { conversationHistory: messages },
        this.metadata.systemPrompt
      );

      // Parse verification result
      const verificationResult = this.parseVerificationResponse(aiResponse.content);

      // Store trust score in database
      await this.storeTrustScore(messageId, verificationResult);

      // Log the action
      const executionTime = Date.now() - startTime;
      await this.logAgentAction(
        'verify_response',
        null,
        courseId,
        { messageId, sourcesCount: sources.length },
        verificationResult,
        aiResponse.confidence || 0.8,
        executionTime
      );

      return verificationResult;

    } catch (error: any) {
      console.error('Error verifying response:', error);

      // Log error
      await this.logAgentAction(
        'verify_response',
        null,
        courseId,
        { messageId, error: error.message },
        null,
        0,
        Date.now() - startTime,
        error.message
      );

      // Return a default low-trust score in case of error
      return {
        trust_score: 30,
        trust_level: 'lower',
        reasoning: 'Unable to verify response due to technical error. Please verify information independently.',
        source_analysis: [],
        conflicts: [],
        recommendations: 'Consult with your professor to verify this information.'
      };
    }
  }

  /**
   * Build context for verification
   */
  private buildVerificationContext(
    messageContent: string,
    sources: ResponseSource[],
    courseMaterials: any[]
  ): string {
    let context = `# Response Verification Task

## Chatbot Response to Verify:
${messageContent}

## Cited Sources:
`;

    if (sources.length === 0) {
      context += 'NO SOURCES PROVIDED - This is a major red flag!\n';
    } else {
      sources.forEach((source, index) => {
        context += `
${index + 1}. **${source.source_name}**
   - Type: ${source.source_type}
   - ${source.source_type === 'internet' ? `URL: ${source.source_url}` : `Course Material ID: ${source.source_id}`}
   - ${source.page_number ? `Page: ${source.page_number}` : ''}
   - ${source.source_excerpt ? `Excerpt: ${source.source_excerpt}` : ''}
   - Claimed Relevance: ${(source.relevance_score * 100).toFixed(0)}%
`;
      });
    }

    context += `

## Available Course Materials for Cross-Reference:
`;

    if (courseMaterials.length === 0) {
      context += 'No course materials available for verification.\n';
    } else {
      courseMaterials.forEach((material, index) => {
        context += `${index + 1}. ${material.file_name} (ID: ${material.id})\n`;
      });
    }

    context += `

## Your Task:
1. Evaluate the quality and credibility of each cited source
2. Check if sources actually support the claims made in the response
3. Cross-reference with available course materials
4. Detect any conflicts or discrepancies
5. Assign a trust score (0-100) according to the criteria
6. Provide clear reasoning for the score
7. Offer recommendations to the student

Respond with the JSON structure specified in your system prompt.`;

    return context;
  }

  /**
   * Parse verification response from AI
   */
  private parseVerificationResponse(responseContent: string): TrustScoreResult {
    try {
      // Extract JSON from response
      const jsonMatch = responseContent.match(/```json\n([\s\S]*?)\n```/) ||
                       responseContent.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('Could not parse JSON from verification response');
      }

      const jsonText = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonText);

      // Validate trust level matches score
      const trustLevel = this.determineTrustLevel(parsed.trust_score || 50);

      return {
        trust_score: parsed.trust_score || 50,
        trust_level: trustLevel,
        reasoning: parsed.reasoning || 'Unable to determine verification reasoning',
        source_analysis: parsed.source_analysis || [],
        conflicts: parsed.conflicts || [],
        recommendations: parsed.recommendations || 'Please verify this information with your professor.'
      };

    } catch (error) {
      console.error('Error parsing verification response:', error);

      // Fallback result
      return {
        trust_score: 50,
        trust_level: 'medium',
        reasoning: 'Unable to parse detailed verification. Manual review recommended.',
        source_analysis: [],
        conflicts: [],
        recommendations: 'Please consult with your professor to verify this information.'
      };
    }
  }

  /**
   * Determine trust level from score
   */
  private determineTrustLevel(score: number): TrustLevel {
    if (score >= 90) return 'highest';
    if (score >= 70) return 'high';
    if (score >= 50) return 'medium';
    if (score >= 30) return 'lower';
    return 'low';
  }

  /**
   * Get course materials for verification
   */
  private async getCourseMaterials(courseId: number): Promise<any[]> {
    const result = await pool.query(
      `SELECT id, file_name, file_type, uploaded_at
       FROM course_materials
       WHERE course_id = $1
       ORDER BY uploaded_at DESC`,
      [courseId]
    );

    return result.rows;
  }

  /**
   * Store trust score in database
   */
  private async storeTrustScore(
    messageId: number,
    verification: TrustScoreResult
  ): Promise<void> {
    const query = `
      INSERT INTO message_trust_scores (
        message_id,
        trust_score,
        trust_level,
        verification_reasoning,
        source_verification_details,
        conflicts_detected
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (message_id)
      DO UPDATE SET
        trust_score = EXCLUDED.trust_score,
        trust_level = EXCLUDED.trust_level,
        verification_reasoning = EXCLUDED.verification_reasoning,
        source_verification_details = EXCLUDED.source_verification_details,
        conflicts_detected = EXCLUDED.conflicts_detected,
        verification_timestamp = CURRENT_TIMESTAMP
    `;

    await pool.query(query, [
      messageId,
      verification.trust_score,
      verification.trust_level,
      verification.reasoning,
      JSON.stringify(verification.source_analysis),
      verification.conflicts
    ]);
  }

  /**
   * Log agent action to audit log
   */
  private async logAgentAction(
    actionType: string,
    userId: number | null,
    courseId: number | null,
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
        course_id,
        input_data,
        output_data,
        confidence_score,
        execution_time_ms,
        error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await pool.query(query, [
      'integrity_verification',
      actionType,
      userId,
      courseId,
      JSON.stringify(inputData),
      JSON.stringify(outputData),
      confidence,
      executionTime,
      errorMessage || null
    ]);
  }

  // Implement abstract method from SimpleBaseAgent
  async execute(message: AgentMessage, context: AIContext): Promise<AgentResponse> {
    // This agent is primarily called through verifyResponse
    throw new Error('Integrity Verification Agent should be called via verifyResponse method');
  }
}

// =====================================================
// Type Definitions
// =====================================================

export type TrustLevel = 'highest' | 'high' | 'medium' | 'lower' | 'low';

export interface TrustScoreResult {
  trust_score: number; // 0-100
  trust_level: TrustLevel;
  reasoning: string;
  source_analysis: SourceAnalysis[];
  conflicts: string[];
  recommendations: string;
}

export interface SourceAnalysis {
  source: string;
  credibility: string;
  verification_status: 'verified' | 'partially_verified' | 'unverified';
}
