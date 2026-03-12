-- ========================================
-- Material Folders Migration
-- ========================================
-- Adds hierarchical folder system for course materials
-- ========================================

-- 1. Create the material_folders table
CREATE TABLE IF NOT EXISTS material_folders (
  id SERIAL PRIMARY KEY,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  parent_id INTEGER REFERENCES material_folders(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint: no duplicate folder names at the same level within a course
-- For non-root folders (parent_id IS NOT NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'material_folders_unique_name'
  ) THEN
    ALTER TABLE material_folders
    ADD CONSTRAINT material_folders_unique_name UNIQUE (course_id, parent_id, name);
  END IF;
END $$;

-- For root-level folders (parent_id IS NULL), PostgreSQL UNIQUE treats NULLs as distinct,
-- so we need a partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_material_folders_root_unique
ON material_folders (course_id, name)
WHERE parent_id IS NULL;

-- 2. Add folder_id column to course_materials (nullable, NULL = root)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'course_materials' AND column_name = 'folder_id'
  ) THEN
    ALTER TABLE course_materials
    ADD COLUMN folder_id INTEGER REFERENCES material_folders(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 3. Performance indexes
CREATE INDEX IF NOT EXISTS idx_material_folders_course_id
ON material_folders(course_id);

CREATE INDEX IF NOT EXISTS idx_material_folders_parent_id
ON material_folders(parent_id);

CREATE INDEX IF NOT EXISTS idx_course_materials_folder_id
ON course_materials(folder_id);
