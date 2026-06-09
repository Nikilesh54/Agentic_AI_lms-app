import { SCORING } from '../../config/constants';

/**
 * Map a raw cosine similarity (0..1) to a calibrated 0..100 score using
 * piecewise-linear interpolation between SCORING.COSINE_ANCHORS.
 * Related BGE text sits ~0.6-0.75, so linear *100 under-rates grounding — this fixes that.
 */
export function calibrateCosine(cosine: number): number {
  const anchors = [...SCORING.COSINE_ANCHORS].sort((a, b) => a.cosine - b.cosine);

  if (cosine <= anchors[0].cosine) return anchors[0].score;
  if (cosine >= anchors[anchors.length - 1].cosine) return anchors[anchors.length - 1].score;

  for (let i = 0; i < anchors.length - 1; i++) {
    const lo = anchors[i];
    const hi = anchors[i + 1];
    if (cosine >= lo.cosine && cosine <= hi.cosine) {
      const t = (cosine - lo.cosine) / (hi.cosine - lo.cosine);
      const interpolated = lo.score + t * (hi.score - lo.score);
      // Nudge by a tiny epsilon so true half-values (e.g. 62.5) round up as
      // intended; without it, float error can leave them at 62.4999… -> 62.
      return Math.round(interpolated + 1e-9);
    }
  }
  return 50; // unreachable
}
