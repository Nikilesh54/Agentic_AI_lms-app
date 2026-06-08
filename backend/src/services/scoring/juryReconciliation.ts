import { SCORING } from '../../config/constants';

export interface JuryResult {
  trust_score: number;       // 0-100
  verifiers_disagree: boolean;
}

/**
 * Reconcile two independent verifier scores into a single trust score.
 * - both present, gap <= threshold -> average
 * - both present, gap > threshold  -> min + disagreement flag
 * - one present                    -> that one (no disagreement signal possible)
 * - neither present                -> neutral 50
 */
export function reconcileJury(scoreA: number | null, scoreB: number | null): JuryResult {
  if (scoreA === null && scoreB === null) {
    return { trust_score: 50, verifiers_disagree: false };
  }
  if (scoreA === null) return { trust_score: clamp(scoreB!), verifiers_disagree: false };
  if (scoreB === null) return { trust_score: clamp(scoreA!), verifiers_disagree: false };

  const a = clamp(scoreA);
  const b = clamp(scoreB);
  const gap = Math.abs(a - b);

  if (gap > SCORING.JURY_DISAGREEMENT_THRESHOLD) {
    return { trust_score: Math.min(a, b), verifiers_disagree: true };
  }
  return { trust_score: Math.round((a + b) / 2), verifiers_disagree: false };
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}
