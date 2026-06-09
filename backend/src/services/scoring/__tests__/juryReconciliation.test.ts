import { describe, it, expect } from 'vitest';
import { reconcileJury } from '../juryReconciliation';

describe('reconcileJury', () => {
  it('averages when the two scores agree (gap <= 30)', () => {
    const r = reconcileJury(80, 70);
    expect(r.trust_score).toBe(75);
    expect(r.verifiers_disagree).toBe(false);
  });

  it('uses min and flags when they disagree (gap > 30)', () => {
    const r = reconcileJury(90, 50);
    expect(r.trust_score).toBe(50);
    expect(r.verifiers_disagree).toBe(true);
  });

  it('treats a gap of exactly 30 as agreement', () => {
    const r = reconcileJury(80, 50);
    expect(r.trust_score).toBe(65);
    expect(r.verifiers_disagree).toBe(false);
  });

  it('falls back to the single available score when one verifier is null', () => {
    expect(reconcileJury(72, null)).toEqual({ trust_score: 72, verifiers_disagree: false });
    expect(reconcileJury(null, 64)).toEqual({ trust_score: 64, verifiers_disagree: false });
  });

  it('returns neutral 50 with no verdict when both are null', () => {
    expect(reconcileJury(null, null)).toEqual({ trust_score: 50, verifiers_disagree: false });
  });
});
