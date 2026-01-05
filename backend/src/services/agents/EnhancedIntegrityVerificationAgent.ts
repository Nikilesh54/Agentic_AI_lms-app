import { SimpleBaseAgent, AgentMetadata, AgentMessage, AgentResponse, ResponseSource } from './newAgentTypes';
import { AIContext, AIMessage } from '../ai/types';
import { getAIService } from '../ai/AIServiceFactory';
import { pool } from '../../config/database';
import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';
import { retryWithBackoff } from '../../utils/retry';
import { AGENT_CONFIG } from '../../config/constants';

// File-only logging (no console output)
const LOG_PATH = path.join(__dirname, '../../../api-debug.log');
function logToFile(message: string) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_PATH, `[${timestamp}] ${message}\n`);
}

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

CRITICAL: You MUST respond with ONLY valid JSON. Do not include markdown code blocks, explanations, or any text outside the JSON object.

Output JSON format (respond with ONLY this JSON, nothing else):
{
  "trust_score": <0-100>,
  "trust_level": "<highest|high|medium|lower|low>",
  "verification_details": [
    {
      "source": "<source name>",
      "claimed_content": "<what chatbot said (keep under 200 chars)>",
      "actual_content": "<relevant excerpt from source (keep under 300 chars)>",
      "match_quality": "<exact|paraphrase|partial|mismatch|missing>",
      "evidence": "<specific proof (keep under 200 chars)>"
    }
  ],
  "hallucinations_detected": ["<list any fabricated claims>"],
  "reasoning": "<overall assessment (keep under 500 chars)>",
  "recommendations": "<advice for student (keep under 300 chars)>"
}`;
  }

  /**
   * MAIN METHOD: Independently verify a chatbot response with retry logic
   */
  async verifyResponse(
    messageId: number,
    chatbotResponse: string,
    claimedSources: ResponseSource[],
    courseId: number
  ): Promise<EnhancedTrustScoreResult> {
    const startTime = Date.now();

    try {
      logToFile(`🔍 Starting independent verification for message ${messageId}`);

      // Check cache first
      const cachedResult = await this.getCachedVerification(messageId);
      if (cachedResult) {
        logToFile('✅ Using cached verification result');
        return cachedResult;
      }

      // Step 1: INDEPENDENTLY fetch actual source content
      const verifiedSources = await this.fetchAndVerifySources(
        claimedSources,
        courseId
      );

      // Step 2: Try verification with retry strategies
      let verificationResult: EnhancedTrustScoreResult | null = null;
      const maxAttempts = 3;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          logToFile(`📝 Verification attempt ${attempt}/${maxAttempts}`);

          // Build verification context (optimized based on attempt)
          const verificationContext = this.buildVerificationContext(
            chatbotResponse,
            verifiedSources
          );

          // Adjust system prompt based on attempt
          const systemPrompt = attempt === 1
            ? this.metadata.systemPrompt
            : this.getSimplifiedSystemPrompt(attempt);

          logToFile('='.repeat(80));
          logToFile(`📤 VERIFICATION PROMPT (Attempt ${attempt}):`);
          logToFile('='.repeat(80));
          logToFile(verificationContext.substring(0, 500) + '...');
          logToFile('='.repeat(80));

          // Step 3: Use AI to compare chatbot claims vs actual content
          const messages: AIMessage[] = [
            {
              role: 'system',
              content: systemPrompt || ''
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
            systemPrompt
          );

          logToFile('='.repeat(80));
          logToFile(`📥 RAW GEMINI RESPONSE (Attempt ${attempt}):`);
          logToFile('='.repeat(80));
          logToFile(aiResponse.content.substring(0, 1000));
          logToFile('='.repeat(80));

          // Step 4: Parse verification result
          verificationResult = this.parseVerificationResponse(
            aiResponse.content,
            verifiedSources
          );

          // Success! Break retry loop
          if (verificationResult.trust_score > 0) {
            logToFile(`✅ Verification succeeded on attempt ${attempt}`);
            break;
          }

        } catch (attemptError: any) {
          logToFile(`⚠️ Attempt ${attempt} failed: ${attemptError.message}`);

          if (attempt === maxAttempts) {
            throw attemptError; // Re-throw on last attempt
          }

          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }

      // If no result after all attempts, use fallback
      if (!verificationResult) {
        logToFile('⚠️ All verification attempts failed, using fallback');
        verificationResult = this.createFallbackResult(verifiedSources);
      }

      // Step 5: Store detailed verification in database
      await this.storeTrustScore(messageId, verificationResult);

      // Cache the result
      await this.cacheVerification(messageId, verificationResult);

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

      logToFile(`✅ Verification complete: Trust Score ${verificationResult.trust_score}/100 (${executionTime}ms)`);

      return verificationResult;

    } catch (error: any) {
      logToFile('❌ Error in enhanced verification: ' + error);

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
      return this.createFallbackResult([]);
    }
  }

  /**
   * Get simplified system prompt for retry attempts
   */
  private getSimplifiedSystemPrompt(attempt: number): string {
    if (attempt === 2) {
      return `You are a verification agent. Compare the chatbot's claims against the source content provided.

Respond with ONLY this JSON (no markdown, no extra text):
{
  "trust_score": <number 0-100>,
  "trust_level": "<highest|high|medium|lower|low>",
  "verification_details": [],
  "hallucinations_detected": [],
  "reasoning": "<brief assessment>",
  "recommendations": "<brief advice>"
}`;
    }

    // Attempt 3: Absolute minimum
    return `Compare claims to sources. Respond with ONLY JSON: {"trust_score": <0-100>, "trust_level": "<level>", "verification_details": [], "hallucinations_detected": [], "reasoning": "<text>", "recommendations": "<text>"}`;
  }

  /**
   * Create fallback verification result
   */
  private createFallbackResult(verifiedSources: VerifiedSource[]): EnhancedTrustScoreResult {
    const verifiedCount = verifiedSources.filter(s => s.verification_status === 'verified').length;
    const trustScore = verifiedCount > 0 ? 60 : 30;

    return {
      trust_score: trustScore,
      trust_level: this.determineTrustLevel(trustScore),
      reasoning: `Automated verification completed with ${verifiedCount} source(s) verified. Manual review recommended for complete assurance.`,
      verification_details: [],
      hallucinations_detected: [],
      recommendations: verifiedCount > 0
        ? 'Sources were located but detailed verification is incomplete. Review the cited sources to confirm accuracy.'
        : 'Unable to verify sources. Please manually check the information or consult your professor.',
      evidence_summary: `${verifiedCount}/${verifiedSources.length} sources independently verified.`
    };
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

      logToFile(`📊 Found ${chunksResult.rows.length} chunks for material ${source.source_id}`);

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

      logToFile(`📚 Using ALL ${chunksResult.rows.length} chunks for verification (page filtering disabled due to PDF extraction limitations)`);

      const relevantChunks: string[] = chunksResult.rows.map(row => row.chunk_text);

      // Smart truncation at sentence boundaries - give verifier as much context as possible
      // Gemini can handle large contexts well
      const fullContent = relevantChunks.join('\n\n');
      const relevantContent = this.smartTruncate(
        fullContent,
        AGENT_CONFIG.VERIFICATION_MAX_CONTENT_LENGTH
      );

      logToFile(`📝 Final content length: ${relevantContent.length} chars, ${relevantChunks.length} chunks used`);
      logToFile(`📄 Content preview: ${relevantContent.substring(0, 200)}...`);

      // DEBUG: Check if key statistics are present in the fetched content
      logToFile('🔍 VERIFICATION DEBUG - Content checks:');
      logToFile(`   - Contains "37%": ${relevantContent.includes('37%')}`);
      logToFile(`   - Contains "95%": ${relevantContent.includes('95%')}`);
      logToFile(`   - Contains "bullied": ${relevantContent.toLowerCase().includes('bullied')}`);
      logToFile(`   - Contains "2019": ${relevantContent.includes('2019')}`);

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
      logToFile('Error verifying course material: ' + error);
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
      logToFile(`🌐 Crawling: ${source.source_url}`);

      // Type guard: ensure source_url is not null
      const url = source.source_url;
      if (!url) {
        throw new Error('Source URL is null');
      }

      // Fetch the web page with retry logic
      const response = await retryWithBackoff(
        async () => await axios.get(url, {
          timeout: AGENT_CONFIG.WEB_CRAWL_TIMEOUT_MS,
          headers: {
            'User-Agent': 'Mozilla/5.0 (LMS Verification Bot)'
          },
          maxRedirects: 5
        }),
        {
          maxRetries: 2, // Limited retries for web crawling
          onRetry: (error, attempt) => {
            logToFile(`🔄 Retrying crawl (attempt ${attempt}): ${url}`);
          }
        }
      );

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
        .substring(0, AGENT_CONFIG.WEB_CONTENT_MAX_LENGTH);

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
      logToFile(`❌ Failed to crawl ${source.source_url}: ${error.message}`);

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
   * Optimized to reduce token usage while maintaining accuracy
   */
  private buildVerificationContext(
    chatbotResponse: string,
    verifiedSources: VerifiedSource[]
  ): string {
    // Extract key claims from chatbot response (reduce verbosity)
    const keyClaims = this.extractKeyClaims(chatbotResponse);

    let context = `VERIFICATION TASK

Chatbot Claims:
${keyClaims}

Sources to Verify:
`;

    verifiedSources.forEach((vs, index) => {
      // Truncate actual content to relevant portions around key search terms
      const relevantContent = this.extractRelevantContent(
        vs.actual_content ?? '',
        chatbotResponse,
        1500 // Max chars per source
      );

      context += `
${index + 1}. ${vs.claimed.source_name}
   Status: ${vs.verification_status}
   ${vs.claimed.page_number ? `Page: ${vs.claimed.page_number}` : ''}

   Content: ${relevantContent || `ERROR: ${vs.error || 'Could not verify'}`}

`;
    });

    context += `
Task: Verify each claim against source content. Respond with ONLY the JSON object (no markdown, no extra text).`;

    return context;
  }

  /**
   * Extract key factual claims from chatbot response
   */
  private extractKeyClaims(response: string): string {
    // Extract sentences with numbers, percentages, or specific facts
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const keyClaims: string[] = [];

    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      // Keep sentences with numbers, percentages, dates, or citations
      if (
        /\d+/.test(trimmed) ||
        /%/.test(trimmed) ||
        /\[Source:/i.test(trimmed) ||
        /(according to|based on|shows that|indicates)/i.test(trimmed)
      ) {
        keyClaims.push(trimmed);
      }
    }

    // If no specific claims found, use first 500 chars
    if (keyClaims.length === 0) {
      return response.substring(0, 500) + (response.length > 500 ? '...' : '');
    }

    return keyClaims.join('. ') + '.';
  }

  /**
   * Extract most relevant portions of content based on search terms
   */
  private extractRelevantContent(
    content: string,
    query: string,
    maxLength: number
  ): string {
    if (!content || content.length === 0) {
      return '';
    }

    // Extract numbers and key terms from query
    const numbers = query.match(/\d+%?/g) || [];
    const keyTerms = query
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 4 && !['about', 'according', 'based'].includes(w))
      .slice(0, 5);

    const searchTerms = [...numbers, ...keyTerms];

    if (searchTerms.length === 0) {
      return this.smartTruncate(content, maxLength);
    }

    // Find positions of search terms
    const positions: number[] = [];
    const contentLower = content.toLowerCase();

    for (const term of searchTerms) {
      let pos = contentLower.indexOf(term.toLowerCase());
      while (pos !== -1) {
        positions.push(pos);
        pos = contentLower.indexOf(term.toLowerCase(), pos + 1);
      }
    }

    if (positions.length === 0) {
      return this.smartTruncate(content, maxLength);
    }

    // Sort positions and extract context around matches
    positions.sort((a, b) => a - b);
    const chunks: string[] = [];
    let totalLength = 0;

    for (const pos of positions) {
      if (totalLength >= maxLength) break;

      // Extract context (200 chars before and after)
      const start = Math.max(0, pos - 200);
      const end = Math.min(content.length, pos + 200);
      const chunk = content.substring(start, end);

      // Avoid duplicates
      if (!chunks.some(c => c.includes(chunk.substring(10, 30)))) {
        chunks.push((start > 0 ? '...' : '') + chunk + (end < content.length ? '...' : ''));
        totalLength += chunk.length;
      }
    }

    return chunks.join(' ');
  }

  /**
   * Parse AI verification response with robust error handling and fallback strategies
   */
  private parseVerificationResponse(
    responseContent: string,
    verifiedSources: VerifiedSource[]
  ): EnhancedTrustScoreResult {
    logToFile('🔄 Starting robust JSON parsing...');

    // Strategy 1: Try direct JSON parse (Gemini returning pure JSON)
    try {
      const result = this.tryDirectJsonParse(responseContent, verifiedSources);
      if (result) {
        logToFile('✅ Strategy 1 (Direct JSON) succeeded');
        return result;
      }
    } catch (error) {
      logToFile(`⚠️ Strategy 1 failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Strategy 2: Extract JSON from markdown code blocks
    try {
      const result = this.tryMarkdownJsonExtraction(responseContent, verifiedSources);
      if (result) {
        logToFile('✅ Strategy 2 (Markdown extraction) succeeded');
        return result;
      }
    } catch (error) {
      logToFile(`⚠️ Strategy 2 failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Strategy 3: Find and extract any JSON object in the response
    try {
      const result = this.tryFuzzyJsonExtraction(responseContent, verifiedSources);
      if (result) {
        logToFile('✅ Strategy 3 (Fuzzy extraction) succeeded');
        return result;
      }
    } catch (error) {
      logToFile(`⚠️ Strategy 3 failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Strategy 4: Try to extract trust_score even if full JSON fails
    try {
      const partialResult = this.tryPartialExtraction(responseContent, verifiedSources);
      if (partialResult) {
        logToFile('✅ Strategy 4 (Partial extraction) succeeded');
        return partialResult;
      }
    } catch (error) {
      logToFile(`⚠️ Strategy 4 failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Strategy 5: Heuristic analysis as last resort
    logToFile('⚠️ All parsing strategies failed, using heuristic analysis');
    return this.heuristicAnalysis(responseContent, verifiedSources);
  }

  /**
   * Strategy 1: Try to parse response as pure JSON
   */
  private tryDirectJsonParse(
    content: string,
    verifiedSources: VerifiedSource[]
  ): EnhancedTrustScoreResult | null {
    try {
      const trimmed = content.trim();
      if (!trimmed.startsWith('{')) {
        return null;
      }

      const parsed = JSON.parse(trimmed);
      return this.buildTrustScoreResult(parsed, verifiedSources);
    } catch (error) {
      return null;
    }
  }

  /**
   * Strategy 2: Extract JSON from markdown code blocks
   */
  private tryMarkdownJsonExtraction(
    content: string,
    verifiedSources: VerifiedSource[]
  ): EnhancedTrustScoreResult | null {
    // Try different markdown patterns
    const patterns = [
      /```json\s*\n([\s\S]*?)\n```/,
      /```\s*\n([\s\S]*?)\n```/,
      /```json([\s\S]*?)```/,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        try {
          const jsonText = match[1].trim();
          const parsed = JSON.parse(jsonText);
          return this.buildTrustScoreResult(parsed, verifiedSources);
        } catch (error) {
          continue;
        }
      }
    }

    return null;
  }

  /**
   * Strategy 3: Fuzzy extraction - find any JSON object
   */
  private tryFuzzyJsonExtraction(
    content: string,
    verifiedSources: VerifiedSource[]
  ): EnhancedTrustScoreResult | null {
    // Find the first { and try to extract a complete JSON object
    const startIdx = content.indexOf('{');
    if (startIdx === -1) {
      return null;
    }

    // Try to find matching closing brace
    let braceCount = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = startIdx; i < content.length; i++) {
      const char = content[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\') {
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === '{') {
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          // Found complete JSON object
          const jsonText = content.substring(startIdx, i + 1);
          try {
            const parsed = JSON.parse(jsonText);
            return this.buildTrustScoreResult(parsed, verifiedSources);
          } catch (error) {
            return null;
          }
        }
      }
    }

    return null;
  }

  /**
   * Strategy 4: Extract partial information even if JSON is incomplete
   */
  private tryPartialExtraction(
    content: string,
    verifiedSources: VerifiedSource[]
  ): EnhancedTrustScoreResult | null {
    try {
      // Try to extract key fields using regex
      const trustScoreMatch = content.match(/"trust_score"\s*:\s*(\d+)/);
      const trustLevelMatch = content.match(/"trust_level"\s*:\s*"([^"]+)"/);
      const reasoningMatch = content.match(/"reasoning"\s*:\s*"([^"]+)"/);

      if (trustScoreMatch) {
        const trustScore = parseInt(trustScoreMatch[1]);
        const trustLevel = trustLevelMatch ? trustLevelMatch[1] : this.determineTrustLevel(trustScore);
        const reasoning = reasoningMatch ? reasoningMatch[1] : 'Partial verification completed (JSON parsing incomplete)';

        logToFile(`Partial extraction: score=${trustScore}, level=${trustLevel}`);

        return {
          trust_score: trustScore,
          trust_level: trustLevel as TrustLevel,
          reasoning,
          verification_details: [],
          hallucinations_detected: [],
          recommendations: 'Partial verification completed. Please review sources manually for complete verification.',
          evidence_summary: this.buildEvidenceSummary(verifiedSources, [])
        };
      }
    } catch (error) {
      logToFile(`Partial extraction error: ${error}`);
    }

    return null;
  }

  /**
   * Strategy 5: Heuristic analysis when JSON parsing completely fails
   */
  private heuristicAnalysis(
    content: string,
    verifiedSources: VerifiedSource[]
  ): EnhancedTrustScoreResult {
    logToFile('Running heuristic analysis on response content');

    const contentLower = content.toLowerCase();

    // Look for positive indicators
    const positiveIndicators = [
      'verified', 'confirmed', 'accurate', 'correct', 'found in source',
      'matches', 'consistent', 'present in', 'located in'
    ];

    // Look for negative indicators
    const negativeIndicators = [
      'not found', 'missing', 'absent', 'incorrect', 'fabricated',
      'hallucination', 'discrepancy', 'contradiction', 'mismatch'
    ];

    let positiveCount = 0;
    let negativeCount = 0;

    for (const indicator of positiveIndicators) {
      if (contentLower.includes(indicator)) {
        positiveCount++;
      }
    }

    for (const indicator of negativeIndicators) {
      if (contentLower.includes(indicator)) {
        negativeCount++;
      }
    }

    // Calculate heuristic trust score
    let trustScore = 50; // Start neutral

    if (positiveCount > negativeCount) {
      trustScore = Math.min(90, 50 + (positiveCount - negativeCount) * 10);
    } else if (negativeCount > positiveCount) {
      trustScore = Math.max(20, 50 - (negativeCount - positiveCount) * 10);
    }

    const verifiedCount = verifiedSources.filter(s => s.verification_status === 'verified').length;
    if (verifiedCount === 0) {
      trustScore = Math.min(trustScore, 40);
    }

    logToFile(`Heuristic analysis: positive=${positiveCount}, negative=${negativeCount}, score=${trustScore}`);

    return {
      trust_score: trustScore,
      trust_level: this.determineTrustLevel(trustScore),
      reasoning: `Automated heuristic analysis (JSON parsing failed). Positive indicators: ${positiveCount}, Negative indicators: ${negativeCount}. Manual review recommended.`,
      verification_details: [],
      hallucinations_detected: [],
      recommendations: 'Verification system encountered parsing issues. Please manually verify the information with course materials or consult your professor.',
      evidence_summary: `Heuristic analysis based on ${verifiedCount}/${verifiedSources.length} verified sources.`
    };
  }

  /**
   * Build trust score result from parsed JSON
   */
  private buildTrustScoreResult(
    parsed: any,
    verifiedSources: VerifiedSource[]
  ): EnhancedTrustScoreResult {
    const trustScore = typeof parsed.trust_score === 'number' ? parsed.trust_score : 50;
    const trustLevel = parsed.trust_level || this.determineTrustLevel(trustScore);

    return {
      trust_score: trustScore,
      trust_level: trustLevel as TrustLevel,
      reasoning: parsed.reasoning || 'Verification completed',
      verification_details: Array.isArray(parsed.verification_details) ? parsed.verification_details : [],
      hallucinations_detected: Array.isArray(parsed.hallucinations_detected) ? parsed.hallucinations_detected : [],
      recommendations: parsed.recommendations || 'Please review the sources and verification details.',
      evidence_summary: this.buildEvidenceSummary(
        verifiedSources,
        parsed.hallucinations_detected || []
      )
    };
  }

  /**
   * Build evidence summary string
   */
  private buildEvidenceSummary(
    verifiedSources: VerifiedSource[],
    hallucinations: string[]
  ): string {
    const verifiedCount = verifiedSources.filter(s => s.verification_status === 'verified').length;
    const totalCount = verifiedSources.length;

    return `Verified ${verifiedCount}/${totalCount} sources independently. ${
      hallucinations.length > 0
        ? `⚠️ ${hallucinations.length} hallucination(s) detected.`
        : '✓ No hallucinations detected.'
    }`;
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

  /**
   * Smart truncation at sentence boundaries to avoid cutting off mid-sentence
   * @param content - Content to truncate
   * @param maxLength - Maximum length in characters
   * @returns Truncated content
   */
  private smartTruncate(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }

    // Truncate at maxLength
    let truncated = content.substring(0, maxLength);

    // Find the last sentence boundary (., !, ?, or newline)
    const sentenceBoundaries = ['. ', '! ', '? ', '\n'];
    let lastBoundary = -1;

    for (const boundary of sentenceBoundaries) {
      const index = truncated.lastIndexOf(boundary);
      if (index > lastBoundary) {
        lastBoundary = index;
      }
    }

    // If we found a sentence boundary in the last 20% of the content, truncate there
    if (lastBoundary > maxLength * 0.8) {
      truncated = truncated.substring(0, lastBoundary + 1);
    }

    // Add indicator that content was truncated
    if (content.length > truncated.length) {
      truncated += '\n\n[Content truncated for length. Full document contains more information.]';
    }

    return truncated;
  }

  /**
   * Get cached verification result
   */
  private async getCachedVerification(messageId: number): Promise<EnhancedTrustScoreResult | null> {
    try {
      const result = await pool.query(
        'SELECT * FROM message_trust_scores WHERE message_id = $1',
        [messageId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];

      // Parse stored details
      const details = row.source_verification_details
        ? JSON.parse(row.source_verification_details)
        : { verification_details: [], evidence_summary: '' };

      return {
        trust_score: row.trust_score,
        trust_level: row.trust_level,
        reasoning: row.verification_reasoning,
        verification_details: details.verification_details || [],
        hallucinations_detected: row.conflicts_detected || [],
        recommendations: 'Cached verification result',
        evidence_summary: details.evidence_summary || 'Cached result'
      };
    } catch (error) {
      logToFile(`Cache lookup error: ${error}`);
      return null;
    }
  }

  /**
   * Cache verification result
   */
  private async cacheVerification(
    messageId: number,
    result: EnhancedTrustScoreResult
  ): Promise<void> {
    try {
      // The result is already stored in the database by storeTrustScore
      // This method is a placeholder for future Redis/in-memory caching
      logToFile(`Cached verification result for message ${messageId}`);
    } catch (error) {
      logToFile(`Cache storage error: ${error}`);
    }
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
