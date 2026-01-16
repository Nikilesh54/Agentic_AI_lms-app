import { IAIService } from '../types';
import {
  AIResponse,
  AIContext,
  AIMessage,
  VerificationResult,
  VerificationStep
} from '../types';
import { COVE_CONFIG } from '../../../config/constants';

/**
 * Chain-of-Verification (CoVe) Service
 *
 * Implements the CoVe technique from Meta AI Research (ACL 2024)
 * Reduces hallucinations by 23% through:
 * 1. Generate verification questions about the response
 * 2. Answer those questions independently
 * 3. Revise the original response based on verification
 *
 * Applied selectively based on confidence threshold to optimize cost/performance
 */
export class CoVeVerifier {
  private aiService: IAIService;

  constructor(aiService: IAIService) {
    this.aiService = aiService;
  }

  /**
   * Determine if verification should be applied to this response
   */
  shouldVerify(
    response: AIResponse,
    context: AIContext,
    agentType?: string
  ): boolean {
    // Check if CoVe is globally enabled
    if (!COVE_CONFIG.ENABLED) {
      return false;
    }

    // Check if agent type is in disabled list
    if (agentType && COVE_CONFIG.DISABLED_FOR_AGENTS.includes(agentType)) {
      return false;
    }

    // Check if agent type is in enabled list (if specified)
    if (agentType && COVE_CONFIG.ENABLED_FOR_AGENTS.length > 0) {
      if (!COVE_CONFIG.ENABLED_FOR_AGENTS.includes(agentType)) {
        return false;
      }
    }

    // Only verify if confidence is below threshold
    if (response.confidence >= COVE_CONFIG.CONFIDENCE_THRESHOLD) {
      return false;
    }

    return true;
  }

  /**
   * Apply Chain-of-Verification to improve response accuracy
   */
  async verify(
    originalResponse: AIResponse,
    context: AIContext,
    originalMessages: AIMessage[],
    systemPrompt?: string
  ): Promise<AIResponse> {
    const startTime = Date.now();
    const verificationSteps: VerificationStep[] = [];
    let apiCallCount = 1; // Count the original response

    try {
      console.log(`🔍 Starting CoVe verification (original confidence: ${(originalResponse.confidence * 100).toFixed(1)}%)`);

      // Step 1: Generate verification questions
      const questionsStep = await this.generateVerificationQuestions(
        originalResponse.content,
        context,
        systemPrompt
      );
      verificationSteps.push(questionsStep);
      apiCallCount++;

      if (questionsStep.status === 'failure' || !questionsStep.questions) {
        console.warn('⚠️ Failed to generate verification questions, skipping CoVe');
        return this.createUnverifiedResponse(originalResponse, verificationSteps, apiCallCount, startTime);
      }

      // Step 2: Answer verification questions independently
      const answersStep = await this.answerVerificationQuestions(
        questionsStep.questions,
        context,
        originalMessages,
        systemPrompt
      );
      verificationSteps.push(answersStep);
      apiCallCount++;

      if (answersStep.status === 'failure' || !answersStep.answers) {
        console.warn('⚠️ Failed to answer verification questions, skipping CoVe');
        return this.createUnverifiedResponse(originalResponse, verificationSteps, apiCallCount, startTime);
      }

      // Step 3: Revise response based on verification
      const revisionStep = await this.reviseResponse(
        originalResponse.content,
        questionsStep.questions,
        answersStep.answers,
        context,
        originalMessages,
        systemPrompt
      );
      verificationSteps.push(revisionStep);
      apiCallCount++;

      if (revisionStep.status === 'failure' || !revisionStep.revisedContent) {
        console.warn('⚠️ Failed to revise response, using original');
        return this.createUnverifiedResponse(originalResponse, verificationSteps, apiCallCount, startTime);
      }

      // Calculate final confidence
      const finalConfidence = await this.aiService.calculateConfidence(
        revisionStep.revisedContent,
        context
      );

      // Check if revision improved confidence enough
      const improvement = finalConfidence - originalResponse.confidence;
      const improvementPercentage = (improvement / originalResponse.confidence) * 100;

      console.log(`✅ CoVe completed: ${(originalResponse.confidence * 100).toFixed(1)}% → ${(finalConfidence * 100).toFixed(1)}% (${improvementPercentage.toFixed(1)}% improvement)`);

      // Only use revised response if it significantly improved
      const useRevisedResponse = improvement >= COVE_CONFIG.MIN_CONFIDENCE_IMPROVEMENT;

      const verificationResult: VerificationResult = {
        wasVerified: true,
        originalConfidence: originalResponse.confidence,
        finalConfidence: useRevisedResponse ? finalConfidence : originalResponse.confidence,
        improvementPercentage,
        verificationSteps,
        totalApiCalls: apiCallCount,
        verificationTimeMs: Date.now() - startTime
      };

      if (useRevisedResponse) {
        return {
          ...originalResponse,
          content: revisionStep.revisedContent,
          confidence: finalConfidence,
          verificationResult
        };
      } else {
        console.log(`⚠️ Improvement (${improvementPercentage.toFixed(1)}%) below threshold, keeping original`);
        return {
          ...originalResponse,
          verificationResult: {
            ...verificationResult,
            finalConfidence: originalResponse.confidence // Keep original
          }
        };
      }

    } catch (error: any) {
      console.error('❌ CoVe verification error:', error);
      return this.createUnverifiedResponse(originalResponse, verificationSteps, apiCallCount, startTime, error.message);
    }
  }

  /**
   * Step 1: Generate verification questions about the response
   */
  private async generateVerificationQuestions(
    responseContent: string,
    context: AIContext,
    systemPrompt?: string
  ): Promise<VerificationStep> {
    try {
      const verificationPrompt = `You are a fact-checker analyzing an AI response for accuracy.

Original Response:
"""
${responseContent}
"""

Generate ${COVE_CONFIG.VERIFICATION_QUESTIONS_COUNT} specific, targeted verification questions to check the accuracy of this response. Focus on:
1. Factual claims that can be verified
2. Logical consistency
3. Completeness of the answer
4. Potential sources of error or hallucination

Output ONLY a JSON array of questions, like this:
["Question 1?", "Question 2?", "Question 3?"]

No explanations, just the JSON array.`;

      const messages: AIMessage[] = [
        { role: 'user', content: verificationPrompt }
      ];

      const result = await this.aiService.generateResponse(
        messages,
        context,
        'You are a precise fact-checker focused on verifying AI responses.',
        { jsonMode: true }
      );

      // Parse JSON response
      const questions = JSON.parse(result.content);

      if (!Array.isArray(questions) || questions.length === 0) {
        throw new Error('Invalid questions format');
      }

      console.log(`📝 Generated ${questions.length} verification questions`);

      return {
        step: 'generate_questions',
        questions,
        status: 'success'
      };

    } catch (error: any) {
      console.error('Error generating verification questions:', error);
      return {
        step: 'generate_questions',
        status: 'failure',
        errorMessage: error.message
      };
    }
  }

  /**
   * Step 2: Answer verification questions independently (without seeing original response)
   */
  private async answerVerificationQuestions(
    questions: string[],
    context: AIContext,
    originalMessages: AIMessage[],
    systemPrompt?: string
  ): Promise<VerificationStep> {
    try {
      const answersPrompt = `Answer the following verification questions independently based on the available context and materials.

Be honest about uncertainty. If you don't know something, say so clearly.

Questions:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Provide concise, factual answers. Output as a JSON array:
["Answer 1", "Answer 2", "Answer 3"]

No explanations, just the JSON array.`;

      const messages: AIMessage[] = [
        ...originalMessages.filter(m => m.role !== 'assistant'), // Exclude previous assistant responses
        { role: 'user', content: answersPrompt }
      ];

      const result = await this.aiService.generateResponse(
        messages,
        context,
        systemPrompt,
        { jsonMode: true }
      );

      const answers = JSON.parse(result.content);

      if (!Array.isArray(answers) || answers.length !== questions.length) {
        throw new Error('Invalid answers format or count mismatch');
      }

      console.log(`💡 Generated ${answers.length} verification answers`);

      return {
        step: 'answer_questions',
        questions,
        answers,
        status: 'success'
      };

    } catch (error: any) {
      console.error('Error answering verification questions:', error);
      return {
        step: 'answer_questions',
        status: 'failure',
        errorMessage: error.message
      };
    }
  }

  /**
   * Step 3: Revise original response based on verification Q&A
   */
  private async reviseResponse(
    originalContent: string,
    questions: string[],
    answers: string[],
    context: AIContext,
    originalMessages: AIMessage[],
    systemPrompt?: string
  ): Promise<VerificationStep> {
    try {
      const revisionPrompt = `You are revising your previous response based on verification checks.

Original Response:
"""
${originalContent}
"""

Verification Q&A:
${questions.map((q, i) => `Q${i + 1}: ${q}\nA${i + 1}: ${answers[i]}`).join('\n\n')}

Based on this verification, revise your original response to:
1. Correct any factual errors
2. Address any uncertainties
3. Improve completeness
4. Maintain the same tone and style

If the original response was accurate, you may keep it largely the same but can refine it.

Provide ONLY the revised response text. No meta-commentary.`;

      const messages: AIMessage[] = [
        ...originalMessages,
        { role: 'user', content: revisionPrompt }
      ];

      const result = await this.aiService.generateResponse(
        messages,
        context,
        systemPrompt
      );

      console.log(`✏️ Generated revised response (${result.content.length} chars)`);

      return {
        step: 'revise_response',
        revisedContent: result.content,
        confidence: result.confidence,
        status: 'success'
      };

    } catch (error: any) {
      console.error('Error revising response:', error);
      return {
        step: 'revise_response',
        status: 'failure',
        errorMessage: error.message
      };
    }
  }

  /**
   * Create a response object when verification wasn't completed
   */
  private createUnverifiedResponse(
    originalResponse: AIResponse,
    steps: VerificationStep[],
    apiCalls: number,
    startTime: number,
    errorMessage?: string
  ): AIResponse {
    return {
      ...originalResponse,
      verificationResult: {
        wasVerified: false,
        originalConfidence: originalResponse.confidence,
        finalConfidence: originalResponse.confidence,
        improvementPercentage: 0,
        verificationSteps: steps,
        totalApiCalls: apiCalls,
        verificationTimeMs: Date.now() - startTime
      }
    };
  }
}
