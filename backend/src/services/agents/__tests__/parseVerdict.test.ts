import { describe, it, expect } from 'vitest';
import { parseVerdict } from '../TwoModelVerifier';

describe('parseVerdict', () => {
  it('parses clean JSON', () => {
    expect(parseVerdict('{"trust_score": 82, "reasoning": "matches source"}'))
      .toEqual({ score: 82, reasoning: 'matches source' });
  });
  it('parses JSON buried in prose', () => {
    expect(parseVerdict('Here is my answer: {"trust_score": 40, "reasoning": "partial"} done').score).toBe(40);
  });
  it('returns null score when absent', () => {
    expect(parseVerdict('I cannot produce JSON').score).toBe(null);
  });
  it('clamps out-of-range scores', () => {
    expect(parseVerdict('{"trust_score": 250, "reasoning": "x"}').score).toBe(100);
  });
});
