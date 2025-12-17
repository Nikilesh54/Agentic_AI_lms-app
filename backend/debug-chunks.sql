-- Debug query to see what's actually in the chunks for your PDF
-- Replace <COURSE_ID> with your actual course ID

-- First, find the material ID
SELECT
  cm.id as material_id,
  cm.file_name,
  cm.file_type,
  cm.uploaded_at,
  COUNT(cme.id) as chunk_count
FROM course_materials cm
LEFT JOIN course_material_embeddings cme ON cm.id = cme.material_id
WHERE cm.file_name LIKE '%Cyber%Bullying%'
GROUP BY cm.id, cm.file_name, cm.file_type, cm.uploaded_at;

-- Then, see ALL the chunks for that material
-- Replace <MATERIAL_ID> with the ID from above
SELECT
  cme.chunk_id,
  cme.chunk_metadata,
  LEFT(cme.chunk_text, 500) as chunk_preview,
  LENGTH(cme.chunk_text) as chunk_length
FROM course_material_embeddings cme
WHERE cme.material_id = <MATERIAL_ID>
ORDER BY cme.chunk_id;

-- Search for the specific text we're looking for
SELECT
  cme.chunk_id,
  cme.chunk_text
FROM course_material_embeddings cme
WHERE cme.material_id = <MATERIAL_ID>
  AND (
    cme.chunk_text ILIKE '%37%'
    OR cme.chunk_text ILIKE '%95%'
    OR cme.chunk_text ILIKE '%2019%'
  );
