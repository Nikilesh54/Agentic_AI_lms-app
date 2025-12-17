import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Google AI client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

/**
 * Generate embedding for a single text using Google's text-embedding-004 model
 * @param text - The text to generate embedding for
 * @returns Array of 768 floats representing the embedding
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error('Text cannot be empty');
    }

    // Use Google's text-embedding-004 model (768 dimensions)
    const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

    const result = await model.embedContent(text);

    if (!result.embedding || !result.embedding.values) {
      throw new Error('Failed to generate embedding: No embedding values returned');
    }

    return result.embedding.values;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate embeddings for multiple texts in batch
 * @param texts - Array of texts to generate embeddings for
 * @param batchSize - Number of texts to process in parallel (default: 5 to avoid rate limits)
 * @returns Array of embeddings (each embedding is an array of 768 floats)
 */
export async function generateEmbeddings(
  texts: string[],
  batchSize: number = 5
): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  const embeddings: number[][] = [];
  const totalBatches = Math.ceil(texts.length / batchSize);

  console.log(`Generating embeddings for ${texts.length} texts in ${totalBatches} batches...`);

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;

    try {
      console.log(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} items)...`);

      // Process batch in parallel
      const batchEmbeddings = await Promise.all(
        batch.map(text => generateEmbedding(text))
      );

      embeddings.push(...batchEmbeddings);

      // Add small delay between batches to respect rate limits
      if (i + batchSize < texts.length) {
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
      }
    } catch (error) {
      console.error(`Error processing batch ${batchNumber}:`, error);
      throw error;
    }
  }

  console.log(`✓ Generated ${embeddings.length} embeddings successfully`);
  return embeddings;
}

/**
 * Simple in-memory cache for embeddings to avoid redundant API calls
 * Useful for frequently asked questions or common queries
 */
class EmbeddingCache {
  private cache: Map<string, number[]>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(text: string): number[] | undefined {
    return this.cache.get(text);
  }

  set(text: string, embedding: number[]): void {
    // Simple LRU-like behavior: remove oldest if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    this.cache.set(text, embedding);
  }

  has(text: string): boolean {
    return this.cache.has(text);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// Global cache instance
const embeddingCache = new EmbeddingCache(1000);

/**
 * Generate embedding with caching
 * @param text - The text to generate embedding for
 * @param useCache - Whether to use cache (default: true)
 * @returns Array of 768 floats representing the embedding
 */
export async function generateEmbeddingCached(
  text: string,
  useCache: boolean = true
): Promise<number[]> {
  if (useCache && embeddingCache.has(text)) {
    console.log('Cache hit for embedding');
    return embeddingCache.get(text)!;
  }

  const embedding = await generateEmbedding(text);

  if (useCache) {
    embeddingCache.set(text, embedding);
  }

  return embedding;
}

/**
 * Convert embedding array to PostgreSQL vector format
 * @param embedding - Array of floats
 * @returns String in PostgreSQL vector format: "[0.1,0.2,0.3,...]"
 */
export function embeddingToPostgresVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return {
    size: embeddingCache.size(),
    maxSize: 1000
  };
}

/**
 * Clear the embedding cache
 */
export function clearCache() {
  embeddingCache.clear();
}
