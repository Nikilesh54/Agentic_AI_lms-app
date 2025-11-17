import { IAIService, AIServiceConfig } from './types';
import { MockAIService } from './providers/MockAIService';
import { GeminiAIService } from './providers/GeminiAIService';
// Future imports:
// import { OpenAIService } from './providers/OpenAIService';
// import { AnthropicService } from './providers/AnthropicService';

/**
 * Factory for creating AI service instances
 * Supports multiple providers via adapter pattern
 */
export class AIServiceFactory {
  private static instance: IAIService | null = null;

  /**
   * Get the configured AI service instance (singleton)
   */
  static getInstance(config?: AIServiceConfig): IAIService {
    if (!this.instance) {
      this.instance = this.createService(config || this.getDefaultConfig());
    }
    return this.instance;
  }

  /**
   * Create a new AI service instance
   */
  static createService(config: AIServiceConfig): IAIService {
    switch (config.provider) {
      case 'mock':
        return new MockAIService(config);

      case 'gemini':
        return new GeminiAIService(config);

      // Future implementations:
      // case 'openai':
      //   return new OpenAIService(config);
      //
      // case 'anthropic':
      //   return new AnthropicService(config);

      default:
        console.warn(`Unknown AI provider: ${config.provider}, falling back to mock`);
        return new MockAIService(config);
    }
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static reset(): void {
    this.instance = null;
  }

  /**
   * Get default configuration from environment
   */
  private static getDefaultConfig(): AIServiceConfig {
    return {
      provider: (process.env.AI_PROVIDER as any) || 'gemini',
      apiKey: process.env.GOOGLE_AI_API_KEY || process.env.AI_API_KEY,
      model: process.env.GEMINI_MODEL || process.env.AI_MODEL || 'gemini-2.0-flash-exp',
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2048'),
      streamingEnabled: process.env.AI_STREAMING_ENABLED === 'true',
    };
  }
}

/**
 * Convenience function to get AI service
 */
export function getAIService(): IAIService {
  return AIServiceFactory.getInstance();
}
