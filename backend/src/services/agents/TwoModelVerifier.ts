import { AIServiceFactory } from '../ai/AIServiceFactory';
import { AIMessage, AIServiceConfig, IAIService } from '../ai/types';
import { getGroqRateLimitManager } from '../ai/GroqRateLimitManager';
import { SCORING } from '../../config/constants';
import fs from 'fs';
import path from 'path';

const LOG_PATH = path.join(__dirname, '../../../api-debug.log');
function logToFile(message: string) {
  fs.appendFileSync(LOG_PATH, `[${new Date().toISOString()}] [TwoModelVerifier] ${message}\n`);
}

const VERIFIER_SYSTEM_PROMPT = `You are an Integrity Verification Agent. Compare what the chatbot CLAIMED against the ACTUAL source content provided. PDF extraction may add spaces/line breaks — if the MEANING is present, it's a match.

Scoring:
- 90-100: information found in source (quote or same meaning)
- 70-89: accurate paraphrase, core info preserved
- 50-69: partially accurate
- 30-49: significant discrepancies
- 0-29: absent or contradicts source

Respond with ONLY this JSON, nothing else:
{"trust_score": <0-100>, "reasoning": "<under 300 chars>"}`;

export interface SingleVerdict {
  model: string;
  score: number | null;
  reasoning: string;
}

export interface JuryVerdicts {
  a: SingleVerdict; // Qwen
  b: SingleVerdict; // Llama
}

/**
 * Run two INDEPENDENT Groq verifiers (Qwen + Llama) over the same answer-vs-sources context.
 * Returns both raw verdicts; reconciliation happens in juryReconciliation.reconcileJury.
 * No Gemini fallback — if Groq is unavailable, that verdict is null (handled downstream).
 */
export class TwoModelVerifier {
  async verify(verificationContext: string): Promise<JuryVerdicts> {
    const [a, b] = await Promise.all([
      this.runOne(SCORING.TRUST_MODEL_A, verificationContext),
      this.runOne(SCORING.TRUST_MODEL_B, verificationContext),
    ]);
    return { a, b };
  }

  private async runOne(model: string, context: string): Promise<SingleVerdict> {
    const groqApiKey = process.env.GROQ_API_KEY;
    if (!groqApiKey) {
      logToFile(`GROQ_API_KEY not set — ${model} verdict unavailable`);
      return { model, score: null, reasoning: 'Groq unavailable' };
    }
    const rateLimiter = getGroqRateLimitManager();
    if (!rateLimiter.canProceed()) {
      logToFile(`Rate limited — ${model} verdict unavailable`);
      return { model, score: null, reasoning: 'Groq rate limited' };
    }
    rateLimiter.record();

    const config: AIServiceConfig = {
      provider: 'groq',
      apiKey: groqApiKey,
      model,
      temperature: 0.2,
      maxTokens: 1024,
    };
    const service: IAIService = AIServiceFactory.createService(config);

    const messages: AIMessage[] = [
      { role: 'system', content: VERIFIER_SYSTEM_PROMPT },
      { role: 'user', content: context },
    ];

    try {
      const res = await service.generateResponse(
        messages,
        { conversationHistory: messages },
        VERIFIER_SYSTEM_PROMPT,
        { jsonMode: true }
      );
      const { score, reasoning } = parseVerdict(res.content);
      logToFile(`${model} -> score=${score}`);
      return { model, score, reasoning };
    } catch (err: any) {
      logToFile(`${model} failed: ${err.message}`);
      return { model, score: null, reasoning: `Verifier error: ${err.message}` };
    }
  }
}

/** Tolerant parse of {"trust_score","reasoning"} from a model response. */
export function parseVerdict(content: string): { score: number | null; reasoning: string } {
  const scoreMatch = content.match(/"trust_score"\s*:\s*(\d+(?:\.\d+)?)/);
  const reasonMatch = content.match(/"reasoning"\s*:\s*"([^"]*)"/);
  const score = scoreMatch ? Math.max(0, Math.min(100, Math.round(parseFloat(scoreMatch[1])))) : null;
  return { score, reasoning: reasonMatch ? reasonMatch[1] : 'No reasoning provided' };
}
