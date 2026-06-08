import { pool } from '../../config/database';
import { embedQuery, embeddingToPostgresVector } from '../embeddingService';
import { calibrateCosine } from './cosineCalibration';
import { SCORING } from '../../config/constants';

export interface ValidationResult {
  /** Mean of per-sentence best-match cosines, calibrated 0-100. The headline validation score. */
  validationScore: number;
  /** Min per-sentence calibrated score — one ungrounded sentence drags this down (hallucination signal). */
  minSentenceScore: number;
  /** Raw per-sentence best cosines (0-1), for logging/debugging. */
  perSentenceCosines: number[];
  /** Number of sentences actually scored. */
  sentencesScored: number;
}

/**
 * Split a response into scorable sentences.
 * Drops very short fragments and caps the count for cost.
 */
export function splitIntoSentences(response: string): string[] {
  return response
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= SCORING.MIN_SENTENCE_CHARS)
    .slice(0, SCORING.MAX_RESPONSE_SENTENCES);
}

/**
 * Compute the response->document groundedness validation score.
 * For each response sentence: embed (query-prefixed) and take its single best-matching
 * course-material chunk cosine. Mean of those (calibrated) = validation score.
 */
export async function computeValidationScore(
  responseText: string,
  courseId: number
): Promise<ValidationResult> {
  const sentences = splitIntoSentences(responseText);

  if (sentences.length === 0) {
    return { validationScore: 50, minSentenceScore: 50, perSentenceCosines: [], sentencesScored: 0 };
  }

  const perSentenceCosines: number[] = [];

  for (const sentence of sentences) {
    const embedding = await embedQuery(sentence, true);
    const result = await pool.query(
      `SELECT MAX(1 - (cme.embedding <=> $1::vector)) AS best
         FROM course_material_embeddings cme
         JOIN course_materials cm ON cme.material_id = cm.id
        WHERE cm.course_id = $2`,
      [embeddingToPostgresVector(embedding), courseId]
    );
    const best = parseFloat(result.rows[0]?.best);
    perSentenceCosines.push(Number.isNaN(best) ? 0 : best);
  }

  const calibrated = perSentenceCosines.map(calibrateCosine);
  const mean = Math.round(calibrated.reduce((s, v) => s + v, 0) / calibrated.length);
  const min = Math.min(...calibrated);

  return {
    validationScore: mean,
    minSentenceScore: min,
    perSentenceCosines,
    sentencesScored: sentences.length,
  };
}
