# Trust & Validation Score Rework — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the trust score and validation score actually measure what they claim, by fixing the broken cosine-similarity signal, fully separating the two scores, and replacing the single LLM verifier with a two-model Groq jury (Qwen + Llama).

**Architecture:** Two independent, interpretable badges. **Validation score** = sentence-level max-pooled cosine similarity of the chatbot *response* against course-material chunks (deterministic, RAGAS-faithfulness style), with a calibrated cosine→score curve. **Trust score** = two Groq models (`qwen/qwen3-32b` and `llama-3.3-70b-versatile`) independently verify the answer-vs-sources, then reconcile (average if they agree within 30 points; otherwise take the min and flag disagreement). The two scores are decoupled, plus a guard: a very low validation score caps/warns on a high trust score so a confident-but-ungrounded answer can't read as trustworthy.

**Tech Stack:** TypeScript, Node, Express, pgvector (Postgres), `@xenova/transformers` (BGE local embeddings), `groq-sdk`. New dev dependency: `vitest` (for the two pure-function units only). Other verification is via standalone `ts-node` scripts (the repo's existing pattern — see `scripts/reindexEmbeddings.ts`).

---

## Why the scores are bad today (root cause — read before starting)

Five confirmed defects, in priority order:

1. **`getVectorSimilarityScores` (`EnhancedIntegrityVerificationAgent.ts:390-425`) is broken.** Its SQL compares every chunk against *one arbitrary chunk* (`LIMIT 1`, no ordering) and **never uses the `responseText` parameter**. So the "validation" cosine signal is noise. This signal carries weight `0.40` in the trust calculator. **This is the validation score itself — it has never measured response-vs-document similarity.**
2. **Fact-check score hardcoded to `null`** (`EnhancedIntegrityVerificationAgent.ts:348`). The `0.40` cross-model weight always collapses to neutral-50.
3. **BGE query prefix missing** (`embeddingService.ts`). `Xenova/bge-base-en-v1.5` needs queries prefixed with `Represent this sentence for searching relevant passages: ` while documents stay raw. Both are embedded raw today → degraded retrieval → low cosines everywhere. Documents were embedded raw (`reindexEmbeddings.ts:86`, `documentProcessor.ts`), so the fix is **query-side only, no re-index**.
4. **Dead deterministic signals** in `TrustScoreCalculator.ts` — `calculateSourceRetrievalScore` / `calculateClaimCoverageScore` are never called; the docstring's 5-component formula doesn't match the 3-key `weights` object.
5. **Silent model substitution** (`getVerificationAIService:287-315`) — falls back to Gemini when Groq is unavailable, so "trust" silently stops being a Groq cross-check.

**Net effect today:** trust ≈ `0.40 × noise + 0.20 × AI-verdict + 0.40 × neutral-50` → low (A), uncorrelated (B), occasionally high-on-garbage (C). Exactly the reported symptoms.

---

## Design decisions (locked during grilling)

- **Validation score** = response→document groundedness, **sentence-level max-pooling** (RAGAS faithfulness style): split response into sentences, embed each (BGE, *query-prefixed*), take each sentence's best-matching course-chunk cosine. **Mean of per-sentence maxes = validation score; min of per-sentence maxes = hallucination detector.**
- **Calibrated cosine→score curve** (not linear `×100`): related BGE text sits at ~0.6–0.75 cosine, so linear under-rates good grounding.
- **Trust score** = Qwen3-32B + Llama-3.3-70B jury, decoupled from validation (no cosine mixed in).
- **Reconciliation:** gap ≤ 30 → average; gap > 30 → `min` + `verifiers_disagree: true`.
- **Display:** two separate badges + low-validation guard (very low validation warns on a high trust score).
- **Migration:** forward-only; new nullable columns.
- **BGE fix:** query-side prefix only, no re-index.

---

## File Structure

**New files:**
- `backend/src/services/scoring/cosineCalibration.ts` — pure: maps a raw cosine (0–1) to a calibrated 0–100 score. One responsibility.
- `backend/src/services/scoring/validationScore.ts` — computes the sentence-level max-pooled validation score for a response against a course's chunks.
- `backend/src/services/scoring/juryReconciliation.ts` — pure: reconciles two verifier scores into `{ trust_score, verifiers_disagree }`.
- `backend/src/services/agents/TwoModelVerifier.ts` — runs Qwen + Llama verification passes and returns both raw verdicts.
- `backend/src/db/migrations/0XX-add-validation-score.sql` — adds `validation_score`, `verifiers_disagree` columns.
- `backend/vitest.config.ts` — minimal vitest config (pure-function tests only).
- `backend/src/services/scoring/__tests__/cosineCalibration.test.ts`
- `backend/src/services/scoring/__tests__/juryReconciliation.test.ts`
- `backend/scripts/verify-validation-score.ts` — standalone ts-node harness to eyeball validation scores against your ground-truth docs.

**Modified files:**
- `backend/src/services/embeddingService.ts` — add `embedQuery()` (prefixed) vs keep `generateEmbedding()` (raw, for docs).
- `backend/src/vectorSearch.ts` — use `embedQuery()` for the search query.
- `backend/src/services/agents/EnhancedIntegrityVerificationAgent.ts` — delete broken `getVectorSimilarityScores`; call real validation; use `TwoModelVerifier`; apply guard; persist validation + disagreement.
- `backend/src/services/agents/TrustScoreCalculator.ts` — repurpose into trust-only (jury) or retire (see Task 7); remove dead methods.
- `backend/src/config/constants.ts` — add `SCORING` config block (models, threshold, calibration anchors, guard threshold).
- `backend/src/routes/chat.ts` — pass `relevantMaterials` similarity context + persist new fields; expose them in the metadata GET.
- `frontend/.../MessageMetadata.tsx` + `agenticai.ts` — render two badges + disagreement/guard warning.

---

## Task 0: Branch + scoring config + vitest scaffold

**Files:**
- Create: `backend/vitest.config.ts`
- Modify: `backend/package.json` (scripts + devDeps)
- Modify: `backend/src/config/constants.ts`

- [ ] **Step 1: Create a branch**

```bash
cd Agentic_AI_lms-app
git checkout -b feat/trust-validation-rework
```

- [ ] **Step 2: Add vitest + scripts to `backend/package.json`**

In `"devDependencies"` add `"vitest": "^2.1.0"`. In `"scripts"` replace the stub test line with:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Install**

```bash
cd backend && npm install
```

- [ ] **Step 4: Create `backend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    environment: 'node',
  },
});
```

- [ ] **Step 5: Add a `SCORING` block to `backend/src/config/constants.ts`**

Append before the `HELPER FUNCTIONS` section:

```ts
// =====================================================
// SCORING CONFIGURATION (Validation + Trust)
// =====================================================
export const SCORING = {
  /** BGE retrieval query prefix — REQUIRED for bge-base-en-v1.5 queries. Documents stay raw. */
  BGE_QUERY_PREFIX: 'Represent this sentence for searching relevant passages: ',

  /** Two-model Groq jury for the trust score */
  TRUST_MODEL_A: process.env.TRUST_MODEL_A || 'qwen/qwen3-32b',
  TRUST_MODEL_B: process.env.TRUST_MODEL_B || 'llama-3.3-70b-versatile',

  /** If |scoreA - scoreB| > this, verifiers "disagree": take min + flag */
  JURY_DISAGREEMENT_THRESHOLD: 30,

  /** Calibration anchors: raw cosine -> calibrated 0-100. Piecewise-linear between anchors. */
  COSINE_ANCHORS: [
    { cosine: 0.30, score: 10 },
    { cosine: 0.50, score: 50 },
    { cosine: 0.65, score: 75 },
    { cosine: 0.75, score: 90 },
    { cosine: 0.85, score: 100 },
  ] as Array<{ cosine: number; score: number }>,

  /** Validation below this caps/warns on a high trust score (the low-validation guard) */
  LOW_VALIDATION_GUARD: 40,

  /** Max sentences from a response to embed for validation (cost cap) */
  MAX_RESPONSE_SENTENCES: 25,

  /** Sentences shorter than this (chars) are ignored for validation */
  MIN_SENTENCE_CHARS: 25,
} as const;
```

- [ ] **Step 6: Commit**

```bash
git add backend/vitest.config.ts backend/package.json backend/package-lock.json backend/src/config/constants.ts
git commit -m "chore: add vitest + SCORING config block for score rework"
```

---

## Task 1: BGE query-prefix fix (no re-index)

**Files:**
- Modify: `backend/src/services/embeddingService.ts`
- Modify: `backend/src/vectorSearch.ts`

- [ ] **Step 1: Confirm documents are embedded raw (assumption check)**

Run:

```bash
cd backend && npx ts-node -e "import('./src/services/embeddingService').then(()=>console.log('ok'))" 2>/dev/null; grep -n "generateEmbedding" src/scripts/reindexEmbeddings.ts src/services/documentProcessor.ts
```

Expected: both indexing paths call `generateEmbedding`/`generateEmbeddings` with **no prefix string**. (If a prefix is found in document indexing, STOP — the query-side-only approach is invalid and a full re-index is required instead.)

- [ ] **Step 2: Add `embedQuery()` to `embeddingService.ts`**

Add after `generateEmbeddingCached` (keep `generateEmbedding` exactly as-is for documents):

```ts
import { SCORING } from '../config/constants';

/**
 * Embed a *query* (or response sentence) for retrieval.
 * BGE bge-base-en-v1.5 requires the asymmetric query prefix; documents stay raw.
 * Uses the same cache, keyed on the prefixed text so it never collides with doc embeddings.
 */
export async function embedQuery(text: string, useCache: boolean = true): Promise<number[]> {
  const prefixed = SCORING.BGE_QUERY_PREFIX + text;
  return generateEmbeddingCached(prefixed, useCache);
}
```

- [ ] **Step 3: Use `embedQuery` in `vectorSearch.ts`**

In `vectorSearch.ts`, change the import:

```ts
import { embedQuery, embeddingToPostgresVector } from './embeddingService';
```

Then in **both** `searchCourseMaterials` and `searchSpecificMaterials`, replace:

```ts
const queryEmbedding = await generateEmbeddingCached(query, true);
```

with:

```ts
const queryEmbedding = await embedQuery(query, true);
```

(There are two occurrences — one per function. `findSimilarChunks` uses a stored embedding directly and must NOT change.)

- [ ] **Step 4: Build to typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Smoke-test retrieval improvement (optional but recommended)**

Run a quick query against a known course id (replace `1`) and eyeball that top similarity rises vs. before:

```bash
npx ts-node -e "import('./src/vectorSearch').then(async m=>{const r=await m.searchCourseMaterials(1,'<a question you know is answered in the docs>',{topK:5,minSimilarity:0});console.log(r.map(x=>x.similarity_score));process.exit(0)})"
```

Expected: top score noticeably higher than an un-prefixed run (BGE prefix typically lifts query→doc cosine by ~0.05–0.15).

- [ ] **Step 6: Commit**

```bash
git add src/services/embeddingService.ts src/vectorSearch.ts
git commit -m "fix: add BGE query prefix for retrieval (query-side only, docs stay raw)"
```

---

## Task 2: Cosine calibration (pure, TDD)

**Files:**
- Create: `backend/src/services/scoring/cosineCalibration.ts`
- Test: `backend/src/services/scoring/__tests__/cosineCalibration.test.ts`

- [ ] **Step 1: Write the failing test**

`backend/src/services/scoring/__tests__/cosineCalibration.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { calibrateCosine } from '../cosineCalibration';

describe('calibrateCosine', () => {
  it('maps anchor points exactly', () => {
    expect(calibrateCosine(0.30)).toBe(10);
    expect(calibrateCosine(0.50)).toBe(50);
    expect(calibrateCosine(0.65)).toBe(75);
    expect(calibrateCosine(0.75)).toBe(90);
    expect(calibrateCosine(0.85)).toBe(100);
  });

  it('interpolates linearly between anchors', () => {
    // halfway between 0.50(50) and 0.65(75) is 0.575 -> 62.5 -> 63 (rounded)
    expect(calibrateCosine(0.575)).toBe(63);
  });

  it('clamps below the lowest anchor', () => {
    expect(calibrateCosine(0.0)).toBe(10);
    expect(calibrateCosine(-0.2)).toBe(10);
  });

  it('clamps above the highest anchor', () => {
    expect(calibrateCosine(0.95)).toBe(100);
    expect(calibrateCosine(1.0)).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx vitest run src/services/scoring/__tests__/cosineCalibration.test.ts
```

Expected: FAIL — `calibrateCosine` not found.

- [ ] **Step 3: Implement `cosineCalibration.ts`**

```ts
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
      return Math.round(lo.score + t * (hi.score - lo.score));
    }
  }
  return 50; // unreachable
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx vitest run src/services/scoring/__tests__/cosineCalibration.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/scoring/cosineCalibration.ts src/services/scoring/__tests__/cosineCalibration.test.ts
git commit -m "feat: calibrated cosine->score mapping (pure, tested)"
```

---

## Task 3: Jury reconciliation (pure, TDD)

**Files:**
- Create: `backend/src/services/scoring/juryReconciliation.ts`
- Test: `backend/src/services/scoring/__tests__/juryReconciliation.test.ts`

- [ ] **Step 1: Write the failing test**

`backend/src/services/scoring/__tests__/juryReconciliation.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd backend && npx vitest run src/services/scoring/__tests__/juryReconciliation.test.ts
```

Expected: FAIL — `reconcileJury` not found.

- [ ] **Step 3: Implement `juryReconciliation.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd backend && npx vitest run src/services/scoring/__tests__/juryReconciliation.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/scoring/juryReconciliation.ts src/services/scoring/__tests__/juryReconciliation.test.ts
git commit -m "feat: two-verifier jury reconciliation (avg<=30 gap, else min+flag)"
```

---

## Task 4: Validation score — sentence-level max-pooling (the real cosine signal)

**Files:**
- Create: `backend/src/services/scoring/validationScore.ts`
- Create: `backend/scripts/verify-validation-score.ts`

- [ ] **Step 1: Implement `validationScore.ts`**

This is the replacement for the broken `getVectorSimilarityScores`. It embeds each response sentence (query-prefixed) and finds its best-matching course chunk via pgvector.

```ts
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
```

- [ ] **Step 2: Typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Create the standalone verification harness `backend/scripts/verify-validation-score.ts`**

```ts
/**
 * Manual harness: score a known response against a course and print the breakdown.
 * Usage: npx ts-node scripts/verify-validation-score.ts <courseId> "<response text>"
 */
import { computeValidationScore } from '../src/services/scoring/validationScore';

async function main() {
  const courseId = parseInt(process.argv[2], 10);
  const response = process.argv[3];
  if (!courseId || !response) {
    console.error('Usage: npx ts-node scripts/verify-validation-score.ts <courseId> "<response>"');
    process.exit(1);
  }
  const result = await computeValidationScore(response, courseId);
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
main();
```

- [ ] **Step 4: Run the harness against ground truth**

Pick a response you KNOW is well-grounded in a course's docs, and one you know is fabricated:

```bash
cd backend && npx ts-node scripts/verify-validation-score.ts <courseId> "<a grounded answer>"
npx ts-node scripts/verify-validation-score.ts <courseId> "<a fabricated answer>"
```

Expected: grounded answer → `validationScore` high (≥75) and `minSentenceScore` not catastrophically low; fabricated → noticeably lower `validationScore`, and `minSentenceScore` near the floor. If grounded answers score low, revisit `COSINE_ANCHORS` in constants (raise/lower anchors) — this is the calibration knob.

- [ ] **Step 5: Commit**

```bash
git add src/services/scoring/validationScore.ts scripts/verify-validation-score.ts
git commit -m "feat: real response->document validation score (sentence-level max-pooling)"
```

---

## Task 5: Two-model Groq jury verifier

**Files:**
- Create: `backend/src/services/agents/TwoModelVerifier.ts`
- Reference: `backend/src/services/ai/AIServiceFactory.ts`, `backend/src/services/ai/types.ts`, `backend/src/services/ai/providers/GroqAIService.ts`

- [ ] **Step 1: Read the AI service interface to match signatures**

```bash
cd backend && grep -n "generateResponse\|interface IAIService\|provider" src/services/ai/types.ts src/services/ai/AIServiceFactory.ts
```

Note the exact `IAIService.generateResponse` signature and `AIServiceConfig` shape (used below). The existing single-verifier call is `EnhancedIntegrityVerificationAgent.ts:160-166` — mirror it.

- [ ] **Step 2: Implement `TwoModelVerifier.ts`**

```ts
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
```

- [ ] **Step 3: Add a focused test for `parseVerdict`**

`backend/src/services/agents/__tests__/parseVerdict.test.ts`:

```ts
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
```

- [ ] **Step 4: Run the test**

```bash
cd backend && npx vitest run src/services/agents/__tests__/parseVerdict.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors. (If `AIServiceConfig`/`generateResponse` signatures differ from Step 1's findings, adjust to match — do not invent fields.)

- [ ] **Step 6: Commit**

```bash
git add src/services/agents/TwoModelVerifier.ts src/services/agents/__tests__/parseVerdict.test.ts
git commit -m "feat: two-model Groq jury verifier (Qwen + Llama, no Gemini fallback)"
```

---

## Task 6: DB migration — validation_score + verifiers_disagree

**Files:**
- Create: `backend/src/db/migrations/0XX-add-validation-score.sql` (use the next number in the folder)
- Reference: `backend/src/db/migrations/runMigrations.ts`

- [ ] **Step 1: Find the next migration number**

```bash
cd backend && ls src/db/migrations/*.sql
```

Use the next sequential prefix (e.g. if the highest is `012-...`, name yours `013-add-validation-score.sql`).

- [ ] **Step 2: Write the migration (forward-only, nullable)**

```sql
-- Add separate validation score + verifier-disagreement flag to trust scores.
-- Forward-only: existing rows keep NULL validation_score (shown as "not computed").
ALTER TABLE message_trust_scores
  ADD COLUMN IF NOT EXISTS validation_score INTEGER,
  ADD COLUMN IF NOT EXISTS validation_min_sentence_score INTEGER,
  ADD COLUMN IF NOT EXISTS verifiers_disagree BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS low_validation_warning BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN message_trust_scores.validation_score IS 'Response->document cosine groundedness (0-100), sentence-level max-pooled';
COMMENT ON COLUMN message_trust_scores.verifiers_disagree IS 'True when the two Groq verifiers disagreed by > threshold';
COMMENT ON COLUMN message_trust_scores.low_validation_warning IS 'True when validation < guard while trust was high';
```

- [ ] **Step 3: Run migrations**

```bash
cd backend && npx ts-node src/db/migrations/runMigrations.ts
```

Expected: migration applies cleanly; rerunning is a no-op (idempotent via `IF NOT EXISTS`).

- [ ] **Step 4: Verify columns exist**

```bash
cd backend && npx ts-node -e "import('./src/config/database').then(async ({pool})=>{const r=await pool.query(\"SELECT column_name FROM information_schema.columns WHERE table_name='message_trust_scores'\");console.log(r.rows.map(x=>x.column_name));process.exit(0)})"
```

Expected: list includes `validation_score`, `validation_min_sentence_score`, `verifiers_disagree`, `low_validation_warning`.

- [ ] **Step 5: Commit**

```bash
git add src/db/migrations/0XX-add-validation-score.sql
git commit -m "feat(db): add validation_score + verifiers_disagree columns (forward-only)"
```

---

## Task 7: Rewire `EnhancedIntegrityVerificationAgent` — wire jury + validation + guard

**Files:**
- Modify: `backend/src/services/agents/EnhancedIntegrityVerificationAgent.ts`
- Delete dead code: `getVectorSimilarityScores`, and the `TrustScoreCalculator` usage in `applyHybridScoring`.

- [ ] **Step 1: Add imports at top of the file**

```ts
import { TwoModelVerifier } from './TwoModelVerifier';
import { reconcileJury } from '../scoring/juryReconciliation';
import { computeValidationScore } from '../scoring/validationScore';
import { SCORING } from '../../config/constants';
```

(Remove the now-unused `import { TrustScoreCalculator, SourceVerificationResult } from './TrustScoreCalculator';`.)

- [ ] **Step 2: Replace the verification call in `verifyResponse`**

Find the retry block (`EnhancedIntegrityVerificationAgent.ts:125-196`) that builds `messages` and calls `verificationService.generateResponse(...)`. Replace the single-model call with the two-model jury. Inside the loop, after `buildVerificationContext(...)`, replace the `messages`/`getVerificationAIService`/`generateResponse` section with:

```ts
const verifier = new TwoModelVerifier();
const verdicts = await verifier.verify(verificationContext);
const jury = reconcileJury(verdicts.a.score, verdicts.b.score);

logToFile(`Jury: ${verdicts.a.model}=${verdicts.a.score}, ${verdicts.b.model}=${verdicts.b.score} ` +
  `-> trust=${jury.trust_score} disagree=${jury.verifiers_disagree}`);

verificationResult = {
  trust_score: jury.trust_score,
  trust_level: this.determineTrustLevel(jury.trust_score),
  reasoning: `Qwen: ${verdicts.a.reasoning} | Llama: ${verdicts.b.reasoning}`,
  verification_details: [],
  hallucinations_detected: [],
  recommendations: jury.verifiers_disagree
    ? 'The two verifiers disagreed; treat this answer with extra caution and confirm against sources.'
    : 'Review the cited sources to confirm accuracy.',
  evidence_summary: `Two-model jury (${verdicts.a.model} + ${verdicts.b.model}).`,
};
(verificationResult as any).verifiers_disagree = jury.verifiers_disagree;

if (verificationResult.trust_score !== null && verificationResult.trust_score !== undefined) {
  logToFile(`Jury verification succeeded on attempt ${attempt}`);
  break;
}
```

(Keep the surrounding retry/`catch`/backoff scaffolding. The jury already runs both models in parallel; retries now cover transient Groq failures.)

- [ ] **Step 3: Replace `applyHybridScoring` with validation + guard**

Replace the entire body of `applyHybridScoring` (`:321-384`) so it computes the **real** validation score and applies the low-validation guard, instead of the old `TrustScoreCalculator` + broken similarity:

```ts
private async applyHybridScoring(
  aiResult: EnhancedTrustScoreResult,
  verifiedSources: VerifiedSource[],
  chatbotResponse: string,
  courseId: number
): Promise<{
  trust_score: number;
  trust_level: TrustLevel;
  reasoning: string;
  evidence_summary: string;
  validation_score: number;
  validation_min_sentence_score: number;
  low_validation_warning: boolean;
}> {
  let validation = { validationScore: 50, minSentenceScore: 50, sentencesScored: 0 } as
    { validationScore: number; minSentenceScore: number; sentencesScored: number };
  try {
    const v = await computeValidationScore(chatbotResponse, courseId);
    validation = v;
    logToFile(`Validation: score=${v.validationScore} min=${v.minSentenceScore} sentences=${v.sentencesScored}`);
  } catch (err: any) {
    logToFile(`Validation scoring failed (non-blocking): ${err.message}`);
  }

  // Low-validation guard: ungrounded answer must not read as highly trustworthy.
  const lowValidationWarning =
    validation.validationScore < SCORING.LOW_VALIDATION_GUARD && aiResult.trust_score >= 70;

  const reasoning = lowValidationWarning
    ? `${aiResult.reasoning} ⚠️ Low grounding in course materials (validation ${validation.validationScore}/100) — verify independently.`
    : aiResult.reasoning;

  return {
    trust_score: aiResult.trust_score, // trust stays the jury verdict — decoupled from validation
    trust_level: aiResult.trust_level,
    reasoning,
    evidence_summary: `${aiResult.evidence_summary} Validation (response↔docs): ${validation.validationScore}/100.`,
    validation_score: validation.validationScore,
    validation_min_sentence_score: validation.minSentenceScore,
    low_validation_warning: lowValidationWarning,
  };
}
```

- [ ] **Step 4: Carry the new fields through `verifyResponse`**

Where `verifyResponse` merges `hybridResult` (`:211-215`), extend it:

```ts
const hybridResult = await this.applyHybridScoring(
  verificationResult, verifiedSources, chatbotResponse, courseId
);
verificationResult.trust_score = hybridResult.trust_score;
verificationResult.trust_level = hybridResult.trust_level;
verificationResult.reasoning = hybridResult.reasoning;
verificationResult.evidence_summary = hybridResult.evidence_summary;
(verificationResult as any).validation_score = hybridResult.validation_score;
(verificationResult as any).validation_min_sentence_score = hybridResult.validation_min_sentence_score;
(verificationResult as any).low_validation_warning = hybridResult.low_validation_warning;
```

- [ ] **Step 5: Delete `getVectorSimilarityScores` entirely**

Remove the whole method (`:386-425`). It is no longer referenced. Confirm:

```bash
cd backend && grep -rn "getVectorSimilarityScores" src/
```

Expected: no matches.

- [ ] **Step 6: Persist the new fields in `storeTrustScore`**

Update the `INSERT ... ON CONFLICT` in `storeTrustScore` (`:1159-1193`) to write the new columns:

```ts
const query = `
  INSERT INTO message_trust_scores (
    message_id, trust_score, trust_level, verification_reasoning,
    source_verification_details, conflicts_detected,
    validation_score, validation_min_sentence_score, verifiers_disagree, low_validation_warning
  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
  ON CONFLICT (message_id) DO UPDATE SET
    trust_score = EXCLUDED.trust_score,
    trust_level = EXCLUDED.trust_level,
    verification_reasoning = EXCLUDED.verification_reasoning,
    source_verification_details = EXCLUDED.source_verification_details,
    conflicts_detected = EXCLUDED.conflicts_detected,
    validation_score = EXCLUDED.validation_score,
    validation_min_sentence_score = EXCLUDED.validation_min_sentence_score,
    verifiers_disagree = EXCLUDED.verifiers_disagree,
    low_validation_warning = EXCLUDED.low_validation_warning,
    verification_timestamp = CURRENT_TIMESTAMP
`;
await pool.query(query, [
  messageId,
  verification.trust_score,
  verification.trust_level,
  verification.reasoning,
  JSON.stringify({
    verification_details: verification.verification_details,
    evidence_summary: verification.evidence_summary,
  }),
  verification.hallucinations_detected,
  (verification as any).validation_score ?? null,
  (verification as any).validation_min_sentence_score ?? null,
  (verification as any).verifiers_disagree ?? false,
  (verification as any).low_validation_warning ?? false,
]);
```

- [ ] **Step 7: Typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/services/agents/EnhancedIntegrityVerificationAgent.ts
git commit -m "feat: jury trust + real validation + low-validation guard; remove broken similarity"
```

---

## Task 8: Retire `TrustScoreCalculator` dead code

**Files:**
- Modify/Delete: `backend/src/services/agents/TrustScoreCalculator.ts`

- [ ] **Step 1: Confirm it is no longer imported**

```bash
cd backend && grep -rn "TrustScoreCalculator" src/
```

Expected: no matches after Task 7 (the only importer was the integrity agent).

- [ ] **Step 2: Delete the file**

```bash
cd backend && git rm src/services/agents/TrustScoreCalculator.ts
```

(If `grep` in Step 1 shows any remaining importer, instead keep the file and only delete the dead `calculateSourceRetrievalScore` and `calculateClaimCoverageScore` methods. Default action is deletion.)

- [ ] **Step 3: Typecheck**

```bash
cd backend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: remove dead TrustScoreCalculator (superseded by jury + validation)"
```

---

## Task 9: API — expose validation + disagreement in the metadata route

**Files:**
- Modify: `backend/src/routes/chat.ts` (the trust-score GET around `:1012-1023`)

- [ ] **Step 1: Locate the metadata GET**

```bash
cd backend && grep -n "message_trust_scores\|trust_score\|factCheck" src/routes/chat.ts
```

Find the handler that selects from `message_trust_scores` and returns the badge data.

- [ ] **Step 2: Select and return the new columns**

In that handler's `SELECT`, ensure it selects `*` or explicitly add `validation_score, validation_min_sentence_score, verifiers_disagree, low_validation_warning`. Then include them in the JSON response object, e.g.:

```ts
res.json({
  trustScore: row.trust_score,
  trustLevel: row.trust_level,
  reasoning: row.verification_reasoning,
  validationScore: row.validation_score,            // may be null for old messages
  validationMinSentence: row.validation_min_sentence_score,
  verifiersDisagree: row.verifiers_disagree,
  lowValidationWarning: row.low_validation_warning,
  // ...existing fields (factCheck, details) unchanged
});
```

(Match the existing response shape/casing in this file — adapt keys to whatever the frontend already consumes.)

- [ ] **Step 3: Typecheck + manual GET**

```bash
cd backend && npx tsc --noEmit
```

Then run the server (`npm run dev`) and hit the metadata endpoint for a freshly-generated message; confirm `validationScore` and `verifiersDisagree` appear.

- [ ] **Step 4: Commit**

```bash
git add src/routes/chat.ts
git commit -m "feat(api): expose validation score + verifier disagreement in message metadata"
```

---

## Task 10: Frontend — two badges + warnings

**Files:**
- Modify: `frontend/.../MessageMetadata.tsx`
- Modify: `frontend/.../agenticai.ts` (types + display helpers)

- [ ] **Step 1: Locate the files**

```bash
cd Agentic_AI_lms-app && grep -rn "trustScore\|trust_score\|MessageMetadata" frontend/src | head
```

- [ ] **Step 2: Extend the TS type in `agenticai.ts`**

Add to whatever interface models the trust metadata:

```ts
validationScore?: number | null;
validationMinSentence?: number | null;
verifiersDisagree?: boolean;
lowValidationWarning?: boolean;
```

Add a small helper for the validation badge color (mirror the existing trust-level helper):

```ts
export function validationLabel(score?: number | null): { label: string; tone: 'good' | 'warn' | 'bad' | 'none' } {
  if (score === null || score === undefined) return { label: 'Validation: n/a', tone: 'none' };
  if (score >= 75) return { label: `Validation ${score}`, tone: 'good' };
  if (score >= 50) return { label: `Validation ${score}`, tone: 'warn' };
  return { label: `Validation ${score}`, tone: 'bad' };
}
```

- [ ] **Step 3: Render the second badge in `MessageMetadata.tsx`**

Next to the existing trust badge, render a validation badge using `validationLabel(meta.validationScore)`. Below them, conditionally render warnings:

```tsx
{meta.verifiersDisagree && (
  <span className="badge-warn">Verifiers disagreed — extra caution</span>
)}
{meta.lowValidationWarning && (
  <span className="badge-warn">Answer weakly grounded in course materials</span>
)}
```

(Use the existing badge components/classes in this file — match the current trust badge's markup; don't introduce a new design system.)

- [ ] **Step 4: Build the frontend**

```bash
cd Agentic_AI_lms-app/frontend && npm run build
```

Expected: builds without type errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src
git commit -m "feat(ui): show separate validation badge + disagreement/low-grounding warnings"
```

---

## Task 11: End-to-end verification against ground truth

**Files:** none (verification only)

- [ ] **Step 1: Run the full unit suite**

```bash
cd Agentic_AI_lms-app/backend && npx vitest run
```

Expected: all tests pass (cosineCalibration, juryReconciliation, parseVerdict).

- [ ] **Step 2: Start backend + frontend**

```bash
cd Agentic_AI_lms-app/backend && npm run dev
# separate terminal:
cd Agentic_AI_lms-app/frontend && npm run dev
```

- [ ] **Step 3: Ground-truth pass**

Ask the chatbot 3 questions you have ground truth for:
1. A question well-answered by the docs → expect **high validation, high trust, no warnings.**
2. A question where you force/observe a hallucinated detail → expect **low `validation_min_sentence_score`, low validation, and either low trust or `low_validation_warning`.**
3. A borderline/partial question → expect **mid validation; check whether the two verifiers disagree.**

Inspect `api-debug.log` for the `Jury:` and `Validation:` lines to confirm both models ran and the numbers are sane.

- [ ] **Step 4: Tune if needed**

- Grounded answers scoring too low → raise `COSINE_ANCHORS` scores (e.g. 0.65→80) in `constants.ts`.
- Too many false "disagree" flags → raise `JURY_DISAGREEMENT_THRESHOLD`.
- Guard too aggressive/lenient → adjust `LOW_VALIDATION_GUARD`.

Re-run Step 3 after any change. These are config-only — no code changes.

- [ ] **Step 5: Final commit (if tuning changed config)**

```bash
git add backend/src/config/constants.ts
git commit -m "chore: tune scoring anchors/thresholds against ground truth"
```

- [ ] **Step 6: Finish the branch**

Use `superpowers:finishing-a-development-branch` to decide merge/PR/cleanup.

---

## Self-Review notes

- **Spec coverage:** All five root-cause defects are addressed — broken similarity (Task 4 + Task 7 deletion), null factcheck weight (removed by decoupling, Task 7), BGE prefix (Task 1), dead calculator (Task 8), silent Gemini fallback (Task 5, no fallback). Both display badges + guard (Tasks 9–10). Forward-only migration (Task 6).
- **Type consistency:** `reconcileJury(a,b) -> {trust_score, verifiers_disagree}`, `computeValidationScore -> {validationScore, minSentenceScore, perSentenceCosines, sentencesScored}`, `parseVerdict -> {score, reasoning}`, `TwoModelVerifier.verify -> {a,b}` of `SingleVerdict`. DB columns `validation_score / validation_min_sentence_score / verifiers_disagree / low_validation_warning` are consistent across migration (Task 6), persistence (Task 7 Step 6), API (Task 9), frontend (Task 10).
- **Known adaptation point:** Task 5 Step 1/Step 5 require matching the real `IAIService.generateResponse` / `AIServiceConfig` signatures; the plan instructs to adapt rather than invent. Task 9/10 instruct matching the existing response shape and badge components.
