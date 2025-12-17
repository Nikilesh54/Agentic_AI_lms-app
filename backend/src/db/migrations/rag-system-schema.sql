-- ========================================
-- RAG (Retrieval Augmented Generation) System Migration
-- ========================================
-- This migration adds support for document text extraction,
-- vector embeddings, and semantic search for course materials
-- ========================================

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- ========================================
-- 1. Course Material Content Table
-- ========================================
-- Stores extracted text and chunks from uploaded course materials
CREATE TABLE IF NOT EXISTS course_material_content (
  id SERIAL PRIMARY KEY,
  material_id INTEGER NOT NULL REFERENCES course_materials(id) ON DELETE CASCADE,
  content_text TEXT NOT NULL,
  content_chunks JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  last_indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(material_id)
);

-- Index for faster lookups by material_id
CREATE INDEX IF NOT EXISTS idx_material_content_material_id
ON course_material_content(material_id);

-- ========================================
-- 2. Course Material Embeddings Table
-- ========================================
-- Stores vector embeddings for each chunk of course material
-- Using 768 dimensions for Google's text-embedding-004 model
CREATE TABLE IF NOT EXISTS course_material_embeddings (
  id SERIAL PRIMARY KEY,
  material_id INTEGER NOT NULL REFERENCES course_materials(id) ON DELETE CASCADE,
  chunk_id VARCHAR(100) NOT NULL,
  chunk_text TEXT NOT NULL,
  chunk_metadata JSONB DEFAULT '{}',
  embedding vector(768) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(material_id, chunk_id)
);

-- Index for faster lookups by material_id
CREATE INDEX IF NOT EXISTS idx_embeddings_material_id
ON course_material_embeddings(material_id);

-- Vector similarity index using IVFFlat
-- The lists parameter is set to 100 for small-medium datasets (1K-10K vectors)
-- Adjust this value based on your dataset size:
-- - 100 for 1K-10K vectors
-- - 300 for 10K-100K vectors
-- - 1000 for 100K+ vectors
CREATE INDEX IF NOT EXISTS idx_embeddings_vector_cosine
ON course_material_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ========================================
-- 3. Additional Indexes for Performance
-- ========================================
-- These indexes optimize JOIN operations in vector search queries
CREATE INDEX IF NOT EXISTS idx_materials_course_id_uploaded
ON course_materials(course_id, uploaded_at DESC);

-- ========================================
-- 4. Helper Functions
-- ========================================

-- Function to get total chunks for a course
CREATE OR REPLACE FUNCTION get_course_chunk_count(p_course_id INTEGER)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)
    FROM course_material_embeddings cme
    JOIN course_materials cm ON cme.material_id = cm.id
    WHERE cm.course_id = p_course_id
  );
END;
$$ LANGUAGE plpgsql;

-- Function to check if material has been processed
CREATE OR REPLACE FUNCTION is_material_processed(p_material_id INTEGER)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM course_material_content
    WHERE material_id = p_material_id
    AND content_text IS NOT NULL
    AND content_text != ''
  );
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- Migration completed successfully
-- ========================================
