/**
 * Policy Guardrails - Enforces educational policies
 * Prevents AI from violating academic integrity and institutional policies
 */

export interface PolicyViolation {
  violation: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  shouldBlock: boolean;
}

export interface PolicyCheckContext {
  userId: number;
  userRole: string;
  sessionId: number;
}

export class PolicyGuardrails {
  /**
   * Check message and response for policy violations
   */
  async checkMessage(
    userMessage: string,
    aiResponse: string,
    context: PolicyCheckContext
  ): Promise<PolicyViolation | null> {
    const checks = [
      () => this.checkDirectAnswers(userMessage, aiResponse),
      () => this.checkGradeSharing(userMessage, aiResponse),
      () => this.checkAcademicIntegrity(userMessage, aiResponse),
      () => this.checkPrivacyViolation(userMessage, aiResponse),
      () => this.checkInappropriateContent(userMessage, aiResponse),
      () => this.checkUnauthorizedPromises(aiResponse),
    ];

    for (const check of checks) {
      const violation = check();
      if (violation) {
        return violation;
      }
    }

    return null;
  }

  /**
   * Check if AI is providing direct answers to assignments
   */
  private checkDirectAnswers(userMessage: string, aiResponse: string): PolicyViolation | null {
    const lowerMessage = userMessage.toLowerCase();
    const lowerResponse = aiResponse.toLowerCase();

    // Check if user is asking about assignment
    const isAssignmentQuestion =
      lowerMessage.includes('assignment') ||
      lowerMessage.includes('homework') ||
      lowerMessage.includes('problem') ||
      lowerMessage.includes('question');

    if (!isAssignmentQuestion) return null;

    // Check if AI is providing direct solutions
    const directAnswerPhrases = [
      'the answer is',
      'the solution is',
      'here is the answer',
      'here\'s the solution',
      'the correct answer',
      'you should write',
      'copy this',
      'use this code',
      'here is the code',
    ];

    if (directAnswerPhrases.some(phrase => lowerResponse.includes(phrase))) {
      return {
        violation: 'AI provided direct answer to assignment question',
        severity: 'critical',
        shouldBlock: true,
      };
    }

    // Check for code solutions (if applicable)
    if (lowerResponse.includes('```') && isAssignmentQuestion) {
      // Contains code block - might be providing solution
      const codeBlockCount = (lowerResponse.match(/```/g) || []).length / 2;
      if (codeBlockCount > 1) {
        return {
          violation: 'AI provided complete code solution to assignment',
          severity: 'high',
          shouldBlock: true,
        };
      }
    }

    return null;
  }

  /**
   * Check if discussing grades inappropriately
   */
  private checkGradeSharing(userMessage: string, aiResponse: string): PolicyViolation | null {
    const lowerResponse = aiResponse.toLowerCase();

    const gradeDisclosurePhrases = [
      'your grade is',
      'you scored',
      'you received',
      'your score is',
      'you got a',
      'graded as',
    ];

    if (gradeDisclosurePhrases.some(phrase => lowerResponse.includes(phrase))) {
      return {
        violation: 'AI disclosed grade information',
        severity: 'high',
        shouldBlock: true,
      };
    }

    return null;
  }

  /**
   * Check for academic integrity violations
   */
  private checkAcademicIntegrity(userMessage: string, aiResponse: string): PolicyViolation | null {
    const lowerMessage = userMessage.toLowerCase();
    const lowerResponse = aiResponse.toLowerCase();

    // Check if user is asking for cheating assistance
    const cheatingPhrases = [
      'cheat',
      'plagiarize',
      'copy from',
      'pretend i wrote',
      'make it look like i did it',
    ];

    if (cheatingPhrases.some(phrase => lowerMessage.includes(phrase))) {
      return {
        violation: 'Student requesting assistance with academic dishonesty',
        severity: 'critical',
        shouldBlock: true,
      };
    }

    // Check if AI is helping with cheating
    const aiCheatingPhrases = [
      'here\'s how to cheat',
      'you can plagiarize',
      'copy this without citation',
      'no one will know',
    ];

    if (aiCheatingPhrases.some(phrase => lowerResponse.includes(phrase))) {
      return {
        violation: 'AI provided guidance on academic dishonesty',
        severity: 'critical',
        shouldBlock: true,
      };
    }

    return null;
  }

  /**
   * Check for privacy violations
   */
  private checkPrivacyViolation(userMessage: string, aiResponse: string): PolicyViolation | null {
    const lowerMessage = userMessage.toLowerCase();
    const lowerResponse = aiResponse.toLowerCase();

    // Check if asking about other students
    if (lowerMessage.includes('other student') ||
        lowerMessage.includes('classmate') ||
        lowerMessage.includes('their grade')) {
      return {
        violation: 'Asking about other students\' private information',
        severity: 'high',
        shouldBlock: false, // Allow but flag for review
      };
    }

    // Check if AI is sharing personal information
    const privacyPatterns = [
      /email.*@/i,
      /phone.*\d{3}[-.]?\d{3}[-.]?\d{4}/i,
      /social security/i,
      /student id.*\d+/i,
    ];

    if (privacyPatterns.some(pattern => pattern.test(lowerResponse))) {
      return {
        violation: 'AI response contains personal information',
        severity: 'critical',
        shouldBlock: true,
      };
    }

    return null;
  }

  /**
   * Check for inappropriate content
   */
  private checkInappropriateContent(userMessage: string, aiResponse: string): PolicyViolation | null {
    const lowerMessage = userMessage.toLowerCase();
    const lowerResponse = aiResponse.toLowerCase();

    // Basic inappropriate content detection
    const inappropriateKeywords = [
      'offensive',
      'discriminatory',
      'harassment',
      'threat',
    ];

    const combinedText = lowerMessage + ' ' + lowerResponse;

    // This is a simplified check - in production, use more sophisticated content filtering
    if (inappropriateKeywords.some(keyword => combinedText.includes(keyword))) {
      return {
        violation: 'Potentially inappropriate content detected',
        severity: 'high',
        shouldBlock: false, // Review before blocking
      };
    }

    return null;
  }

  /**
   * Check if AI is making unauthorized promises
   */
  private checkUnauthorizedPromises(aiResponse: string): PolicyViolation | null {
    const lowerResponse = aiResponse.toLowerCase();

    const unauthorizedPromises = [
      { phrase: 'i will change your grade', severity: 'critical' as const },
      { phrase: 'i can extend the deadline', severity: 'critical' as const },
      { phrase: 'you will pass', severity: 'high' as const },
      { phrase: 'guaranteed to pass', severity: 'high' as const },
      { phrase: 'i\'ll give you', severity: 'medium' as const },
      { phrase: 'you don\'t need to', severity: 'medium' as const },
    ];

    for (const item of unauthorizedPromises) {
      if (lowerResponse.includes(item.phrase)) {
        return {
          violation: `AI made unauthorized promise: "${item.phrase}"`,
          severity: item.severity,
          shouldBlock: true,
        };
      }
    }

    return null;
  }

  /**
   * Get safe response for blocked content
   */
  getSafeResponse(violation: PolicyViolation): string {
    switch (violation.severity) {
      case 'critical':
        return `I can't assist with that request as it violates academic integrity policies. Your instructor has been notified. If you have questions about course policies, please ask your professor directly.`;

      case 'high':
        return `I'm not able to provide that information. For matters related to grades, deadlines, or personal information, please contact your instructor directly.`;

      case 'medium':
        return `I can't make promises about course outcomes or policies. Please refer to your syllabus or contact your instructor for authoritative information.`;

      case 'low':
        return `I recommend checking with your instructor about this topic to ensure you get accurate, policy-compliant information.`;

      default:
        return `I'm unable to help with that specific request. Please contact your instructor for assistance.`;
    }
  }
}
