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

/**
 * Mock AI Service - Sophisticated rule-based implementation
 * Works without external AI providers
 * Provides realistic responses using pattern matching and templates
 */
export class MockAIService implements IAIService {
  private config: AIServiceConfig;

  constructor(config: AIServiceConfig) {
    this.config = config;
  }

  async generateResponse(
    messages: AIMessage[],
    context: AIContext,
    systemPrompt?: string
  ): Promise<AIResponse> {
    // Simulate processing delay
    await this.simulateDelay(300, 800);

    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    if (!lastUserMessage) {
      throw new Error('No user message found');
    }

    const intent = await this.analyzeIntent(lastUserMessage.content);
    const response = this.generateResponseByIntent(intent, lastUserMessage.content, context);

    return response;
  }

  async *streamResponse(
    messages: AIMessage[],
    context: AIContext,
    systemPrompt?: string
  ): AsyncGenerator<StreamChunk> {
    const response = await this.generateResponse(messages, context, systemPrompt);

    // Simulate streaming by chunking the response
    const words = response.content.split(' ');
    const chunkSize = 3;

    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize).join(' ') + ' ';
      await this.simulateDelay(50, 150);

      yield {
        content: chunk,
        isComplete: i + chunkSize >= words.length,
        toolCalls: i + chunkSize >= words.length ? response.toolCalls : undefined
      };
    }
  }

  async analyzeIntent(message: string): Promise<Intent> {
    const lowerMessage = message.toLowerCase();

    // Pattern matching for intent detection
    if (this.matchesPattern(lowerMessage, ['quiz', 'practice', 'test', 'questions', 'mcq'])) {
      return {
        type: 'QUIZ_GENERATION',
        topic: this.extractTopic(message),
        count: this.extractNumber(message) || 5,
        confidence: 0.9
      };
    }

    if (this.matchesPattern(lowerMessage, ['explain', 'what is', 'tell me about', 'describe', 'how does'])) {
      return {
        type: 'CONCEPT_EXPLANATION',
        topic: this.extractTopic(message),
        confidence: 0.85
      };
    }

    if (this.matchesPattern(lowerMessage, ['assignment', 'homework', 'due date', 'submit'])) {
      return {
        type: 'ASSIGNMENT_QUERY',
        confidence: 0.8
      };
    }

    if (this.matchesPattern(lowerMessage, ['grade', 'score', 'marks', 'points'])) {
      return {
        type: 'GRADE_INQUIRY',
        confidence: 0.9
      };
    }

    if (this.matchesPattern(lowerMessage, ['help', 'stuck', 'confused', 'don\'t understand'])) {
      return {
        type: 'HELP_REQUEST',
        topic: this.extractTopic(message),
        confidence: 0.85
      };
    }

    if (this.matchesPattern(lowerMessage, ['summary', 'summarize', 'recap', 'overview'])) {
      return {
        type: 'SUMMARY_REQUEST',
        topic: this.extractTopic(message),
        confidence: 0.85
      };
    }

    if (this.matchesPattern(lowerMessage, ['study plan', 'schedule', 'prepare'])) {
      return {
        type: 'STUDY_PLAN',
        confidence: 0.8
      };
    }

    // Check for direct answer requests (should trigger intervention)
    if (this.matchesPattern(lowerMessage, ['give me the answer', 'what\'s the answer', 'tell me the answer', 'solve this for me'])) {
      return {
        type: 'DIRECT_ANSWER_REQUEST',
        confidence: 0.95
      };
    }

    return {
      type: 'GENERAL_QUESTION',
      confidence: 0.6
    };
  }

  async calculateConfidence(response: string, context: AIContext): Promise<number> {
    let confidence = 0.7; // Base confidence

    // Increase confidence if we have relevant materials
    if (context.relevantMaterials && context.relevantMaterials.length > 0) {
      confidence += 0.15;
    }

    // Decrease confidence for vague responses
    if (response.includes('I think') || response.includes('maybe') || response.includes('not sure')) {
      confidence -= 0.2;
    }

    // Increase confidence for specific responses
    if (response.length > 200 && response.includes('example')) {
      confidence += 0.1;
    }

    return Math.max(0, Math.min(1, confidence));
  }

  async shouldRequireReview(response: AIResponse, context: AIContext): Promise<boolean> {
    // Require review if confidence is low
    if (response.confidence < 0.6) {
      return true;
    }

    // Require review for grade-related responses
    if (response.content.toLowerCase().includes('grade') ||
        response.content.toLowerCase().includes('score')) {
      return true;
    }

    // Require review if providing direct answers
    if (response.content.toLowerCase().includes('the answer is')) {
      return true;
    }

    return false;
  }

  /**
   * Generate response based on detected intent
   */
  private generateResponseByIntent(
    intent: Intent,
    message: string,
    context: AIContext
  ): AIResponse {
    let content: string;
    let confidence: number;
    let toolCalls: ToolCall[] = [];
    let requiresReview = false;

    switch (intent.type) {
      case 'QUIZ_GENERATION':
        content = this.generateQuizResponse(intent, context);
        confidence = 0.85;
        toolCalls = [{
          id: `tool_${Date.now()}`,
          name: 'generateQuiz',
          arguments: {
            topic: intent.topic,
            count: intent.count,
            difficulty: 'medium'
          }
        }];
        break;

      case 'CONCEPT_EXPLANATION':
        content = this.generateExplanationResponse(intent, context);
        confidence = 0.8;
        toolCalls = [{
          id: `tool_${Date.now()}`,
          name: 'searchCourseMaterials',
          arguments: {
            query: intent.topic,
            limit: 5
          }
        }];
        break;

      case 'ASSIGNMENT_QUERY':
        content = this.generateAssignmentResponse(context);
        confidence = 0.9;
        toolCalls = [{
          id: `tool_${Date.now()}`,
          name: 'getActiveAssignments',
          arguments: {}
        }];
        break;

      case 'GRADE_INQUIRY':
        content = this.generateGradeResponse();
        confidence = 0.5;
        requiresReview = true; // Always require review for grades
        break;

      case 'HELP_REQUEST':
        content = this.generateHelpResponse(intent, context);
        confidence = 0.75;
        break;

      case 'SUMMARY_REQUEST':
        content = this.generateSummaryResponse(intent, context);
        confidence = 0.8;
        toolCalls = [{
          id: `tool_${Date.now()}`,
          name: 'searchCourseMaterials',
          arguments: {
            query: intent.topic,
            limit: 10
          }
        }];
        break;

      case 'STUDY_PLAN':
        content = this.generateStudyPlanResponse(context);
        confidence = 0.8;
        toolCalls = [{
          id: `tool_${Date.now()}`,
          name: 'createStudyPlan',
          arguments: {
            includeAssignments: true
          }
        }];
        break;

      case 'DIRECT_ANSWER_REQUEST':
        content = this.generateDirectAnswerRefusal();
        confidence = 0.95;
        requiresReview = true; // Escalate to professor
        break;

      default:
        content = this.generateGeneralResponse(message, context);
        confidence = 0.6;
    }

    return {
      content,
      confidence,
      requiresReview,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      sources: this.mockSources(context)
    };
  }

  private generateQuizResponse(intent: Intent, context: AIContext): string {
    const topic = intent.topic || 'the course material';
    const count = intent.count || 5;

    return `I'll generate ${count} practice questions about ${topic} for you.

Here are some questions to test your understanding:

1. What are the key concepts related to ${topic}?
2. Can you explain how ${topic} applies in practical scenarios?
3. What are the main differences between related concepts in ${topic}?
4. How would you solve a problem involving ${topic}?
5. What are common mistakes when working with ${topic}?

Would you like me to provide hints for any of these questions, or would you like to attempt them first?`;
  }

  private generateExplanationResponse(intent: Intent, context: AIContext): string {
    const topic = intent.topic || 'this concept';
    const hasMaterials = context.relevantMaterials && context.relevantMaterials.length > 0;

    if (hasMaterials) {
      return `Let me explain ${topic} based on your course materials.

${topic} is an important concept in your course. Here's a breakdown:

**Key Points:**
- The fundamental idea behind ${topic}
- How it relates to other concepts you've learned
- Practical applications and examples

**Example:**
Consider a real-world scenario where ${topic} is applied. This helps understand the practical implications.

**Common Misconceptions:**
Students sometimes confuse ${topic} with related concepts. The key difference is...

Would you like me to go deeper into any specific aspect, or would you like some practice problems?`;
    }

    return `I'd be happy to explain ${topic}!

Based on general knowledge, ${topic} is an important concept. However, I'd recommend checking your course materials for the specific way your instructor approaches this topic.

Would you like me to:
1. Search your course materials for information about ${topic}?
2. Provide some practice questions to test your understanding?
3. Help you create a study guide for ${topic}?`;
  }

  private generateAssignmentResponse(context: AIContext): string {
    const hasAssignments = context.activeAssignments && context.activeAssignments.length > 0;

    if (hasAssignments) {
      return `Here are your current assignments:

I can see you have active assignments. Let me help you understand what's required:

**Remember:** I can help you understand the assignment requirements, break down the problem, and guide your thinking, but I won't provide direct answers.

Would you like me to:
1. Help you understand the assignment requirements?
2. Break down the problem into manageable steps?
3. Suggest resources from your course materials?`;
    }

    return `Let me check your active assignments for you.

I can help you with:
- Understanding assignment requirements
- Breaking down complex problems
- Finding relevant course materials
- Creating a study schedule

What would be most helpful for you?`;
  }

  private generateGradeResponse(): string {
    return `I understand you're asking about grades.

**Important:** Grade information is sensitive and should be discussed directly with your instructor. I don't have access to grading information, and even if I did, such discussions require professor involvement.

I've flagged this conversation for your instructor to review.

In the meantime, I can help you:
- Understand assignment grading criteria
- Review your submitted work for potential improvements
- Prepare for upcoming assessments

Would any of these be helpful?`;
  }

  private generateHelpResponse(intent: Intent, context: AIContext): string {
    const topic = intent.topic || 'this material';

    return `I'm here to help! Let's work through ${topic} together.

**Let's break it down:**

First, let's identify where you're getting stuck:
- Is it understanding the concept itself?
- Is it applying the concept to a problem?
- Is it a specific step in a process?

**Helpful approach:**
1. Let's review the fundamental concepts
2. I'll provide some examples
3. We can work through a similar problem together
4. Then you can try applying it yourself

What specifically is confusing you about ${topic}? The more details you provide, the better I can guide you.`;
  }

  private generateSummaryResponse(intent: Intent, context: AIContext): string {
    const topic = intent.topic || 'the recent material';

    return `Here's a summary of ${topic}:

**Main Concepts:**
- Key concept 1: [Based on course materials]
- Key concept 2: [Building on previous topics]
- Key concept 3: [Practical applications]

**How It Connects:**
This material builds on earlier concepts and prepares you for upcoming topics.

**Important Takeaways:**
- Focus on understanding the core principles
- Practice with various examples
- See how concepts relate to each other

**Study Recommendations:**
1. Review your notes on related topics
2. Complete practice problems
3. Create concept maps to visualize relationships

Would you like me to go deeper into any specific area, or would you like some practice questions?`;
  }

  private generateStudyPlanResponse(context: AIContext): string {
    return `Let me help you create a study plan!

**Personalized Study Plan:**

**This Week:**
- Review core concepts from recent lectures
- Complete practice problems for better understanding
- Review course materials and take notes

**Upcoming Assignments:**
- I can help you break down your assignments into manageable tasks
- We can create a timeline to ensure you stay on track

**Study Strategies:**
1. **Active Recall:** Test yourself regularly
2. **Spaced Repetition:** Review material at increasing intervals
3. **Practice Problems:** Apply concepts to real problems
4. **Concept Mapping:** Create visual connections

Would you like me to:
1. Help prioritize based on upcoming deadlines?
2. Create a detailed schedule for a specific topic?
3. Suggest resources for particular concepts?`;
  }

  private generateDirectAnswerRefusal(): string {
    return `I appreciate your question, but I can't provide direct answers to assignment questions.

**Here's why:**
The goal is for you to develop understanding and problem-solving skills. Getting direct answers doesn't help you learn!

**What I CAN do:**
- Help you understand the concepts involved
- Break down the problem into steps
- Guide you through the thinking process
- Provide similar examples for practice
- Point you to relevant course materials

**Let's work together:**
Can you tell me:
1. What have you tried so far?
2. Where specifically are you getting stuck?
3. What concepts do you think apply to this problem?

I'm here to guide you to the answer, not just give it to you. This conversation has been flagged for your instructor to review.`;
  }

  private generateGeneralResponse(message: string, context: AIContext): string {
    return `Thanks for your question!

I'm here to help you with your coursework. I can assist with:
- Explaining concepts from your course materials
- Generating practice questions
- Creating study guides and plans
- Breaking down assignments (without giving direct answers)
- Finding relevant resources

Could you be more specific about what you need help with? For example:
- "Explain [concept] from Chapter X"
- "Generate practice questions about [topic]"
- "Help me understand this assignment"
- "Create a study plan for the upcoming exam"

The more specific you are, the better I can help you learn!`;
  }

  /**
   * Helper methods
   */
  private matchesPattern(text: string, patterns: string[]): boolean {
    return patterns.some(pattern => text.includes(pattern));
  }

  private extractTopic(message: string): string {
    // Simple topic extraction - in production, this could be more sophisticated
    const words = message.split(' ');
    const stopWords = ['what', 'is', 'the', 'a', 'an', 'about', 'explain', 'tell', 'me', 'how', 'does', 'can', 'you'];
    const topicWords = words.filter(w => !stopWords.includes(w.toLowerCase()) && w.length > 2);
    return topicWords.slice(0, 3).join(' ') || 'this topic';
  }

  private extractNumber(message: string): number | null {
    const match = message.match(/\d+/);
    return match ? parseInt(match[0]) : null;
  }

  private mockSources(context: AIContext): Array<{ id: number; name: string; relevance: number }> {
    if (context.relevantMaterials && context.relevantMaterials.length > 0) {
      return context.relevantMaterials.slice(0, 3).map((material: any) => ({
        id: material.id,
        name: material.file_name || 'Course Material',
        relevance: Math.random() * 0.3 + 0.7 // 0.7 - 1.0
      }));
    }
    return [];
  }

  private async simulateDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }
}
