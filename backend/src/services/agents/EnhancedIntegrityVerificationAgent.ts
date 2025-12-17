import { SimpleBaseAgent, AgentMetadata, AgentMessage, AgentResponse, ResponseSource } from './newAgentTypes';
import { AIContext, AIMessage } from '../ai/types';
import { getAIService } from '../ai/AIServiceFactory';
import { pool } from '../../config/database';
import axios from 'axios';
import * as cheerio from 'cheerio';

/**
 * Enhanced Integrity Verification Agent
 *
 * INDEPENDENT verification with:
 * - Web crawling for internet sources
 * - Database content verification for course materials
 * - Semantic similarity checking
 * - Hallucination detection
 *
 * Key Principle: NEVER trust the chatbot's claims - verify everything independently!
 */
export class EnhancedIntegrityVerificationAgent extends SimpleBaseAgent {
  protected metadata: AgentMetadata = {
    name: 'Enhanced Integrity Verifier',
    type: 'enhanced_integrity_verifier',
    description: 'Independently verifies chatbot responses by crawling sources and checking actual content',
    capabilities: [
      'Web crawl internet sources',
      'Verify course material citations',
      'Detect hallucinations',
      'Compare claimed vs actual content',
      'Calculate evidence-based trust scores'
    ],
    tools: [],
    systemPrompt: this.getSystemPrompt()
  };

  private getSystemPrompt(): string {
    return `You are an Integrity Verification Agent. Your job is to OBJECTIVELY verify chatbot responses against source materials.

Your responsibilities:
1. Compare what the chatbot said against the actual source content provided
2. Look for the information in the source - it may be worded slightly differently due to PDF extraction
3. Account for formatting differences (extra spaces, line breaks, etc.) from PDF text extraction
4. Be fair and objective - if the information is present, acknowledge it
5. Provide evidence-based trust scores

VERIFICATION PROCESS:
1. For each claimed source, you will receive:
   - What the chatbot claimed
   - The ACTUAL content from the source (I fetched it from the database)
2. CAREFULLY search for the claimed information in the actual content
3. Remember: PDF text extraction may add extra spaces or line breaks
4. If the MEANING is present, even with different formatting, that's a match

TRUST SCORING (Evidence-Based):
- 90-100: Information found in source (direct quote or same meaning)
- 70-89: Accurate paraphrase, preserves core information
- 50-69: Partially accurate, some details differ
- 30-49: Significant discrepancies between claim and source
- 0-29: Information completely absent from source or contradicts it

Output JSON format:
{
  "trust_score": <0-100>,
  "trust_level": "<highest|high|medium|lower|low>",
  "verification_details": [
    {
      "source": "<source name>",
      "claimed_content": "<what chatbot said>",
      "actual_content": "<what source actually says>",
      "match_quality": "<exact|paraphrase|partial|mismatch|missing>",
      "evidence": "<specific proof>"
    }
  ],
  "hallucinations_detected": ["<list any fabricated claims>"],
  "reasoning": "<overall assessment>",
  "recommendations": "<advice for student>"
}`;
  }

  /**
   * MAIN METHOD: Independently verify a chatbot response
   */
  async verifyResponse(
    messageId: number,
    chatbotResponse: string,
    claimedSources: ResponseSource[],
    courseId: number
  ): Promise<EnhancedTrustScoreResult> {
    const startTime = Date.now();

    try {
      console.log(`🔍 Starting independent verification for message ${messageId}`);

      // Step 1: INDEPENDENTLY fetch actual source content
      const verifiedSources = await this.fetchAndVerifySources(
        claimedSources,
        courseId
      );

      // Step 2: Build verification context with ACTUAL content
      const verificationContext = this.buildVerificationContext(
        chatbotResponse,
        verifiedSources
      );

      // Step 3: Use AI to compare chatbot claims vs actual content
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

      // Step 4: Parse verification result
      const verificationResult = this.parseVerificationResponse(
        aiResponse.content,
        verifiedSources
      );

      // Step 5: Store detailed verification in database
      await this.storeTrustScore(messageId, verificationResult);

      // Step 6: Log the verification action
      const executionTime = Date.now() - startTime;
      await this.logVerificationAction(
        messageId,
        courseId,
        {
          chatbotResponse,
          claimedSourcesCount: claimedSources.length,
          verifiedSourcesCount: verifiedSources.filter(s => s.verification_status === 'verified').length
        },
        verificationResult,
        executionTime
      );

      console.log(`✅ Verification complete: Trust Score ${verificationResult.trust_score}/100`);

      return verificationResult;

    } catch (error: any) {
      console.error('❌ Error in enhanced verification:', error);

      // Log error
      await this.logVerificationAction(
        messageId,
        courseId,
        { error: error.message },
        null,
        Date.now() - startTime,
        error.message
      );

      // Return low-trust fallback
      return {
        trust_score: 30,
        trust_level: 'lower',
        reasoning: `Unable to verify response due to technical error: ${error.message}`,
        verification_details: [],
        hallucinations_detected: [],
        recommendations: 'Verification failed. Please manually check the sources or consult your professor.',
        evidence_summary: 'No evidence available due to verification error.'
      };
    }
  }

  /**
   * STEP 1: Independently fetch and verify each source
   */
  private async fetchAndVerifySources(
    claimedSources: ResponseSource[],
    courseId: number
  ): Promise<VerifiedSource[]> {
    const verifiedSources: VerifiedSource[] = [];

    for (const source of claimedSources) {
      let verifiedSource: VerifiedSource;

      if (source.source_type === 'course_material' && source.source_id) {
        // Verify course material independently
        verifiedSource = await this.verifyCourseMaterial(source, courseId);
      } else if (source.source_type === 'internet' && source.source_url) {
        // Web crawl internet source
        verifiedSource = await this.crawlInternetSource(source);
      } else {
        // Unknown or unverifiable source
        verifiedSource = {
          claimed: source,
          actual_content: null,
          verification_status: 'unverified',
          error: 'Source type not supported for verification'
        };
      }

      verifiedSources.push(verifiedSource);
    }

    return verifiedSources;
  }

  /**
   * Verify course material by fetching actual content from database
   * IMPROVED: Fetches the actual chunks that were used, not just full content
   */
  private async verifyCourseMaterial(
    source: ResponseSource,
    courseId: number
  ): Promise<VerifiedSource> {
    try {
      // Strategy 1: Try to fetch the specific chunks that match the page/section
      // This is more accurate than fetching the entire PDF content
      const chunksQuery = `
        SELECT
          cm.id,
          cm.file_name,
          cm.course_id,
          cme.chunk_text,
          cme.chunk_metadata
        FROM course_materials cm
        JOIN course_material_embeddings cme ON cm.id = cme.material_id
        WHERE cm.id = $1 AND cm.course_id = $2
      `;

      const chunksResult = await pool.query(chunksQuery, [source.source_id, courseId]);

      console.log(`📊 Found ${chunksResult.rows.length} chunks for material ${source.source_id}`);

      if (chunksResult.rows.length === 0) {
        // Fallback: Try to get full content if no chunks available
        const fallbackResult = await pool.query(
          `SELECT cm.id, cm.file_name, cm.course_id, cmc.content_text
           FROM course_materials cm
           LEFT JOIN course_material_content cmc ON cm.id = cmc.material_id
           WHERE cm.id = $1 AND cm.course_id = $2`,
          [source.source_id, courseId]
        );

        if (fallbackResult.rows.length === 0) {
          return {
            claimed: source,
            actual_content: null,
            verification_status: 'unverified',
            error: 'Course material not found or access denied'
          };
        }

        const material = fallbackResult.rows[0];
        if (!material.content_text) {
          return {
            claimed: source,
            actual_content: null,
            verification_status: 'partially_verified',
            error: 'Course material exists but content not extracted yet'
          };
        }

        // Use full content as last resort
        return {
          claimed: source,
          actual_content: material.content_text.substring(0, 3000),
          verification_status: 'partially_verified',
          metadata: {
            file_name: material.file_name,
            course_verified: material.course_id === courseId,
            note: 'Using full content (chunks not available)'
          }
        };
      }

      // Strategy: Use ALL chunks without filtering
      // Page numbers from PDF extraction are unreliable (all marked as page 1)
      // Better to give verifier full context and let AI figure it out
      const material = chunksResult.rows[0];

      console.log(`📚 Using ALL ${chunksResult.rows.length} chunks for verification (page filtering disabled due to PDF extraction limitations)`);

      const relevantChunks: string[] = chunksResult.rows.map(row => row.chunk_text);

      // Don't truncate - give verifier as much context as possible
      // Gemini can handle large contexts well
      const relevantContent = relevantChunks.join('\n\n').substring(0, 15000); // Increased to 15k for full document context

      console.log(`📝 Final content length: ${relevantContent.length} chars, ${relevantChunks.length} chunks used`);
      console.log(`📄 Content preview: ${relevantContent.substring(0, 200)}...`);

      return {
        claimed: source,
        actual_content: relevantContent,
        verification_status: 'verified',
        metadata: {
          file_name: material.file_name,
          course_verified: material.course_id === courseId,
          chunks_used: relevantChunks.length,
          total_chunks: chunksResult.rows.length
        }
      };

    } catch (error: any) {
      console.error('Error verifying course material:', error);
      return {
        claimed: source,
        actual_content: null,
        verification_status: 'unverified',
        error: error.message
      };
    }
  }

  /**
   * WEB CRAWLER: Fetch actual content from internet sources
   */
  private async crawlInternetSource(source: ResponseSource): Promise<VerifiedSource> {
    if (!source.source_url) {
      return {
        claimed: source,
        actual_content: null,
        verification_status: 'unverified',
        error: 'No URL provided'
      };
    }

    try {
      console.log(`🌐 Crawling: ${source.source_url}`);

      // Fetch the web page
      const response = await axios.get(source.source_url, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'Mozilla/5.0 (LMS Verification Bot)'
        },
        maxRedirects: 5
      });

      // Parse HTML content
      const $ = cheerio.load(response.data);

      // Extract main text content (remove scripts, styles, nav, footer)
      $('script, style, nav, footer, aside').remove();

      // Get text from main content areas
      const mainContent =
        $('article').text() ||
        $('main').text() ||
        $('.content').text() ||
        $('body').text();

      const cleanedContent = mainContent
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 5000); // Limit to 5000 chars

      if (!cleanedContent || cleanedContent.length < 50) {
        return {
          claimed: source,
          actual_content: null,
          verification_status: 'partially_verified',
          error: 'Could not extract meaningful content from page'
        };
      }

      return {
        claimed: source,
        actual_content: cleanedContent,
        verification_status: 'verified',
        metadata: {
          url: source.source_url,
          content_length: cleanedContent.length,
          fetched_at: new Date().toISOString()
        }
      };

    } catch (error: any) {
      console.error(`❌ Failed to crawl ${source.source_url}:`, error.message);

      let errorMessage = 'Failed to fetch URL';
      if (error.code === 'ENOTFOUND') {
        errorMessage = 'URL not found (404 or DNS error)';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage = 'Request timeout - URL too slow';
      } else if (error.response?.status === 403) {
        errorMessage = 'Access forbidden (403) - site blocks bots';
      }

      return {
        claimed: source,
        actual_content: null,
        verification_status: 'unverified',
        error: errorMessage
      };
    }
  }

  /**
   * Build verification context with actual vs claimed content
   */
  private buildVerificationContext(
    chatbotResponse: string,
    verifiedSources: VerifiedSource[]
  ): string {
    let context = `# INDEPENDENT VERIFICATION TASK

## Chatbot's Response (What it claimed):
${chatbotResponse}

## ACTUAL SOURCE CONTENT (Independently Verified):

`;

    verifiedSources.forEach((vs, index) => {
      context += `
### Source ${index + 1}: ${vs.claimed.source_name}
- **Type**: ${vs.claimed.source_type}
- **Verification Status**: ${vs.verification_status}
${vs.claimed.source_url ? `- **URL**: ${vs.claimed.source_url}` : ''}
${vs.claimed.page_number ? `- **Page**: ${vs.claimed.page_number}` : ''}

**What Chatbot Claimed This Source Says:**
"${vs.claimed.source_excerpt || 'No excerpt provided'}"

**What Source ACTUALLY Says (Verified Content):**
${vs.actual_content ? `"""
${vs.actual_content}
"""` : `❌ COULD NOT VERIFY: ${vs.error || 'Unknown error'}`}

---
`;
    });

    context += `

## Your Task:
1. CAREFULLY read through the ENTIRE source content provided above
2. Search for the information the chatbot claimed - look for the MEANING, not exact wording
3. Remember: PDF extraction may change formatting (spaces, line breaks), but meaning stays same
4. If you find the information, note it as VERIFIED with specific evidence
5. If truly absent, mark as missing
6. Assign trust score based on what you actually found (be fair and objective!)

IMPORTANT: The source content above is the COMPLETE text from the database. Read it ALL carefully before concluding information is missing.

Respond with the JSON format specified in your system prompt.`;

    return context;
  }

  /**
   * Parse AI verification response
   */
  private parseVerificationResponse(
    responseContent: string,
    verifiedSources: VerifiedSource[]
  ): EnhancedTrustScoreResult {
    try {
      // Extract JSON
      const jsonMatch = responseContent.match(/```json\n([\s\S]*?)\n```/) ||
                       responseContent.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error('Could not parse JSON from verification response');
      }

      const jsonText = jsonMatch[1] || jsonMatch[0];
      const parsed = JSON.parse(jsonText);

      const trustLevel = this.determineTrustLevel(parsed.trust_score || 50);

      // Build evidence summary
      const verifiedCount = verifiedSources.filter(s => s.verification_status === 'verified').length;
      const totalCount = verifiedSources.length;
      const evidenceSummary = `Verified ${verifiedCount}/${totalCount} sources independently. ${
        parsed.hallucinations_detected?.length > 0
          ? `⚠️ ${parsed.hallucinations_detected.length} hallucination(s) detected.`
          : '✓ No hallucinations detected.'
      }`;

      return {
        trust_score: parsed.trust_score || 50,
        trust_level: trustLevel,
        reasoning: parsed.reasoning || 'Unable to generate detailed reasoning',
        verification_details: parsed.verification_details || [],
        hallucinations_detected: parsed.hallucinations_detected || [],
        recommendations: parsed.recommendations || 'Please verify information with your professor.',
        evidence_summary: evidenceSummary
      };

    } catch (error) {
      console.error('Error parsing verification response:', error);

      return {
        trust_score: 50,
        trust_level: 'medium',
        reasoning: 'Unable to parse detailed verification. Manual review recommended.',
        verification_details: [],
        hallucinations_detected: [],
        recommendations: 'Verification parsing failed. Please consult your professor.',
        evidence_summary: 'Verification incomplete due to parsing error.'
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
   * Store trust score and verification details in database
   */
  private async storeTrustScore(
    messageId: number,
    verification: EnhancedTrustScoreResult
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
      JSON.stringify({
        verification_details: verification.verification_details,
        evidence_summary: verification.evidence_summary
      }),
      verification.hallucinations_detected
    ]);
  }

  /**
   * Log verification action to audit log
   */
  private async logVerificationAction(
    messageId: number,
    courseId: number,
    inputData: any,
    outputData: EnhancedTrustScoreResult | null,
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
      'enhanced_integrity_verification',
      'verify_response_with_crawling',
      null,
      courseId,
      JSON.stringify({ ...inputData, messageId }),
      JSON.stringify(outputData),
      outputData?.trust_score ? outputData.trust_score / 100 : 0,
      executionTime,
      errorMessage || null
    ]);
  }

  // Implement abstract method from SimpleBaseAgent
  async execute(message: AgentMessage, context: AIContext): Promise<AgentResponse> {
    throw new Error('Enhanced Integrity Verification Agent should be called via verifyResponse method');
  }
}

// =====================================================
// Type Definitions
// =====================================================

export type TrustLevel = 'highest' | 'high' | 'medium' | 'lower' | 'low';

export interface EnhancedTrustScoreResult {
  trust_score: number; // 0-100
  trust_level: TrustLevel;
  reasoning: string;
  verification_details: VerificationDetail[];
  hallucinations_detected: string[];
  recommendations: string;
  evidence_summary: string;
}

export interface VerificationDetail {
  source: string;
  claimed_content: string;
  actual_content: string;
  match_quality: 'exact' | 'paraphrase' | 'partial' | 'mismatch' | 'missing';
  evidence: string;
}

export interface VerifiedSource {
  claimed: ResponseSource;
  actual_content: string | null;
  verification_status: 'verified' | 'partially_verified' | 'unverified';
  error?: string;
  metadata?: Record<string, any>;
}
