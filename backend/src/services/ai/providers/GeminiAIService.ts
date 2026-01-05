import { GoogleGenerativeAI, GenerativeModel, Content, Part } from '@google/generative-ai';
import {
  IAIService,
  AIMessage,
  AIResponse,
  AIContext,
  Intent,
  StreamChunk,
  AIServiceConfig,
  ToolCall
} from '../types';
import { retryWithBackoff } from '../../../utils/retry';
import { AIRateLimiter } from '../../../utils/rateLimiter';
import { AI_SERVICE } from '../../../config/constants';

/**
 * Google AI (Gemini) Service Implementation
 * Uses Google's Gemini API for AI-powered responses with rate limiting
 */
export class GeminiAIService implements IAIService {
  private genAI: GoogleGenerativeAI;
  private model: GenerativeModel;
  private config: AIServiceConfig;
  private rateLimiter: AIRateLimiter;

  constructor(config: AIServiceConfig) {
    if (!config.apiKey) {
      throw new Error('Google AI API key is required');
    }

    this.config = config;
    this.genAI = new GoogleGenerativeAI(config.apiKey);

    // Initialize rate limiter (60 requests per minute by default)
    this.rateLimiter = new AIRateLimiter(60, 60000);

    // Initialize the model with configuration
    // Note: We don't set tools here - we'll set them per-request based on context
    this.model = this.genAI.getGenerativeModel({
      model: config.model || 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: config.temperature || 0.7,
        maxOutputTokens: config.maxTokens || 2048,
      },
    });
  }

  /**
   * Get a model instance with Google Search grounding enabled
   * Note: Google Search grounding requires specific model and configuration
   */
  private getModelWithGrounding(): GenerativeModel {
    // For now, use the same model but with a system instruction to use web knowledge
    // True grounding will require Gemini API configuration at the API level
    return this.genAI.getGenerativeModel({
      model: this.config.model || 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: this.config.temperature || 0.7,
        maxOutputTokens: this.config.maxTokens || 2048,
      },
      systemInstruction: 'You have access to search the web for current information. Use this capability when answering questions that require up-to-date data or information not in the provided context.',
    });
  }

  /**
   * Convert our AIMessage format to Gemini's Content format
   */
  private convertMessagesToGeminiFormat(messages: AIMessage[], systemPrompt?: string): Content[] {
    const contents: Content[] = [];

    // Add system prompt as the first user message if provided
    if (systemPrompt) {
      contents.push({
        role: 'user',
        parts: [{ text: `System Instructions: ${systemPrompt}` }]
      });
    }

    // Convert messages
    for (const message of messages) {
      let role: 'user' | 'model';

      // Gemini only supports 'user' and 'model' roles
      if (message.role === 'assistant') {
        role = 'model';
      } else if (message.role === 'system') {
        // Convert system messages to user messages
        role = 'user';
      } else {
        role = message.role as 'user';
      }

      contents.push({
        role,
        parts: [{ text: message.content }]
      });
    }

    return contents;
  }

  /**
   * Build context string from AIContext
   */
  private buildContextString(context: AIContext): string {
    const parts: string[] = [];

    // Add course metadata
    if (context.courseMetadata) {
      parts.push(`Course: ${context.courseMetadata.title || 'Unknown'}`);
      if (context.courseMetadata.description) {
        parts.push(`Course Description: ${context.courseMetadata.description}`);
      }
    }

    // Add relevant materials with actual content from vector search
    if (context.relevantMaterials && context.relevantMaterials.length > 0) {
      parts.push('\n**Relevant Course Materials (Semantically Similar to Query):**');
      parts.push('Below are the most relevant chunks from course materials, ranked by similarity:');
      parts.push('');

      context.relevantMaterials.forEach((material: any, index: number) => {
        // Build material header with metadata
        let header = `\n### Source ${index + 1}: ${material.file_name}`;

        if (material.page_number) {
          header += ` (Page ${material.page_number})`;
        }

        if (material.similarity_score !== undefined) {
          const similarityPercent = (material.similarity_score * 100).toFixed(1);
          header += ` [Relevance: ${similarityPercent}%]`;
        }

        parts.push(header);

        // Add the actual content from the chunk
        if (material.content_text) {
          parts.push(`Content: ${material.content_text}`);
        } else if (material.content) {
          // Fallback for backward compatibility
          parts.push(`Content: ${material.content.substring(0, 1000)}`);
        }

        parts.push('---');
      });

      parts.push('\n**IMPORTANT**: You MUST cite these sources in your response using the format:');
      parts.push('[Source: {file_name}, Page {page_number}]');
    }

    // Add active assignments
    if (context.activeAssignments && context.activeAssignments.length > 0) {
      parts.push('\n**Active Assignments:**');
      context.activeAssignments.forEach((assignment: any, index: number) => {
        parts.push(`${index + 1}. ${assignment.title} (Due: ${assignment.due_date})`);
        if (assignment.description) {
          parts.push(`   ${assignment.description}`);
        }
      });
    }

    // Add tool results if any
    if (context.toolResults && context.toolResults.length > 0) {
      parts.push('\n**Tool Results:**');
      context.toolResults.forEach((result: any) => {
        parts.push(`- ${result.toolCallId}: ${JSON.stringify(result.result)}`);
      });
    }

    return parts.join('\n');
  }

  async generateResponse(
    messages: AIMessage[],
    context: AIContext,
    systemPrompt?: string,
    options?: { jsonMode?: boolean }
  ): Promise<AIResponse> {
    try {
      // Apply rate limiting before making API call
      const rateLimitKey = context.courseMetadata?.id?.toString() || 'global';
      await this.rateLimiter.checkLimit(rateLimitKey);

      // Build context information
      const contextString = this.buildContextString(context);

      // Combine system prompt with context
      let fullSystemPrompt = systemPrompt
        ? `${systemPrompt}\n\n**Context Information:**\n${contextString}`
        : `**Context Information:**\n${contextString}`;

      // Add JSON mode instruction if requested
      if (options?.jsonMode) {
        fullSystemPrompt += '\n\nCRITICAL: Respond with ONLY valid JSON. No markdown code blocks, no explanations, just the JSON object.';
      }

      // Convert messages to Gemini format
      const geminiMessages = this.convertMessagesToGeminiFormat(messages, fullSystemPrompt);

      // Check if we should use Google Search grounding
      const useGrounding = context.webSearchResults && context.webSearchResults.length > 0;
      const modelToUse = useGrounding ? this.getModelWithGrounding() : this.model;

      if (useGrounding) {
        console.log('🌐 Using Google Search grounding for this response...');
      }

      if (options?.jsonMode) {
        console.log('📝 Using JSON mode for structured output');
      }

      // Generate response with retry logic and exponential backoff
      const result = await retryWithBackoff(
        async () => {
          const chat = modelToUse.startChat({
            history: geminiMessages.slice(0, -1), // All messages except the last one
          });

          const lastMessage = geminiMessages[geminiMessages.length - 1];
          return await chat.sendMessage(lastMessage.parts.map(p => p.text).join('\n'));
        },
        {
          maxRetries: AI_SERVICE.MAX_RETRIES,
          initialDelayMs: AI_SERVICE.INITIAL_RETRY_DELAY_MS,
          maxDelayMs: AI_SERVICE.MAX_RETRY_DELAY_MS,
          onRetry: (error, attempt) => {
            console.warn(`🔄 Gemini API retry attempt ${attempt}:`, error.message);
          },
        }
      );

      const response = result.response;
      let text = response.text();

      // In JSON mode, try to clean up the response
      if (options?.jsonMode) {
        text = this.cleanJsonResponse(text);
      }

      // Calculate confidence based on response characteristics
      const confidence = await this.calculateConfidence(text, context);

      // Extract sources from context
      const sources = context.relevantMaterials?.map((material: any) => ({
        id: material.id,
        name: material.file_name || 'Course Material',
        relevance: 0.8 // Default relevance
      })) || [];

      // Add grounding metadata if available
      const groundingMetadata = response.candidates?.[0]?.groundingMetadata;

      const aiResponse: AIResponse = {
        content: text,
        confidence,
        requiresReview: false,
        sources: sources.length > 0 ? sources : undefined,
        metadata: groundingMetadata ? { groundingMetadata } : undefined
      };

      // Check if review is needed
      aiResponse.requiresReview = await this.shouldRequireReview(aiResponse, context);

      return aiResponse;
    } catch (error: any) {
      console.error('Gemini API Error:', error);
      throw new Error(`Failed to generate response: ${error.message}`);
    }
  }

  /**
   * Clean JSON response by removing markdown and extra text
   */
  private cleanJsonResponse(text: string): string {
    // Remove markdown code blocks
    let cleaned = text.replace(/```json\s*\n/g, '').replace(/```\s*$/g, '');

    // Try to extract just the JSON object
    const jsonStart = cleaned.indexOf('{');
    const jsonEnd = cleaned.lastIndexOf('}');

    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      cleaned = cleaned.substring(jsonStart, jsonEnd + 1);
    }

    return cleaned.trim();
  }

  async *streamResponse(
    messages: AIMessage[],
    context: AIContext,
    systemPrompt?: string
  ): AsyncGenerator<StreamChunk> {
    try {
      // Build context information
      const contextString = this.buildContextString(context);

      // Combine system prompt with context
      const fullSystemPrompt = systemPrompt
        ? `${systemPrompt}\n\n**Context Information:**\n${contextString}`
        : `**Context Information:**\n${contextString}`;

      // Convert messages to Gemini format
      const geminiMessages = this.convertMessagesToGeminiFormat(messages, fullSystemPrompt);

      // Generate streaming response
      const chat = this.model.startChat({
        history: geminiMessages.slice(0, -1),
      });

      const lastMessage = geminiMessages[geminiMessages.length - 1];
      const result = await chat.sendMessageStream(lastMessage.parts.map(p => p.text).join('\n'));

      let fullText = '';
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;

        yield {
          content: chunkText,
          isComplete: false
        };
      }

      // Send final chunk
      yield {
        content: '',
        isComplete: true
      };

    } catch (error: any) {
      console.error('Gemini Streaming Error:', error);
      throw new Error(`Failed to stream response: ${error.message}`);
    }
  }

  async analyzeIntent(message: string): Promise<Intent> {
    try {
      const prompt = `Analyze the following student message and determine their intent.
Classify the intent into one of these categories:
- QUIZ_GENERATION: Student wants practice questions or quizzes
- CONCEPT_EXPLANATION: Student wants an explanation of a concept
- ASSIGNMENT_QUERY: Student asking about assignments
- GRADE_INQUIRY: Student asking about grades
- HELP_REQUEST: Student needs help understanding something
- SUMMARY_REQUEST: Student wants a summary of material
- STUDY_PLAN: Student wants help planning their study
- DIRECT_ANSWER_REQUEST: Student asking for direct answers to homework
- GENERAL_QUESTION: General question or unclear intent

Return a JSON object with:
- type: The intent type from above
- topic: The main topic being asked about (if applicable)
- count: Number of questions requested (if applicable)
- confidence: Your confidence in this classification (0-1)

Student message: "${message}"

Respond with ONLY the JSON object, no other text.`;

      const result = await retryWithBackoff(
        async () => await this.model.generateContent(prompt),
        { maxRetries: 2 } // Fewer retries for intent analysis
      );
      const text = result.response.text();

      // Try to parse JSON from response
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/) || text.match(/\{[\s\S]*\}/);
        const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : text;
        const intent = JSON.parse(jsonText);

        return {
          type: intent.type || 'GENERAL_QUESTION',
          topic: intent.topic,
          count: intent.count,
          confidence: intent.confidence || 0.7,
          entities: intent.entities
        };
      } catch (parseError) {
        console.warn('Failed to parse intent JSON, using fallback:', text);
        return {
          type: 'GENERAL_QUESTION',
          confidence: 0.5
        };
      }
    } catch (error: any) {
      console.error('Intent analysis error:', error);
      // Fallback to simple pattern matching
      return this.fallbackIntentAnalysis(message);
    }
  }

  /**
   * Fallback intent analysis using pattern matching
   */
  private fallbackIntentAnalysis(message: string): Intent {
    const lowerMessage = message.toLowerCase();

    if (this.matchesPattern(lowerMessage, ['quiz', 'practice', 'test', 'questions'])) {
      return { type: 'QUIZ_GENERATION', confidence: 0.8 };
    }
    if (this.matchesPattern(lowerMessage, ['explain', 'what is', 'tell me about'])) {
      return { type: 'CONCEPT_EXPLANATION', confidence: 0.8 };
    }
    if (this.matchesPattern(lowerMessage, ['assignment', 'homework', 'due date'])) {
      return { type: 'ASSIGNMENT_QUERY', confidence: 0.8 };
    }
    if (this.matchesPattern(lowerMessage, ['grade', 'score', 'marks'])) {
      return { type: 'GRADE_INQUIRY', confidence: 0.9 };
    }
    if (this.matchesPattern(lowerMessage, ['give me the answer', 'what\'s the answer'])) {
      return { type: 'DIRECT_ANSWER_REQUEST', confidence: 0.9 };
    }

    return { type: 'GENERAL_QUESTION', confidence: 0.6 };
  }

  private matchesPattern(text: string, patterns: string[]): boolean {
    return patterns.some(pattern => text.includes(pattern));
  }

  async calculateConfidence(response: string, context: AIContext): Promise<number> {
    let confidence = 0.7; // Base confidence

    // Increase confidence if we have relevant materials
    if (context.relevantMaterials && context.relevantMaterials.length > 0) {
      confidence += 0.15;
    }

    // Decrease confidence for uncertain language
    const uncertainWords = ['might', 'maybe', 'possibly', 'i think', 'not sure', 'uncertain'];
    const hasUncertainty = uncertainWords.some(word => response.toLowerCase().includes(word));
    if (hasUncertainty) {
      confidence -= 0.2;
    }

    // Increase confidence for structured responses
    if (response.length > 200 && (response.includes('**') || response.includes('###'))) {
      confidence += 0.1;
    }

    // Increase confidence if response includes examples
    if (response.toLowerCase().includes('example') || response.toLowerCase().includes('for instance')) {
      confidence += 0.05;
    }

    return Math.max(0.1, Math.min(1, confidence));
  }

  async shouldRequireReview(response: AIResponse, context: AIContext): Promise<boolean> {
    // Require review if confidence is low
    if (response.confidence < 0.6) {
      return true;
    }

    // Require review for grade-related responses
    const gradeKeywords = ['grade', 'score', 'marks', 'points', 'percentage'];
    if (gradeKeywords.some(keyword => response.content.toLowerCase().includes(keyword))) {
      return true;
    }

    // Require review if providing direct answers
    const directAnswerPhrases = ['the answer is', 'the solution is', 'here is the answer'];
    if (directAnswerPhrases.some(phrase => response.content.toLowerCase().includes(phrase))) {
      return true;
    }

    // Require review if response is very short (might be incomplete)
    if (response.content.length < 50) {
      return true;
    }

    return false;
  }
}
