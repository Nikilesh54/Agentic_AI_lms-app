import { pool } from '../../config/database';
import { TRUST_SCORE } from '../../config/constants';
import fs from 'fs';
import path from 'path';

// File-only logging (no console output)
const LOG_PATH = path.join(__dirname, '../../../api-debug.log');
function logToFile(message: string) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(LOG_PATH, `[${timestamp}] [TrustCalc] ${message}\n`);
}

// =====================================================
// Types
// =====================================================

export interface TrustScoreInput {
    /** The chatbot's response text */
    chatbotResponse: string;

    /** Sources claimed by the chatbot */
    claimedSources: SourceVerificationResult[];

    /** AI verification result (from Groq/Gemini comparing claims vs source content) */
    aiVerificationScore: number | null;  // 0-100, null if AI verification failed

    /** Fact-check result from Groq (if available) */
    factCheckScore: number | null;  // 0-100, null if not available

    /** Vector similarity scores for the response chunks against course materials */
    vectorSimilarityScores: number[];  // Array of cosine similarities (0-1)

    /** AI confidence score from the chatbot */
    chatbotConfidence: number;  // 0-1
}

export interface SourceVerificationResult {
    sourceName: string;
    wasFoundInDB: boolean;           // Was the source material found in the database?
    wasContentRetrieved: boolean;    // Was actual content text retrieved?
    cosineSimilarity: number | null; // Cosine similarity between claim and source chunk
    verificationStatus: 'verified' | 'partially_verified' | 'unverified';
}

export interface TrustScoreBreakdown {
    /** Final weighted trust score (0-100) */
    finalScore: number;

    /** Trust level label */
    trustLevel: 'highest' | 'high' | 'medium' | 'lower' | 'low';

    /** Individual component scores */
    components: {
        sourceRetrievalScore: number;      // 0-100: % of sources found in DB
        semanticSimilarityScore: number;   // 0-100: avg cosine similarity * 100
        aiVerificationScore: number;       // 0-100: from AI comparison
        crossModelFactCheckScore: number;  // 0-100: from Groq fact-check
        claimCoverageScore: number;        // 0-100: % of claims with supporting sources
    };

    /** Weights applied to each component */
    weights: {
        sourceRetrieval: number;
        semanticSimilarity: number;
        aiVerification: number;
        crossModelFactCheck: number;
        claimCoverage: number;
    };

    /** Human-readable reasoning */
    reasoning: string;
}

// =====================================================
// Calculator
// =====================================================

/**
 * Hybrid Trust Score Calculator
 *
 * Combines deterministic signals (source retrieval, cosine similarity, claim coverage)
 * with AI-generated signals (verification score, fact-check score) into a single
 * weighted trust score.
 *
 * Formula:
 *   Trust = (0.30 × Source Retrieval)
 *         + (0.25 × Semantic Similarity)
 *         + (0.20 × AI Verification)
 *         + (0.15 × Cross-Model Fact-Check)
 *         + (0.10 × Claim Coverage)
 */
export class TrustScoreCalculator {

    // Default weights — can be adjusted via constructor
    private weights = {
        sourceRetrieval: 0.30,
        semanticSimilarity: 0.25,
        aiVerification: 0.20,
        crossModelFactCheck: 0.15,
        claimCoverage: 0.10
    };

    constructor(customWeights?: Partial<typeof TrustScoreCalculator.prototype.weights>) {
        if (customWeights) {
            this.weights = { ...this.weights, ...customWeights };
        }
    }

    /**
     * Calculate the hybrid trust score from all available signals
     */
    calculate(input: TrustScoreInput): TrustScoreBreakdown {
        const sourceRetrievalScore = this.calculateSourceRetrievalScore(input.claimedSources);
        const semanticSimilarityScore = this.calculateSemanticSimilarityScore(input.vectorSimilarityScores);
        const aiVerificationScore = this.normalizeAIScore(input.aiVerificationScore);
        const crossModelFactCheckScore = this.normalizeAIScore(input.factCheckScore);
        const claimCoverageScore = this.calculateClaimCoverageScore(input.claimedSources);

        // Adjust weights dynamically based on available signals
        const adjustedWeights = this.adjustWeights(input);

        // Calculate weighted sum
        const finalScore = Math.round(
            (adjustedWeights.sourceRetrieval * sourceRetrievalScore) +
            (adjustedWeights.semanticSimilarity * semanticSimilarityScore) +
            (adjustedWeights.aiVerification * aiVerificationScore) +
            (adjustedWeights.crossModelFactCheck * crossModelFactCheckScore) +
            (adjustedWeights.claimCoverage * claimCoverageScore)
        );

        // Clamp to 0-100
        const clampedScore = Math.max(0, Math.min(100, finalScore));

        const reasoning = this.buildReasoning(
            { sourceRetrievalScore, semanticSimilarityScore, aiVerificationScore, crossModelFactCheckScore, claimCoverageScore },
            adjustedWeights,
            input
        );

        logToFile(`Trust Score Breakdown: source=${sourceRetrievalScore}, similarity=${semanticSimilarityScore}, ` +
            `ai=${aiVerificationScore}, factcheck=${crossModelFactCheckScore}, coverage=${claimCoverageScore} → final=${clampedScore}`);

        return {
            finalScore: clampedScore,
            trustLevel: this.determineTrustLevel(clampedScore),
            components: {
                sourceRetrievalScore,
                semanticSimilarityScore,
                aiVerificationScore,
                crossModelFactCheckScore,
                claimCoverageScore
            },
            weights: adjustedWeights,
            reasoning
        };
    }

    /**
     * Source Retrieval Score (Deterministic)
     * What % of claimed sources were actually found in the database or successfully crawled?
     */
    private calculateSourceRetrievalScore(sources: SourceVerificationResult[]): number {
        if (sources.length === 0) return 50; // No sources claimed — neutral

        const foundCount = sources.filter(s => s.wasFoundInDB).length;
        const retrievedCount = sources.filter(s => s.wasContentRetrieved).length;

        // Weight: finding the source is 60%, retrieving content is 40%
        const foundRatio = foundCount / sources.length;
        const retrievedRatio = retrievedCount / sources.length;

        return Math.round((foundRatio * 60) + (retrievedRatio * 40));
    }

    /**
     * Semantic Similarity Score (Deterministic)
     * Average cosine similarity between response and top matched chunks
     */
    private calculateSemanticSimilarityScore(similarities: number[]): number {
        if (similarities.length === 0) return 50; // No similarity data — neutral

        // Filter out very low scores (noise)
        const meaningful = similarities.filter(s => s > 0.3);
        if (meaningful.length === 0) return 20; // All scores very low

        // Use weighted average: top scores matter more
        const sorted = meaningful.sort((a, b) => b - a);
        const topN = sorted.slice(0, Math.min(5, sorted.length));

        const avgSimilarity = topN.reduce((sum, s) => sum + s, 0) / topN.length;

        // Scale to 0-100 where:
        // 0.9+ → 95-100 (very high match)
        // 0.7-0.9 → 70-95 (good match)
        // 0.5-0.7 → 40-70 (partial match)
        // < 0.5 → 10-40 (weak match)
        return Math.round(avgSimilarity * 100);
    }

    /**
     * Normalize an AI-generated score, handling null/missing values
     */
    private normalizeAIScore(score: number | null): number {
        if (score === null || score === undefined) return 50; // No data — neutral
        return Math.max(0, Math.min(100, Math.round(score)));
    }

    /**
     * Claim Coverage Score (Deterministic)
     * What % of claimed sources have verified content (cosine similarity > 0.5)?
     */
    private calculateClaimCoverageScore(sources: SourceVerificationResult[]): number {
        if (sources.length === 0) return 50; // No sources — neutral

        const coveredCount = sources.filter(s =>
            s.verificationStatus === 'verified' &&
            (s.cosineSimilarity === null || s.cosineSimilarity > 0.5)
        ).length;

        return Math.round((coveredCount / sources.length) * 100);
    }

    /**
     * Dynamically adjust weights based on what signals are available
     * If AI verification or fact-check is missing, redistribute their weight
     * to the deterministic signals.
     */
    private adjustWeights(input: TrustScoreInput): typeof this.weights {
        const weights = { ...this.weights };

        let redistributed = 0;

        // If AI verification failed, redistribute its weight
        if (input.aiVerificationScore === null) {
            redistributed += weights.aiVerification;
            weights.aiVerification = 0;
        }

        // If fact-check is not available, redistribute its weight
        if (input.factCheckScore === null) {
            redistributed += weights.crossModelFactCheck;
            weights.crossModelFactCheck = 0;
        }

        // If no vector similarity data, redistribute
        if (input.vectorSimilarityScores.length === 0) {
            redistributed += weights.semanticSimilarity;
            weights.semanticSimilarity = 0;
        }

        // Redistribute to remaining non-zero weights proportionally
        if (redistributed > 0) {
            const remainingWeights = Object.entries(weights)
                .filter(([_, v]) => v > 0) as [keyof typeof weights, number][];

            if (remainingWeights.length > 0) {
                const totalRemaining = remainingWeights.reduce((sum, [_, v]) => sum + v, 0);
                for (const [key, value] of remainingWeights) {
                    weights[key] = value + (redistributed * (value / totalRemaining));
                }
            }
        }

        return weights;
    }

    /**
     * Build human-readable reasoning string
     */
    private buildReasoning(
        components: Record<string, number>,
        weights: typeof this.weights,
        input: TrustScoreInput
    ): string {
        const parts: string[] = [];

        const totalSources = input.claimedSources.length;
        const verifiedSources = input.claimedSources.filter(s => s.wasFoundInDB).length;

        if (totalSources > 0) {
            parts.push(`${verifiedSources}/${totalSources} source(s) independently verified.`);
        }

        if (components.semanticSimilarityScore >= 70) {
            parts.push('Response content has strong semantic overlap with source materials.');
        } else if (components.semanticSimilarityScore >= 50) {
            parts.push('Response content has moderate overlap with source materials.');
        } else if (components.semanticSimilarityScore < 50 && input.vectorSimilarityScores.length > 0) {
            parts.push('Response content has weak overlap with source materials — verify independently.');
        }

        if (input.aiVerificationScore !== null) {
            if (input.aiVerificationScore >= 80) {
                parts.push('AI cross-model verification confirmed accuracy.');
            } else if (input.aiVerificationScore < 50) {
                parts.push('AI cross-model verification found significant discrepancies.');
            }
        }

        if (input.factCheckScore !== null) {
            if (input.factCheckScore >= 80) {
                parts.push('Independent fact-check confirmed claims.');
            } else if (input.factCheckScore < 50) {
                parts.push('Independent fact-check flagged potential inaccuracies.');
            }
        }

        return parts.join(' ') || 'Verification completed using hybrid scoring.';
    }

    /**
     * Determine trust level from score
     */
    private determineTrustLevel(score: number): 'highest' | 'high' | 'medium' | 'lower' | 'low' {
        if (score >= TRUST_SCORE.HIGHEST) return 'highest';
        if (score >= TRUST_SCORE.HIGH) return 'high';
        if (score >= TRUST_SCORE.MEDIUM) return 'medium';
        if (score >= TRUST_SCORE.LOWER) return 'lower';
        return 'low';
    }
}
