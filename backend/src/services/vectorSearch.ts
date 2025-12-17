import { pool } from '../config/database';
import { generateEmbeddingCached, embeddingToPostgresVector } from './embeddingService';

/**
 * Search result interface with material information and similarity score
 */
export interface SearchResult {
  material_id: number;
  file_name: string;
  file_path: string;
  file_type: string;
  chunk_text: string;
  chunk_id: string;
  page_number?: number | string;
  chunk_index: number;
  similarity_score: number;  // 0-1 (cosine similarity)
  metadata: any;
  uploaded_at: Date;
}

/**
 * Options for configuring vector search
 */
export interface SearchOptions {
  topK?: number;              // Number of results to return (default: 20)
  minSimilarity?: number;     // Minimum similarity threshold 0-1 (default: 0.5)
  includeMetadata?: boolean;  // Include chunk metadata (default: true)
}

/**
 * Perform vector similarity search across ALL course materials
 *
 * This function:
 * 1. Generates an embedding for the query text
 * 2. Searches ALL materials in the course using cosine similarity
 * 3. Returns the top K most relevant chunks with similarity scores
 *
 * @param courseId - The course ID to search within
 * @param query - The search query text
 * @param options - Search configuration options
 * @returns Array of search results sorted by similarity (highest first)
 */
export async function searchCourseMaterials(
  courseId: number,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    topK = 20,
    minSimilarity = 0.5,  // Lowered from 0.6 for better recall
    includeMetadata = true
  } = options;

  const startTime = Date.now();

  try {
    // Validate inputs
    if (!query || query.trim().length === 0) {
      throw new Error('Search query cannot be empty');
    }

    if (topK < 1 || topK > 100) {
      throw new Error('topK must be between 1 and 100');
    }

    // Step 1: Generate embedding for the query (with caching)
    console.log(`Generating embedding for query: "${query.substring(0, 50)}..."`);
    const queryEmbedding = await generateEmbeddingCached(query, true);

    // Step 2: Perform vector similarity search using pgvector
    // Using cosine distance operator (<=> ) where lower distance = higher similarity
    // Similarity score = 1 - distance (so higher is better)
    const searchQuery = `
      SELECT
        cm.id as material_id,
        cm.file_name,
        cm.file_path,
        cm.file_type,
        cm.uploaded_at,
        cme.chunk_id,
        cme.chunk_text,
        cme.chunk_metadata,
        1 - (cme.embedding <=> $1::vector) AS similarity_score
      FROM course_material_embeddings cme
      JOIN course_materials cm ON cme.material_id = cm.id
      WHERE cm.course_id = $2
        AND (1 - (cme.embedding <=> $1::vector)) >= $3
      ORDER BY cme.embedding <=> $1::vector ASC
      LIMIT $4
    `;

    const result = await pool.query(searchQuery, [
      embeddingToPostgresVector(queryEmbedding),
      courseId,
      minSimilarity,
      topK
    ]);

    const searchDuration = Date.now() - startTime;

    // Step 3: Format results
    const searchResults: SearchResult[] = result.rows.map(row => {
      const metadata = row.chunk_metadata || {};

      return {
        material_id: row.material_id,
        file_name: row.file_name,
        file_path: row.file_path,
        file_type: row.file_type,
        chunk_text: row.chunk_text,
        chunk_id: row.chunk_id,
        page_number: metadata.page_number,
        chunk_index: metadata.chunk_index || 0,
        similarity_score: parseFloat(row.similarity_score),
        metadata: includeMetadata ? metadata : {},
        uploaded_at: row.uploaded_at
      };
    });

    console.log(
      `✓ Vector search completed in ${searchDuration}ms: ` +
      `found ${searchResults.length} results (min similarity: ${minSimilarity})`
    );

    return searchResults;

  } catch (error) {
    const searchDuration = Date.now() - startTime;
    console.error(`✗ Vector search failed after ${searchDuration}ms:`, error);
    throw new Error(`Vector search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get the total number of indexed chunks for a course
 * Useful for monitoring and debugging
 */
export async function getCourseMaterialStats(courseId: number): Promise<{
  totalMaterials: number;
  totalChunks: number;
  processedMaterials: number;
  unprocessedMaterials: number;
}> {
  try {
    const statsQuery = `
      SELECT
        COUNT(DISTINCT cm.id) as total_materials,
        COUNT(DISTINCT cmc.material_id) as processed_materials,
        COUNT(cme.id) as total_chunks
      FROM course_materials cm
      LEFT JOIN course_material_content cmc ON cm.id = cmc.material_id
        AND cmc.content_text IS NOT NULL
        AND cmc.content_text != ''
      LEFT JOIN course_material_embeddings cme ON cm.id = cme.material_id
      WHERE cm.course_id = $1
    `;

    const result = await pool.query(statsQuery, [courseId]);
    const row = result.rows[0];

    return {
      totalMaterials: parseInt(row.total_materials || 0),
      totalChunks: parseInt(row.total_chunks || 0),
      processedMaterials: parseInt(row.processed_materials || 0),
      unprocessedMaterials: parseInt(row.total_materials || 0) - parseInt(row.processed_materials || 0)
    };
  } catch (error) {
    console.error('Error fetching course material stats:', error);
    throw error;
  }
}

/**
 * Search within specific materials only (filtered search)
 * Useful when you want to search within a subset of materials
 */
export async function searchSpecificMaterials(
  materialIds: number[],
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    topK = 20,
    minSimilarity = 0.5,  // Lowered from 0.6 for better recall
    includeMetadata = true
  } = options;

  const startTime = Date.now();

  try {
    if (materialIds.length === 0) {
      return [];
    }

    // Generate embedding for the query
    const queryEmbedding = await generateEmbeddingCached(query, true);

    // Search within specific materials only
    const searchQuery = `
      SELECT
        cm.id as material_id,
        cm.file_name,
        cm.file_path,
        cm.file_type,
        cm.uploaded_at,
        cme.chunk_id,
        cme.chunk_text,
        cme.chunk_metadata,
        1 - (cme.embedding <=> $1::vector) AS similarity_score
      FROM course_material_embeddings cme
      JOIN course_materials cm ON cme.material_id = cm.id
      WHERE cm.id = ANY($2::int[])
        AND (1 - (cme.embedding <=> $1::vector)) >= $3
      ORDER BY cme.embedding <=> $1::vector ASC
      LIMIT $4
    `;

    const result = await pool.query(searchQuery, [
      embeddingToPostgresVector(queryEmbedding),
      materialIds,
      minSimilarity,
      topK
    ]);

    const searchDuration = Date.now() - startTime;

    const searchResults: SearchResult[] = result.rows.map(row => {
      const metadata = row.chunk_metadata || {};

      return {
        material_id: row.material_id,
        file_name: row.file_name,
        file_path: row.file_path,
        file_type: row.file_type,
        chunk_text: row.chunk_text,
        chunk_id: row.chunk_id,
        page_number: metadata.page_number,
        chunk_index: metadata.chunk_index || 0,
        similarity_score: parseFloat(row.similarity_score),
        metadata: includeMetadata ? metadata : {},
        uploaded_at: row.uploaded_at
      };
    });

    console.log(`✓ Filtered search completed in ${searchDuration}ms: found ${searchResults.length} results`);

    return searchResults;

  } catch (error) {
    console.error('Error in filtered vector search:', error);
    throw error;
  }
}

/**
 * Find similar chunks to a given chunk (useful for "more like this" features)
 */
export async function findSimilarChunks(
  courseId: number,
  chunkId: string,
  materialId: number,
  limit: number = 10
): Promise<SearchResult[]> {
  try {
    // Get the embedding of the source chunk
    const sourceQuery = `
      SELECT embedding
      FROM course_material_embeddings
      WHERE material_id = $1 AND chunk_id = $2
    `;

    const sourceResult = await pool.query(sourceQuery, [materialId, chunkId]);

    if (sourceResult.rows.length === 0) {
      throw new Error('Source chunk not found');
    }

    const sourceEmbedding = sourceResult.rows[0].embedding;

    // Find similar chunks (excluding the source chunk itself)
    const similarQuery = `
      SELECT
        cm.id as material_id,
        cm.file_name,
        cm.file_path,
        cm.file_type,
        cm.uploaded_at,
        cme.chunk_id,
        cme.chunk_text,
        cme.chunk_metadata,
        1 - (cme.embedding <=> $1::vector) AS similarity_score
      FROM course_material_embeddings cme
      JOIN course_materials cm ON cme.material_id = cm.id
      WHERE cm.course_id = $2
        AND NOT (cme.material_id = $3 AND cme.chunk_id = $4)
      ORDER BY cme.embedding <=> $1::vector ASC
      LIMIT $5
    `;

    const result = await pool.query(similarQuery, [
      sourceEmbedding,
      courseId,
      materialId,
      chunkId,
      limit
    ]);

    return result.rows.map(row => ({
      material_id: row.material_id,
      file_name: row.file_name,
      file_path: row.file_path,
      file_type: row.file_type,
      chunk_text: row.chunk_text,
      chunk_id: row.chunk_id,
      page_number: row.chunk_metadata?.page_number,
      chunk_index: row.chunk_metadata?.chunk_index || 0,
      similarity_score: parseFloat(row.similarity_score),
      metadata: row.chunk_metadata || {},
      uploaded_at: row.uploaded_at
    }));

  } catch (error) {
    console.error('Error finding similar chunks:', error);
    throw error;
  }
}
