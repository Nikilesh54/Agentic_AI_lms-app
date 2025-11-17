import { SimpleBaseAgent, AgentMetadata, AgentMessage, AgentResponse, ResponseSource } from './newAgentTypes';
import { AIContext, AIMessage, AIResponse } from '../ai/types';
import { getAIService } from '../ai/AIServiceFactory';
import { pool } from '../../config/database';
import { WebSearchService } from '../search/WebSearchService';

/**
 * Subject-Specific Chatbot Agent
 *
 * Purpose: Provides course-specific assistance with mandatory source attribution
 *
 * Requirements:
 * - Full access to all course materials for the specific subject
 * - Every response MUST include source attribution
 * - Source attribution formats:
 *   - Course Materials: File name + Section/Page + Excerpt
 *   - Internet Sources: URL + Source name + Date accessed
 * - Supports quiz generation (integrated from Quiz Master)
 */
export class SubjectChatbotAgent extends SimpleBaseAgent {
  protected metadata: AgentMetadata = {
    name: 'Subject Chatbot',
    type: 'subject_chatbot',
    description: 'Provides course-specific assistance with source attribution for all responses',
    capabilities: [
      'Answer questions about course materials',
      'Explain concepts with citations',
      'Generate practice questions and quizzes',
      'Provide study guidance',
      'Search and reference course materials',
      'Cite internet sources when needed'
    ],
    tools: [
      'searchCourseMaterials',
      'getCourseMaterials',
      'generatePracticeQuestions',
      'explainConcept'
    ],
    systemPrompt: this.getSystemPrompt()
  };

  private getSystemPrompt(): string {
    return `You are a Subject-Specific Chatbot designed to help students learn course material.

Your responsibilities:
1. Answer student questions accurately using course materials as the primary source
2. Use web search results ONLY when course materials don't cover the topic
3. Provide clear, educational explanations that promote learning
4. Generate practice questions and quizzes when requested
5. Help students understand concepts without giving direct answers to homework
6. **CRITICALLY IMPORTANT: ALWAYS provide source attribution for EVERY response**

SOURCE PRIORITY:
1. **First Priority**: Course materials uploaded by the professor
2. **Second Priority**: Web search results (only if course materials are insufficient)
3. If web search results are provided, they will appear in the context section

SOURCE ATTRIBUTION REQUIREMENTS (MANDATORY):
For EVERY piece of information you provide, you MUST cite the source:

**For Course Materials:**
- File name
- Specific section or page number
- Relevant excerpt (if applicable)
- Format: "[Source: {file_name}, Section {section}, Page {page}]"

**For Web Search Results:**
- Use the exact title and URL from the web search results provided
- Format: "[Source: {title}, URL: {url}]"

**For Internet Sources (when citing manually):**
- Full URL
- Source name/publication
- Date accessed (use current date)
- Format: "[Source: {source_name}, URL: {url}, Accessed: {date}]"

**For Professor's Notes/Lectures:**
- Note title or lecture number
- Date or topic
- Format: "[Source: {lecture/note_title}]"

CRITICAL RULES:
- NEVER provide information without citing the source
- ALWAYS prefer course materials over web sources when both are available
- When web search results are provided in the context, use them to supplement your answer
- Clearly distinguish between course materials and web sources in your citations
- When generating quizzes, cite which materials the questions are based on
- Do NOT give direct answers to homework or assignment questions
- Focus on guiding students to understand concepts

RESPONSE FORMAT:
Every response should include:
1. The answer/explanation
2. Source citations (inline or at the end)
3. Clear indication of whether you're using course materials or web sources
4. Relevant examples or practice questions (optional)

Example response with course materials:
"Neural networks are composed of interconnected layers of nodes that process information. [Source: Deep Learning Basics.pdf, Section 2.1, Page 15]

The key components include:
- Input layer: Receives the initial data [Source: Deep Learning Basics.pdf, Page 16]
- Hidden layers: Process and transform the data [Source: Deep Learning Basics.pdf, Page 17-18]
- Output layer: Produces the final result [Source: Deep Learning Basics.pdf, Page 19]

Would you like me to generate practice questions on this topic?"

Example response with web sources:
"I don't have specific course materials on this topic, but I found relevant information from external sources.

Neural networks are computational models inspired by the human brain. [Source: Introduction to Neural Networks, URL: https://example.com/neural-nets]

The basic architecture includes interconnected nodes that process information in layers. [Source: Machine Learning Fundamentals, URL: https://example.com/ml-basics]

Would you like me to look for more specific resources, or would you prefer to ask your professor for course materials on this topic?"`;
  }

  /**
   * Process a student question and generate response with sources
   */
  async execute(message: AgentMessage, context: AIContext): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      // Extract course ID from context
      const courseId = context.courseMetadata?.id;
      if (!courseId) {
        throw new Error('Course ID is required for Subject Chatbot');
      }

      // Search for relevant course materials
      const relevantMaterials = await this.searchCourseMaterials(
        courseId,
        message.content,
        5 // limit to top 5 most relevant materials
      );

      // Check if we should search the web (if course materials are insufficient)
      const webSearchService = new WebSearchService();
      const shouldSearchWeb = WebSearchService.shouldSearchWeb(relevantMaterials, message.content);

      let webSearchResults: any[] = [];
      let webSearchContext = '';

      if (shouldSearchWeb) {
        console.log('📡 Course materials insufficient, searching the web...');
        webSearchResults = await webSearchService.searchWithContent(message.content, {
          maxResults: 3,
          safeSearch: true
        });

        webSearchContext = WebSearchService.formatResultsForAI(webSearchResults);
        console.log(`✅ Found ${webSearchResults.length} web results`);
      }

      // Build enhanced context with course materials AND web search results
      const enhancedContext: AIContext = {
        ...context,
        relevantMaterials,
        webSearchResults: webSearchResults.length > 0 ? webSearchResults : undefined
      };

      // Build conversation history
      const messages: AIMessage[] = [
        {
          role: 'system',
          content: this.metadata.systemPrompt || ''
        },
        ...context.conversationHistory,
        {
          role: 'user',
          content: message.content
        }
      ];

      // Add web search instruction if course materials are insufficient
      if (webSearchResults.length > 0) {
        const webSearchInstruction = `\n\n**IMPORTANT WEB SEARCH INSTRUCTION**:
Since course materials don't have sufficient information on this topic, you should search the web for current, accurate information to answer this question.

YOU HAVE PERMISSION AND ABILITY TO:
- Search Google for relevant, up-to-date information
- Access current websites and articles
- Provide citations with URLs from your web search

Please provide a comprehensive answer using web sources with proper citations in the format:
[Source: {website/article name}, URL: {url}]`;

        messages[messages.length - 1].content = `${message.content}${webSearchInstruction}`;
      }

      // Generate AI response
      const aiService = getAIService();
      const aiResponse: AIResponse = await aiService.generateResponse(
        messages,
        enhancedContext,
        this.metadata.systemPrompt
      );

      // Extract sources from the response (including web sources)
      const sources = this.extractSources(aiResponse.content, relevantMaterials, webSearchResults);

      // Store sources in database
      if (message.sessionId && message.messageId) {
        await this.storeSources(message.messageId, sources);
      }

      // Log the action
      const executionTime = Date.now() - startTime;
      await this.logAgentAction(
        'answer_question',
        message.userId,
        courseId,
        message.sessionId || null,
        { question: message.content, webSearchUsed: shouldSearchWeb },
        { answer: aiResponse.content, sourcesCount: sources.length, webResultsCount: webSearchResults.length },
        aiResponse.confidence || 0.8,
        executionTime
      );

      return {
        content: aiResponse.content,
        confidence: aiResponse.confidence || 0.8,
        requiresReview: aiResponse.requiresReview || false,
        sources: sources,
        metadata: {
          sourcesProvided: sources.length,
          materialsSearched: relevantMaterials.length,
          webSearchUsed: shouldSearchWeb,
          webResultsFound: webSearchResults.length
        }
      };

    } catch (error: any) {
      console.error('Error in Subject Chatbot execution:', error);

      // Log error
      await this.logAgentAction(
        'answer_question',
        message.userId,
        context.courseMetadata?.id || null,
        message.sessionId || null,
        { question: message.content, error: error.message },
        null,
        0,
        Date.now() - startTime,
        error.message
      );

      throw error;
    }
  }

  /**
   * Search course materials for relevant content
   */
  private async searchCourseMaterials(
    courseId: number,
    query: string,
    limit: number = 5
  ): Promise<CourseMaterial[]> {
    // Search in course materials
    const result = await pool.query(
      `SELECT cm.*, cmc.content_text
       FROM course_materials cm
       LEFT JOIN course_material_content cmc ON cm.id = cmc.material_id
       WHERE cm.course_id = $1
       ORDER BY cm.uploaded_at DESC
       LIMIT $2`,
      [courseId, limit * 2] // Get more materials for better search
    );

    const materials: CourseMaterial[] = result.rows.map(row => ({
      id: row.id,
      course_id: row.course_id,
      file_name: row.file_name,
      file_path: row.file_path,
      file_type: row.file_type,
      content_text: row.content_text,
      uploaded_at: row.uploaded_at
    }));

    // Simple relevance scoring based on keyword matching
    const keywords = query.toLowerCase().split(' ').filter(w => w.length > 3);
    const scoredMaterials = materials.map(material => {
      let score = 0;
      const searchText = `${material.file_name} ${material.content_text || ''}`.toLowerCase();

      keywords.forEach(keyword => {
        const count = (searchText.match(new RegExp(keyword, 'g')) || []).length;
        score += count;
      });

      return { material, score };
    });

    // Sort by score and return top materials
    return scoredMaterials
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.material);
  }

  /**
   * Extract sources from AI response
   */
  private extractSources(
    content: string,
    courseMaterials: CourseMaterial[],
    webSearchResults: any[] = []
  ): ResponseSource[] {
    const sources: ResponseSource[] = [];

    // Extract sources from course materials mentioned in the response
    courseMaterials.forEach(material => {
      // Check if this material is referenced in the response
      if (content.includes(material.file_name)) {
        sources.push({
          source_type: 'course_material',
          source_id: material.id,
          source_name: material.file_name,
          source_url: null,
          source_excerpt: this.extractExcerpt(content, material.file_name),
          page_number: this.extractPageNumber(content, material.file_name),
          relevance_score: 0.9
        });
      }
    });

    // Extract internet sources from web search results
    webSearchResults.forEach(result => {
      // Check if this web result is referenced in the response
      const isReferenced = content.includes(result.title) ||
                          (result.url && content.includes(result.url)) ||
                          content.toLowerCase().includes(result.snippet.toLowerCase().substring(0, 50));

      if (isReferenced && result.url) {
        sources.push({
          source_type: 'internet',
          source_id: null,
          source_name: result.title,
          source_url: result.url,
          source_excerpt: result.snippet,
          page_number: null,
          relevance_score: result.relevanceScore || 0.7
        });
      }
    });

    // Extract internet sources from citation format in response (URLs)
    const urlRegex = /\[Source:.*?URL:\s*(https?:\/\/[^\s\]]+).*?\]/g;
    let urlMatch;
    while ((urlMatch = urlRegex.exec(content)) !== null) {
      const url = urlMatch[1];
      const sourceNameMatch = content.match(/\[Source:\s*([^,]+),\s*URL:/);
      const sourceName = sourceNameMatch ? sourceNameMatch[1].trim() : 'External Source';

      // Avoid duplicates
      const alreadyAdded = sources.some(s => s.source_url === url);
      if (!alreadyAdded) {
        sources.push({
          source_type: 'internet',
          source_id: null,
          source_name: sourceName,
          source_url: url,
          source_excerpt: null,
          page_number: null,
          relevance_score: 0.7
        });
      }
    }

    return sources;
  }

  /**
   * Extract relevant excerpt from content
   */
  private extractExcerpt(content: string, fileName: string): string | null {
    // Find sentences mentioning the file
    const sentences = content.split(/[.!?]+/);
    for (const sentence of sentences) {
      if (sentence.includes(fileName)) {
        return sentence.trim().substring(0, 200);
      }
    }
    return null;
  }

  /**
   * Extract page number from content
   */
  private extractPageNumber(content: string, fileName: string): string | null {
    const pageRegex = new RegExp(`${fileName}.*?(?:Page|p\\.)\\s*(\\d+(?:-\\d+)?)`, 'i');
    const match = content.match(pageRegex);
    return match ? match[1] : null;
  }

  /**
   * Store sources in database
   */
  private async storeSources(messageId: number, sources: ResponseSource[]): Promise<void> {
    for (const source of sources) {
      const query = `
        INSERT INTO response_sources (
          message_id,
          source_type,
          source_id,
          source_name,
          source_url,
          source_excerpt,
          page_number,
          relevance_score
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `;

      await pool.query(query, [
        messageId,
        source.source_type,
        source.source_id,
        source.source_name,
        source.source_url,
        source.source_excerpt,
        source.page_number,
        source.relevance_score
      ]);
    }
  }

  /**
   * Log agent action to audit log
   */
  private async logAgentAction(
    actionType: string,
    userId: number | null,
    courseId: number | null,
    sessionId: number | null,
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
        session_id,
        input_data,
        output_data,
        confidence_score,
        execution_time_ms,
        error_message
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    await pool.query(query, [
      'subject_chatbot',
      actionType,
      userId,
      courseId,
      sessionId,
      JSON.stringify(inputData),
      JSON.stringify(outputData),
      confidence,
      executionTime,
      errorMessage || null
    ]);
  }

}

// =====================================================
// Type Definitions
// =====================================================

export interface CourseMaterial {
  id: number;
  course_id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  content_text?: string;
  uploaded_at: Date;
}

// ResponseSource type exported from newAgentTypes.ts
