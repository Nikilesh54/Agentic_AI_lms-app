/**
 * Re-index Embeddings Script
 * 
 * Generates Xenova embeddings for all course materials that have
 * extracted text content but are missing vector embeddings.
 * 
 * Usage: npx ts-node src/scripts/reindexEmbeddings.ts
 */
import dotenv from 'dotenv';
dotenv.config();

import { pool } from '../config/database';
import { generateEmbeddings, embeddingToPostgresVector } from '../services/embeddingService';

interface MaterialToIndex {
  material_id: number;
  file_name: string;
  content_chunks: any[];
}

async function reindexEmbeddings() {
  console.log('🔄 Starting embedding re-indexing...\n');

  try {
    // Step 1: Find all materials that have content but no embeddings
    const result = await pool.query(`
      SELECT 
        cmc.material_id,
        cm.file_name,
        cmc.content_chunks
      FROM course_material_content cmc
      JOIN course_materials cm ON cmc.material_id = cm.id
      LEFT JOIN course_material_embeddings cme ON cmc.material_id = cme.material_id
      WHERE cmc.content_text IS NOT NULL 
        AND cmc.content_text != ''
        AND cmc.content_chunks IS NOT NULL
      GROUP BY cmc.material_id, cm.file_name, cmc.content_chunks
      HAVING COUNT(cme.id) = 0
    `);

    const materials: MaterialToIndex[] = result.rows.map(row => ({
      material_id: row.material_id,
      file_name: row.file_name,
      content_chunks: typeof row.content_chunks === 'string'
        ? JSON.parse(row.content_chunks)
        : row.content_chunks
    }));

    if (materials.length === 0) {
      console.log('✅ All materials already have embeddings. Nothing to re-index.');
      await pool.end();
      return;
    }

    console.log(`📋 Found ${materials.length} material(s) missing embeddings:\n`);
    materials.forEach(m => {
      console.log(`   - [ID: ${m.material_id}] ${m.file_name} (${m.content_chunks.length} chunks)`);
    });
    console.log('');

    // Step 2: Generate embeddings for each material
    let totalChunksProcessed = 0;
    let totalMaterialsProcessed = 0;

    for (const material of materials) {
      const chunks = material.content_chunks;

      if (!chunks || chunks.length === 0) {
        console.log(`⚠️  Skipping "${material.file_name}" - no chunks found`);
        continue;
      }

      console.log(`\n🔄 Processing "${material.file_name}" (${chunks.length} chunks)...`);

      try {
        // Extract text from chunks
        const chunkTexts = chunks.map((chunk: any) => chunk.text || '').filter((t: string) => t.trim().length > 0);

        if (chunkTexts.length === 0) {
          console.log(`⚠️  Skipping "${material.file_name}" - all chunks are empty`);
          continue;
        }

        // Generate embeddings using Xenova (bge-base-en-v1.5, 768d)
        console.log(`   Generating ${chunkTexts.length} embeddings with Xenova...`);
        const embeddings = await generateEmbeddings(chunkTexts, 5);

        // Store embeddings in database
        console.log(`   Storing embeddings in database...`);
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const embedding = embeddings[i];

          if (!embedding) continue;

          await pool.query(
            `INSERT INTO course_material_embeddings
             (material_id, chunk_id, chunk_text, chunk_metadata, embedding)
             VALUES ($1, $2, $3, $4, $5::vector)
             ON CONFLICT (material_id, chunk_id) DO UPDATE
             SET chunk_text = EXCLUDED.chunk_text,
                 chunk_metadata = EXCLUDED.chunk_metadata,
                 embedding = EXCLUDED.embedding,
                 created_at = CURRENT_TIMESTAMP`,
            [
              material.material_id,
              chunk.chunk_id || `chunk_${i}`,
              chunk.text,
              JSON.stringify(chunk.metadata || {}),
              embeddingToPostgresVector(embedding)
            ]
          );
        }

        totalChunksProcessed += chunkTexts.length;
        totalMaterialsProcessed++;
        console.log(`   ✅ Done! Stored ${chunkTexts.length} embeddings for "${material.file_name}"`);
      } catch (error) {
        console.error(`   ❌ Error processing "${material.file_name}":`, error);
      }
    }

    // Step 3: Verify
    const verifyResult = await pool.query(`
      SELECT COUNT(*) as count FROM course_material_embeddings
    `);

    console.log(`\n${'='.repeat(50)}`);
    console.log(`✅ Re-indexing complete!`);
    console.log(`   Materials processed: ${totalMaterialsProcessed}`);
    console.log(`   Chunks embedded: ${totalChunksProcessed}`);
    console.log(`   Total embeddings in DB: ${verifyResult.rows[0].count}`);
    console.log(`${'='.repeat(50)}\n`);

  } catch (error) {
    console.error('❌ Fatal error during re-indexing:', error);
  } finally {
    await pool.end();
  }
}

reindexEmbeddings();
