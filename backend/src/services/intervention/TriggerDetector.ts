import { pool } from '../../config/database';
import { InterventionTrigger, InterventionContext } from './InterventionManager';

/**
 * Trigger Detector - Detects when human intervention is needed
 * Uses rule-based logic (no AI required)
 */
export class TriggerDetector {
  /**
   * Detect if intervention is needed
   */
  async detect(context: InterventionContext): Promise<InterventionTrigger | null> {
    const checks = [
      () => this.checkDirectAnswerRequest(context),
      () => this.checkGradeDiscussion(context),
      () => this.checkLowConfidence(context),
      () => this.checkRepeatedQuestions(context),
      () => this.checkSensitiveTopic(context),
      () => this.checkExtendedConversation(context),
      () => this.checkStudentFrustration(context),
      () => this.checkPolicyKeywords(context),
    ];

    for (const check of checks) {
      const trigger = await check();
      if (trigger) {
        return trigger;
      }
    }

    return null;
  }

  /**
   * Check for direct answer requests
   */
  private checkDirectAnswerRequest(context: InterventionContext): InterventionTrigger | null {
    const lowerMessage = context.message.toLowerCase();

    const directAnswerPhrases = [
      'give me the answer',
      'tell me the answer',
      'what is the answer',
      'what\'s the answer',
      'just tell me',
      'solve this for me',
      'do this for me',
      'complete this for me',
      'write this for me',
    ];

    if (directAnswerPhrases.some(phrase => lowerMessage.includes(phrase))) {
      return {
        type: 'DIRECT_ANSWER_REQUEST',
        reason: 'Student is requesting direct answers to assignment questions',
        priority: 'high',
        requiresImmediate: true,
      };
    }

    return null;
  }

  /**
   * Check for grade discussions
   */
  private checkGradeDiscussion(context: InterventionContext): InterventionTrigger | null {
    const lowerMessage = context.message.toLowerCase();

    const gradeKeywords = ['grade', 'score', 'points', 'marks'];
    const questionKeywords = ['what', 'why', 'how', 'can i', 'will you'];

    const hasGradeKeyword = gradeKeywords.some(keyword => lowerMessage.includes(keyword));
    const hasQuestionKeyword = questionKeywords.some(keyword => lowerMessage.includes(keyword));

    if (hasGradeKeyword && hasQuestionKeyword) {
      return {
        type: 'GRADE_DISCUSSION',
        reason: 'Student is asking about grades - requires professor attention',
        priority: 'high',
        requiresImmediate: false,
      };
    }

    return null;
  }

  /**
   * Check for low confidence AI responses
   */
  private checkLowConfidence(context: InterventionContext): InterventionTrigger | null {
    if (!context.aiResponse) return null;

    const uncertaintyPhrases = [
      'i\'m not sure',
      'i think',
      'maybe',
      'might be',
      'could be',
      'not certain',
      'unsure',
    ];

    const lowerResponse = context.aiResponse.toLowerCase();
    const hasUncertainty = uncertaintyPhrases.some(phrase => lowerResponse.includes(phrase));

    if (hasUncertainty) {
      return {
        type: 'LOW_CONFIDENCE',
        reason: 'AI expressed uncertainty in response',
        priority: 'medium',
        requiresImmediate: false,
      };
    }

    return null;
  }

  /**
   * Check for repeated questions (student not getting help)
   */
  private async checkRepeatedQuestions(context: InterventionContext): Promise<InterventionTrigger | null> {
    try {
      const result = await pool.query(
        `SELECT COUNT(*) as message_count
         FROM chat_messages
         WHERE session_id = (SELECT id FROM chat_sessions WHERE id = $1)
           AND sender_type = 'student'
           AND created_at > NOW() - INTERVAL '30 minutes'`,
        [context.sessionId]
      );

      const messageCount = parseInt(result.rows[0]?.message_count || '0');

      if (messageCount > 10) {
        return {
          type: 'REPEATED_QUESTIONS',
          reason: 'Student has asked many questions without resolution',
          priority: 'medium',
          requiresImmediate: false,
        };
      }
    } catch (error) {
      console.error('Error checking repeated questions:', error);
    }

    return null;
  }

  /**
   * Check for sensitive topics
   */
  private checkSensitiveTopic(context: InterventionContext): InterventionTrigger | null {
    const lowerMessage = context.message.toLowerCase();

    const sensitiveCombinations = [
      { keywords: ['change', 'my', 'grade'], reason: 'Grade change request' },
      { keywords: ['deadline', 'extension'], reason: 'Deadline extension request' },
      { keywords: ['drop', 'withdraw'], reason: 'Course withdrawal discussion' },
      { keywords: ['plagiarism', 'cheating'], reason: 'Academic integrity concern' },
      { keywords: ['disability', 'accommodation'], reason: 'Accommodation request' },
      { keywords: ['complain', 'unfair'], reason: 'Complaint or fairness concern' },
    ];

    for (const combo of sensitiveCombinations) {
      if (combo.keywords.every(keyword => lowerMessage.includes(keyword))) {
        return {
          type: 'SENSITIVE_TOPIC',
          reason: combo.reason,
          priority: 'high',
          requiresImmediate: true,
        };
      }
    }

    return null;
  }

  /**
   * Check for extended conversation without resolution
   */
  private async checkExtendedConversation(context: InterventionContext): Promise<InterventionTrigger | null> {
    try {
      const result = await pool.query(
        `SELECT
           COUNT(*) as message_count,
           EXTRACT(EPOCH FROM (NOW() - MIN(created_at)))/60 as duration_minutes
         FROM chat_messages
         WHERE session_id = $1
           AND created_at > NOW() - INTERVAL '2 hours'`,
        [context.sessionId]
      );

      const data = result.rows[0];
      const messageCount = parseInt(data?.message_count || '0');
      const duration = parseFloat(data?.duration_minutes || '0');

      // Long conversation might indicate student is stuck
      if (messageCount > 15 && duration > 30) {
        return {
          type: 'EXTENDED_CONVERSATION',
          reason: 'Long conversation without clear resolution',
          priority: 'low',
          requiresImmediate: false,
        };
      }
    } catch (error) {
      console.error('Error checking extended conversation:', error);
    }

    return null;
  }

  /**
   * Check for student frustration
   */
  private checkStudentFrustration(context: InterventionContext): InterventionTrigger | null {
    const lowerMessage = context.message.toLowerCase();

    const frustrationPhrases = [
      'this doesn\'t work',
      'not helpful',
      'frustrated',
      'stuck',
      'don\'t understand',
      'makes no sense',
      'confused',
      'this is stupid',
      'i give up',
      'can\'t figure out',
    ];

    if (frustrationPhrases.some(phrase => lowerMessage.includes(phrase))) {
      return {
        type: 'STUDENT_FRUSTRATION',
        reason: 'Student expressing frustration - may need human support',
        priority: 'medium',
        requiresImmediate: false,
      };
    }

    return null;
  }

  /**
   * Check for policy-related keywords
   */
  private checkPolicyKeywords(context: InterventionContext): InterventionTrigger | null {
    const lowerMessage = context.message.toLowerCase();

    const policyKeywords = [
      { keyword: 'syllabus', topic: 'Syllabus policy' },
      { keyword: 'late policy', topic: 'Late submission policy' },
      { keyword: 'attendance', topic: 'Attendance policy' },
      { keyword: 'retake', topic: 'Exam retake policy' },
      { keyword: 'extra credit', topic: 'Extra credit policy' },
    ];

    for (const item of policyKeywords) {
      if (lowerMessage.includes(item.keyword)) {
        return {
          type: 'POLICY_INQUIRY',
          reason: `Student asking about ${item.topic}`,
          priority: 'low',
          requiresImmediate: false,
        };
      }
    }

    return null;
  }
}
