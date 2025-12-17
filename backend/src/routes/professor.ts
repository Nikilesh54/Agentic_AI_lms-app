import express, { Request, Response } from 'express';
import { pool } from '../config/database';
import { authenticate, authorize, requireApprovedProfessor } from '../middleware/auth';
import { uploadCourseMaterials, uploadAssignmentFiles, handleMulterError } from '../middleware/upload';
import { uploadFile, deleteFile, generateSignedUrl, downloadFile } from '../config/storage';
import { extractTextFromFile } from '../services/documentProcessor';
import { generateEmbeddings, embeddingToPostgresVector } from '../services/embeddingService';

const router = express.Router();

// Apply authentication and authorization to all professor routes
router.use(authenticate);
router.use(authorize('professor'));
router.use(requireApprovedProfessor);

// Get professor's assigned course
router.get('/course', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.id, c.title, c.description, c.created_at, c.updated_at,
              COUNT(DISTINCT e.id) as enrolled_students_count
       FROM course_instructors ci
       JOIN courses c ON ci.course_id = c.id
       LEFT JOIN enrollments e ON c.id = e.course_id
       WHERE ci.user_id = $1
       GROUP BY c.id`,
      [req.user!.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'No course assigned',
        message: 'You are not assigned to any course yet'
      });
    }

    res.json({
      message: 'Course retrieved successfully',
      course: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching professor course:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all students enrolled in professor's course
router.get('/students', async (req, res) => {
  try {
    // First get the professor's course
    const courseResult = await pool.query(
      'SELECT course_id FROM course_instructors WHERE user_id = $1',
      [req.user!.userId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No course assigned',
        message: 'You are not assigned to any course yet'
      });
    }

    const courseId = courseResult.rows[0].course_id;

    // Get all enrolled students
    const studentsResult = await pool.query(
      `SELECT u.id, u.full_name, u.email, e.enrolled_at
       FROM enrollments e
       JOIN users u ON e.user_id = u.id
       WHERE e.course_id = $1 AND u.role = 'student'
       ORDER BY u.full_name ASC`,
      [courseId]
    );

    res.json({
      message: 'Students retrieved successfully',
      courseId: courseId,
      students: studentsResult.rows
    });
  } catch (error) {
    console.error('Error fetching enrolled students:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update course details
router.put('/course', async (req, res) => {
  try {
    const { title, description } = req.body;

    // Get professor's course
    const courseResult = await pool.query(
      'SELECT course_id FROM course_instructors WHERE user_id = $1',
      [req.user!.userId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No course assigned',
        message: 'You are not assigned to any course yet'
      });
    }

    const courseId = courseResult.rows[0].course_id;

    // Update course
    const result = await pool.query(
      `UPDATE courses
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [title, description, courseId]
    );

    res.json({
      message: 'Course updated successfully',
      course: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all assignments for professor's course
router.get('/assignments', async (req, res) => {
  try {
    // Get professor's course
    const courseResult = await pool.query(
      'SELECT course_id FROM course_instructors WHERE user_id = $1',
      [req.user!.userId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No course assigned'
      });
    }

    const courseId = courseResult.rows[0].course_id;

    // Get assignments
    const result = await pool.query(
      `SELECT id, title, description, question_text, due_date, points, created_at, updated_at
       FROM assignments
       WHERE course_id = $1
       ORDER BY due_date DESC`,
      [courseId]
    );

    res.json({
      message: 'Assignments retrieved successfully',
      courseId: courseId,
      assignments: result.rows
    });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new assignment
router.post('/assignments', async (req, res) => {
  try {
    const { title, description, questionText, dueDate, points } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'Assignment title is required' });
    }

    // Get professor's course
    const courseResult = await pool.query(
      'SELECT course_id FROM course_instructors WHERE user_id = $1',
      [req.user!.userId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No course assigned'
      });
    }

    const courseId = courseResult.rows[0].course_id;

    // Create assignment
    const result = await pool.query(
      `INSERT INTO assignments (title, description, question_text, course_id, due_date, points)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [title, description || null, questionText || null, courseId, dueDate || null, points || 100]
    );

    res.status(201).json({
      message: 'Assignment created successfully',
      assignment: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update an assignment
router.put('/assignments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, questionText, dueDate, points } = req.body;

    // Get professor's course
    const courseResult = await pool.query(
      'SELECT course_id FROM course_instructors WHERE user_id = $1',
      [req.user!.userId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No course assigned'
      });
    }

    const courseId = courseResult.rows[0].course_id;

    // Verify assignment belongs to professor's course
    const assignmentCheck = await pool.query(
      'SELECT id FROM assignments WHERE id = $1 AND course_id = $2',
      [id, courseId]
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Assignment not found or does not belong to your course'
      });
    }

    // Update assignment
    const result = await pool.query(
      `UPDATE assignments
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           question_text = COALESCE($3, question_text),
           due_date = COALESCE($4, due_date),
           points = COALESCE($5, points),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [title, description, questionText, dueDate, points, id]
    );

    res.json({
      message: 'Assignment updated successfully',
      assignment: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating assignment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete an assignment
router.delete('/assignments/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get professor's course
    const courseResult = await pool.query(
      'SELECT course_id FROM course_instructors WHERE user_id = $1',
      [req.user!.userId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No course assigned'
      });
    }

    const courseId = courseResult.rows[0].course_id;

    // Delete assignment (must belong to professor's course)
    const result = await pool.query(
      'DELETE FROM assignments WHERE id = $1 AND course_id = $2 RETURNING id, title',
      [id, courseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Assignment not found or does not belong to your course'
      });
    }

    res.json({
      message: 'Assignment deleted successfully',
      assignment: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting assignment:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all announcements for professor's course
router.get('/announcements', async (req, res) => {
  try {
    // Get professor's course
    const courseResult = await pool.query(
      'SELECT course_id FROM course_instructors WHERE user_id = $1',
      [req.user!.userId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No course assigned'
      });
    }

    const courseId = courseResult.rows[0].course_id;

    // Get announcements
    const result = await pool.query(
      `SELECT a.id, a.title, a.content, a.created_at, a.updated_at,
              u.full_name as author_name
       FROM announcements a
       JOIN users u ON a.author_id = u.id
       WHERE a.course_id = $1
       ORDER BY a.created_at DESC`,
      [courseId]
    );

    res.json({
      message: 'Announcements retrieved successfully',
      courseId: courseId,
      announcements: result.rows
    });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new announcement
router.post('/announcements', async (req, res) => {
  try {
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        error: 'Announcement title and content are required'
      });
    }

    // Get professor's course
    const courseResult = await pool.query(
      'SELECT course_id FROM course_instructors WHERE user_id = $1',
      [req.user!.userId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No course assigned'
      });
    }

    const courseId = courseResult.rows[0].course_id;

    // Create announcement
    const result = await pool.query(
      `INSERT INTO announcements (title, content, course_id, author_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [title, content, courseId, req.user!.userId]
    );

    res.status(201).json({
      message: 'Announcement created successfully',
      announcement: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating announcement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update an announcement
router.put('/announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    // Get professor's course
    const courseResult = await pool.query(
      'SELECT course_id FROM course_instructors WHERE user_id = $1',
      [req.user!.userId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No course assigned'
      });
    }

    const courseId = courseResult.rows[0].course_id;

    // Verify announcement belongs to professor's course
    const announcementCheck = await pool.query(
      'SELECT id FROM announcements WHERE id = $1 AND course_id = $2',
      [id, courseId]
    );

    if (announcementCheck.rows.length === 0) {
      return res.status(404).json({
        error: 'Announcement not found or does not belong to your course'
      });
    }

    // Update announcement
    const result = await pool.query(
      `UPDATE announcements
       SET title = COALESCE($1, title),
           content = COALESCE($2, content),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [title, content, id]
    );

    res.json({
      message: 'Announcement updated successfully',
      announcement: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating announcement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete an announcement
router.delete('/announcements/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get professor's course
    const courseResult = await pool.query(
      'SELECT course_id FROM course_instructors WHERE user_id = $1',
      [req.user!.userId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({
        error: 'No course assigned'
      });
    }

    const courseId = courseResult.rows[0].course_id;

    // Delete announcement (must belong to professor's course)
    const result = await pool.query(
      'DELETE FROM announcements WHERE id = $1 AND course_id = $2 RETURNING id, title',
      [id, courseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Announcement not found or does not belong to your course'
      });
    }

    res.json({
      message: 'Announcement deleted successfully',
      announcement: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting announcement:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========== COURSE MATERIALS ENDPOINTS ==========

// Upload course materials
router.post('/materials', uploadCourseMaterials, handleMulterError, async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Get professor's course
    const courseResult = await pool.query(
      'SELECT course_id FROM course_instructors WHERE user_id = $1',
      [req.user!.userId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'No course assigned' });
    }

    const courseId = courseResult.rows[0].course_id;

    await client.query('BEGIN');

    const uploadedMaterials = [];

    for (const file of files) {
      // Generate unique file path
      const timestamp = Date.now();
      const filePath = `course-materials/${courseId}/${timestamp}-${file.originalname}`;

      // Upload to GCS
      const uploadResult = await uploadFile(file, filePath);

      // Save to database
      const result = await client.query(
        `INSERT INTO course_materials (course_id, file_name, file_path, file_size, file_type, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [courseId, uploadResult.fileName, uploadResult.filePath, uploadResult.fileSize, file.mimetype, req.user!.userId]
      );

      const materialId = result.rows[0].id;

      // Extract text content from the uploaded file
      try {
        console.log(`Extracting text from ${file.originalname}...`);
        const processedDoc = await extractTextFromFile(
          file.buffer,
          file.originalname,
          file.mimetype
        );

        // Save extracted content to course_material_content table
        await client.query(
          `INSERT INTO course_material_content (material_id, content_text, content_chunks, metadata)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (material_id) DO UPDATE
           SET content_text = EXCLUDED.content_text,
               content_chunks = EXCLUDED.content_chunks,
               metadata = EXCLUDED.metadata,
               last_indexed_at = CURRENT_TIMESTAMP`,
          [
            materialId,
            processedDoc.content_text,
            JSON.stringify(processedDoc.content_chunks),
            JSON.stringify(processedDoc.metadata)
          ]
        );

        console.log(`✓ Extracted ${processedDoc.content_chunks.length} chunks from ${file.originalname}`);

        // Generate embeddings for each chunk (only if extraction was successful)
        if (processedDoc.content_chunks.length > 0 && processedDoc.content_text.trim().length > 0) {
          try {
            console.log(`Generating embeddings for ${processedDoc.content_chunks.length} chunks...`);

            // Extract chunk texts for embedding generation
            const chunkTexts = processedDoc.content_chunks.map(chunk => chunk.text);

            // Generate embeddings in batches
            const embeddings = await generateEmbeddings(chunkTexts, 5);

            // Store embeddings in database
            for (let i = 0; i < processedDoc.content_chunks.length; i++) {
              const chunk = processedDoc.content_chunks[i];
              const embedding = embeddings[i];

              await client.query(
                `INSERT INTO course_material_embeddings
                 (material_id, chunk_id, chunk_text, chunk_metadata, embedding)
                 VALUES ($1, $2, $3, $4, $5::vector)
                 ON CONFLICT (material_id, chunk_id) DO UPDATE
                 SET chunk_text = EXCLUDED.chunk_text,
                     chunk_metadata = EXCLUDED.chunk_metadata,
                     embedding = EXCLUDED.embedding,
                     created_at = CURRENT_TIMESTAMP`,
                [
                  materialId,
                  chunk.chunk_id,
                  chunk.text,
                  JSON.stringify(chunk.metadata),
                  embeddingToPostgresVector(embedding)
                ]
              );
            }

            console.log(`✓ Generated and stored ${embeddings.length} embeddings for ${file.originalname}`);
          } catch (embeddingError) {
            console.error(`Error generating embeddings for ${file.originalname}:`, embeddingError);
            // Continue even if embedding generation fails
            // The text is still stored, embeddings can be generated later via batch script
          }
        }
      } catch (extractionError) {
        console.error(`Error extracting text from ${file.originalname}:`, extractionError);
        // Continue with upload even if extraction fails
        // Save error information to content table
        await client.query(
          `INSERT INTO course_material_content (material_id, content_text, content_chunks, metadata)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (material_id) DO UPDATE
           SET metadata = EXCLUDED.metadata`,
          [
            materialId,
            '',
            JSON.stringify([]),
            JSON.stringify({
              extraction_method: 'failed',
              extraction_date: new Date().toISOString(),
              error: extractionError instanceof Error ? extractionError.message : 'Unknown error'
            })
          ]
        );
      }

      uploadedMaterials.push(result.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Course materials uploaded successfully',
      materials: uploadedMaterials
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error uploading course materials:', error);
    res.status(500).json({ error: 'Failed to upload course materials' });
  } finally {
    client.release();
  }
});

// Get all course materials
router.get('/materials', async (req, res) => {
  try {
    // Get professor's course
    const courseResult = await pool.query(
      'SELECT course_id FROM course_instructors WHERE user_id = $1',
      [req.user!.userId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'No course assigned' });
    }

    const courseId = courseResult.rows[0].course_id;

    // Get materials
    const result = await pool.query(
      `SELECT cm.*, u.full_name as uploader_name
       FROM course_materials cm
       JOIN users u ON cm.uploaded_by = u.id
       WHERE cm.course_id = $1
       ORDER BY cm.uploaded_at DESC`,
      [courseId]
    );

    res.json({
      message: 'Course materials retrieved successfully',
      materials: result.rows
    });
  } catch (error) {
    console.error('Error fetching course materials:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete course material
router.delete('/materials/:id', async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    // Get professor's course
    const courseResult = await pool.query(
      'SELECT course_id FROM course_instructors WHERE user_id = $1',
      [req.user!.userId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'No course assigned' });
    }

    const courseId = courseResult.rows[0].course_id;

    await client.query('BEGIN');

    // Get material details
    const materialResult = await client.query(
      'SELECT * FROM course_materials WHERE id = $1 AND course_id = $2',
      [id, courseId]
    );

    if (materialResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Material not found' });
    }

    const material = materialResult.rows[0];

    // Delete from GCS
    await deleteFile(material.file_path);

    // Delete from database
    await client.query('DELETE FROM course_materials WHERE id = $1', [id]);

    await client.query('COMMIT');

    res.json({
      message: 'Course material deleted successfully',
      material: material
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting course material:', error);
    res.status(500).json({ error: 'Failed to delete course material' });
  } finally {
    client.release();
  }
});

// Get signed URL for course material download
router.get('/materials/:id/download', async (req, res) => {
  try {
    const { id } = req.params;

    // Get professor's course
    const courseResult = await pool.query(
      'SELECT course_id FROM course_instructors WHERE user_id = $1',
      [req.user!.userId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'No course assigned' });
    }

    const courseId = courseResult.rows[0].course_id;

    // Get material
    const result = await pool.query(
      'SELECT * FROM course_materials WHERE id = $1 AND course_id = $2',
      [id, courseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Material not found' });
    }

    const material = result.rows[0];

    // Generate signed URL (valid for 60 minutes)
    const signedUrl = await generateSignedUrl(material.file_path, 60);

    res.json({
      message: 'Download URL generated successfully',
      url: signedUrl,
      fileName: material.file_name
    });
  } catch (error) {
    console.error('Error generating download URL:', error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

// ========== ASSIGNMENT FILES ENDPOINTS ==========

// Upload files to an assignment
router.post('/assignments/:assignmentId/files', uploadAssignmentFiles, handleMulterError, async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const { assignmentId } = req.params;
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    // Get professor's course
    const courseResult = await pool.query(
      'SELECT course_id FROM course_instructors WHERE user_id = $1',
      [req.user!.userId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'No course assigned' });
    }

    const courseId = courseResult.rows[0].course_id;

    // Verify assignment belongs to professor's course
    const assignmentCheck = await pool.query(
      'SELECT id FROM assignments WHERE id = $1 AND course_id = $2',
      [assignmentId, courseId]
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    await client.query('BEGIN');

    const uploadedFiles = [];

    for (const file of files) {
      // Generate unique file path
      const timestamp = Date.now();
      const filePath = `assignments/${assignmentId}/${timestamp}-${file.originalname}`;

      // Upload to GCS
      const uploadResult = await uploadFile(file, filePath);

      // Save to database
      const result = await client.query(
        `INSERT INTO assignment_files (assignment_id, file_name, file_path, file_size, file_type, uploaded_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [assignmentId, uploadResult.fileName, uploadResult.filePath, uploadResult.fileSize, file.mimetype, req.user!.userId]
      );

      uploadedFiles.push(result.rows[0]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Assignment files uploaded successfully',
      files: uploadedFiles
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error uploading assignment files:', error);
    res.status(500).json({ error: 'Failed to upload assignment files' });
  } finally {
    client.release();
  }
});

// Get all files for an assignment
router.get('/assignments/:assignmentId/files', async (req, res) => {
  try {
    const { assignmentId } = req.params;

    // Get professor's course
    const courseResult = await pool.query(
      'SELECT course_id FROM course_instructors WHERE user_id = $1',
      [req.user!.userId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'No course assigned' });
    }

    const courseId = courseResult.rows[0].course_id;

    // Verify assignment belongs to professor's course
    const assignmentCheck = await pool.query(
      'SELECT id FROM assignments WHERE id = $1 AND course_id = $2',
      [assignmentId, courseId]
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Get files
    const result = await pool.query(
      `SELECT af.*, u.full_name as uploader_name
       FROM assignment_files af
       JOIN users u ON af.uploaded_by = u.id
       WHERE af.assignment_id = $1
       ORDER BY af.uploaded_at DESC`,
      [assignmentId]
    );

    res.json({
      message: 'Assignment files retrieved successfully',
      files: result.rows
    });
  } catch (error) {
    console.error('Error fetching assignment files:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete assignment file
router.delete('/assignments/:assignmentId/files/:fileId', async (req, res) => {
  const client = await pool.connect();

  try {
    const { assignmentId, fileId } = req.params;

    // Get professor's course
    const courseResult = await pool.query(
      'SELECT course_id FROM course_instructors WHERE user_id = $1',
      [req.user!.userId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'No course assigned' });
    }

    const courseId = courseResult.rows[0].course_id;

    // Verify assignment belongs to professor's course
    const assignmentCheck = await pool.query(
      'SELECT id FROM assignments WHERE id = $1 AND course_id = $2',
      [assignmentId, courseId]
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    await client.query('BEGIN');

    // Get file details
    const fileResult = await client.query(
      'SELECT * FROM assignment_files WHERE id = $1 AND assignment_id = $2',
      [fileId, assignmentId]
    );

    if (fileResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'File not found' });
    }

    const file = fileResult.rows[0];

    // Delete from GCS
    await deleteFile(file.file_path);

    // Delete from database
    await client.query('DELETE FROM assignment_files WHERE id = $1', [fileId]);

    await client.query('COMMIT');

    res.json({
      message: 'Assignment file deleted successfully',
      file: file
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting assignment file:', error);
    res.status(500).json({ error: 'Failed to delete assignment file' });
  } finally {
    client.release();
  }
});

// Get all submissions for an assignment
router.get('/assignments/:assignmentId/submissions', async (req, res) => {
  try {
    const { assignmentId } = req.params;

    // Get professor's course
    const courseResult = await pool.query(
      'SELECT course_id FROM course_instructors WHERE user_id = $1',
      [req.user!.userId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'No course assigned' });
    }

    const courseId = courseResult.rows[0].course_id;

    // Verify assignment belongs to professor's course
    const assignmentCheck = await pool.query(
      'SELECT id FROM assignments WHERE id = $1 AND course_id = $2',
      [assignmentId, courseId]
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Get submissions with student details and files
    const result = await pool.query(
      `SELECT
        asub.id, asub.submission_text, asub.grade, asub.feedback,
        asub.submitted_at, asub.graded_at,
        u.id as student_id, u.full_name as student_name, u.email as student_email,
        json_agg(
          json_build_object(
            'id', sf.id,
            'file_name', sf.file_name,
            'file_path', sf.file_path,
            'file_size', sf.file_size,
            'file_type', sf.file_type,
            'uploaded_at', sf.uploaded_at
          )
        ) FILTER (WHERE sf.id IS NOT NULL) as files
       FROM assignment_submissions asub
       JOIN users u ON asub.student_id = u.id
       LEFT JOIN submission_files sf ON asub.id = sf.submission_id
       WHERE asub.assignment_id = $1
       GROUP BY asub.id, u.id
       ORDER BY asub.submitted_at DESC`,
      [assignmentId]
    );

    res.json({
      message: 'Assignment submissions retrieved successfully',
      submissions: result.rows
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Grade a submission
router.put('/submissions/:submissionId/grade', async (req, res) => {
  try {
    const { submissionId } = req.params;
    const { grade, feedback } = req.body;

    if (grade === undefined || grade === null) {
      return res.status(400).json({ error: 'Grade is required' });
    }

    // Get professor's course
    const courseResult = await pool.query(
      'SELECT course_id FROM course_instructors WHERE user_id = $1',
      [req.user!.userId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'No course assigned' });
    }

    const courseId = courseResult.rows[0].course_id;

    // Verify submission belongs to professor's course
    const submissionCheck = await pool.query(
      `SELECT asub.id FROM assignment_submissions asub
       JOIN assignments a ON asub.assignment_id = a.id
       WHERE asub.id = $1 AND a.course_id = $2`,
      [submissionId, courseId]
    );

    if (submissionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Update grade
    const result = await pool.query(
      `UPDATE assignment_submissions
       SET grade = $1, feedback = $2, graded_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [grade, feedback || null, submissionId]
    );

    res.json({
      message: 'Submission graded successfully',
      submission: result.rows[0]
    });
  } catch (error) {
    console.error('Error grading submission:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get signed URL for submission file download
router.get('/submissions/files/:fileId/download', async (req, res) => {
  try {
    const { fileId } = req.params;

    // Get professor's course
    const courseResult = await pool.query(
      'SELECT course_id FROM course_instructors WHERE user_id = $1',
      [req.user!.userId]
    );

    if (courseResult.rows.length === 0) {
      return res.status(404).json({ error: 'No course assigned' });
    }

    const courseId = courseResult.rows[0].course_id;

    // Get file with course verification
    const result = await pool.query(
      `SELECT sf.* FROM submission_files sf
       JOIN assignment_submissions asub ON sf.submission_id = asub.id
       JOIN assignments a ON asub.assignment_id = a.id
       WHERE sf.id = $1 AND a.course_id = $2`,
      [fileId, courseId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' });
    }

    const file = result.rows[0];

    // Generate signed URL (valid for 60 minutes)
    const signedUrl = await generateSignedUrl(file.file_path, 60);

    res.json({
      message: 'Download URL generated successfully',
      url: signedUrl,
      fileName: file.file_name
    });
  } catch (error) {
    console.error('Error generating download URL:', error);
    res.status(500).json({ error: 'Failed to generate download URL' });
  }
});

export default router;
