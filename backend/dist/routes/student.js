"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const upload_1 = require("../middleware/upload");
const storage_1 = require("../config/storage");
const router = express_1.default.Router();
// Apply authentication and authorization to all student routes
router.use(auth_1.authenticate);
router.use((0, auth_1.authorize)('student'));
router.use(auth_1.requireActiveStatus);
// Get all available courses
router.get('/courses', async (req, res) => {
    try {
        const result = await database_1.pool.query(`SELECT c.id, c.title, c.description, c.created_at,
              u.full_name as instructor_name,
              u.email as instructor_email,
              COUNT(DISTINCT e.id) as enrolled_students_count,
              EXISTS(
                SELECT 1 FROM enrollments
                WHERE course_id = c.id AND user_id = $1
              ) as is_enrolled
       FROM courses c
       LEFT JOIN users u ON c.instructor_id = u.id
       LEFT JOIN enrollments e ON c.id = e.course_id
       GROUP BY c.id, u.id
       ORDER BY c.title ASC`, [req.user.userId]);
        res.json({
            message: 'Courses retrieved successfully',
            courses: result.rows
        });
    }
    catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get student's enrolled courses
router.get('/my-courses', async (req, res) => {
    try {
        const result = await database_1.pool.query(`SELECT c.id, c.title, c.description, c.created_at,
              u.full_name as instructor_name,
              u.email as instructor_email,
              e.enrolled_at
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       LEFT JOIN users u ON c.instructor_id = u.id
       WHERE e.user_id = $1
       ORDER BY e.enrolled_at DESC`, [req.user.userId]);
        res.json({
            message: 'Enrolled courses retrieved successfully',
            courses: result.rows
        });
    }
    catch (error) {
        console.error('Error fetching enrolled courses:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Enroll in a course
router.post('/courses/:courseId/enroll', async (req, res) => {
    try {
        const { courseId } = req.params;
        // Check if course exists
        const course = await database_1.pool.query('SELECT id, title FROM courses WHERE id = $1', [courseId]);
        if (course.rows.length === 0) {
            return res.status(404).json({ error: 'Course not found' });
        }
        // Check if already enrolled
        const existingEnrollment = await database_1.pool.query('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2', [req.user.userId, courseId]);
        if (existingEnrollment.rows.length > 0) {
            return res.status(400).json({
                error: 'Already enrolled',
                message: 'You are already enrolled in this course'
            });
        }
        // Enroll student
        const result = await database_1.pool.query('INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2) RETURNING *', [req.user.userId, courseId]);
        res.status(201).json({
            message: `Successfully enrolled in ${course.rows[0].title}`,
            enrollment: result.rows[0]
        });
    }
    catch (error) {
        console.error('Error enrolling in course:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Unenroll from a course
router.delete('/courses/:courseId/enroll', async (req, res) => {
    try {
        const { courseId } = req.params;
        // Check if enrolled
        const result = await database_1.pool.query(`DELETE FROM enrollments
       WHERE user_id = $1 AND course_id = $2
       RETURNING id, course_id`, [req.user.userId, courseId]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Not enrolled',
                message: 'You are not enrolled in this course'
            });
        }
        res.json({
            message: 'Successfully unenrolled from course',
            enrollment: result.rows[0]
        });
    }
    catch (error) {
        console.error('Error unenrolling from course:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get course details with assignments and announcements
router.get('/courses/:courseId', async (req, res) => {
    try {
        const { courseId } = req.params;
        // Verify student is enrolled in the course
        const enrollment = await database_1.pool.query('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2', [req.user.userId, courseId]);
        if (enrollment.rows.length === 0) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You must be enrolled in this course to view its details'
            });
        }
        // Get course details
        const course = await database_1.pool.query(`SELECT c.id, c.title, c.description, c.created_at, c.updated_at,
              u.full_name as instructor_name,
              u.email as instructor_email
       FROM courses c
       LEFT JOIN users u ON c.instructor_id = u.id
       WHERE c.id = $1`, [courseId]);
        if (course.rows.length === 0) {
            return res.status(404).json({ error: 'Course not found' });
        }
        // Get assignments
        const assignments = await database_1.pool.query(`SELECT id, title, description, question_text, due_date, points, created_at
       FROM assignments
       WHERE course_id = $1
       ORDER BY due_date DESC`, [courseId]);
        // Get announcements
        const announcements = await database_1.pool.query(`SELECT a.id, a.title, a.content, a.created_at,
              u.full_name as author_name
       FROM announcements a
       JOIN users u ON a.author_id = u.id
       WHERE a.course_id = $1
       ORDER BY a.created_at DESC`, [courseId]);
        res.json({
            message: 'Course details retrieved successfully',
            course: {
                ...course.rows[0],
                assignments: assignments.rows,
                announcements: announcements.rows
            }
        });
    }
    catch (error) {
        console.error('Error fetching course details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all assignments for a course
router.get('/courses/:courseId/assignments', async (req, res) => {
    try {
        const { courseId } = req.params;
        // Verify student is enrolled in the course
        const enrollment = await database_1.pool.query('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2', [req.user.userId, courseId]);
        if (enrollment.rows.length === 0) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You must be enrolled in this course to view its assignments'
            });
        }
        // Get assignments
        const assignments = await database_1.pool.query(`SELECT id, title, description, question_text, due_date, points, created_at
       FROM assignments
       WHERE course_id = $1
       ORDER BY due_date DESC`, [courseId]);
        res.json({
            message: 'Assignments retrieved successfully',
            courseId: courseId,
            assignments: assignments.rows
        });
    }
    catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all announcements for a course
router.get('/courses/:courseId/announcements', async (req, res) => {
    try {
        const { courseId } = req.params;
        // Verify student is enrolled in the course
        const enrollment = await database_1.pool.query('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2', [req.user.userId, courseId]);
        if (enrollment.rows.length === 0) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You must be enrolled in this course to view its announcements'
            });
        }
        // Get announcements
        const announcements = await database_1.pool.query(`SELECT a.id, a.title, a.content, a.created_at,
              u.full_name as author_name
       FROM announcements a
       JOIN users u ON a.author_id = u.id
       WHERE a.course_id = $1
       ORDER BY a.created_at DESC`, [courseId]);
        res.json({
            message: 'Announcements retrieved successfully',
            courseId: courseId,
            announcements: announcements.rows
        });
    }
    catch (error) {
        console.error('Error fetching announcements:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ========== COURSE MATERIALS ENDPOINTS ==========
// Get course materials for an enrolled course
router.get('/courses/:courseId/materials', async (req, res) => {
    try {
        const { courseId } = req.params;
        // Verify student is enrolled in the course
        const enrollment = await database_1.pool.query('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2', [req.user.userId, courseId]);
        if (enrollment.rows.length === 0) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You must be enrolled in this course to view its materials'
            });
        }
        // Get materials
        const result = await database_1.pool.query(`SELECT cm.*, u.full_name as uploader_name
       FROM course_materials cm
       JOIN users u ON cm.uploaded_by = u.id
       WHERE cm.course_id = $1
       ORDER BY cm.uploaded_at DESC`, [courseId]);
        res.json({
            message: 'Course materials retrieved successfully',
            materials: result.rows
        });
    }
    catch (error) {
        console.error('Error fetching course materials:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get signed URL for course material download
router.get('/materials/:id/download', async (req, res) => {
    try {
        const { id } = req.params;
        // Get material and verify student is enrolled
        const result = await database_1.pool.query(`SELECT cm.* FROM course_materials cm
       JOIN enrollments e ON cm.course_id = e.course_id
       WHERE cm.id = $1 AND e.user_id = $2`, [id, req.user.userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Material not found or you are not enrolled in this course'
            });
        }
        const material = result.rows[0];
        // Generate signed URL (valid for 60 minutes)
        const signedUrl = await (0, storage_1.generateSignedUrl)(material.file_path, 60);
        res.json({
            message: 'Download URL generated successfully',
            url: signedUrl,
            fileName: material.file_name
        });
    }
    catch (error) {
        console.error('Error generating download URL:', error);
        res.status(500).json({ error: 'Failed to generate download URL' });
    }
});
// ========== ASSIGNMENT SUBMISSION ENDPOINTS ==========
// Get assignment details with files
router.get('/assignments/:assignmentId', async (req, res) => {
    try {
        const { assignmentId } = req.params;
        // Get assignment details
        const assignmentResult = await database_1.pool.query(`SELECT a.*, c.id as course_id, c.title as course_title
       FROM assignments a
       JOIN courses c ON a.course_id = c.id
       WHERE a.id = $1`, [assignmentId]);
        if (assignmentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Assignment not found' });
        }
        const assignment = assignmentResult.rows[0];
        // Verify student is enrolled in the course
        const enrollment = await database_1.pool.query('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2', [req.user.userId, assignment.course_id]);
        if (enrollment.rows.length === 0) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You must be enrolled in this course to view this assignment'
            });
        }
        // Get assignment files
        const filesResult = await database_1.pool.query(`SELECT af.*, u.full_name as uploader_name
       FROM assignment_files af
       JOIN users u ON af.uploaded_by = u.id
       WHERE af.assignment_id = $1
       ORDER BY af.uploaded_at DESC`, [assignmentId]);
        // Get student's submission if exists
        const submissionResult = await database_1.pool.query(`SELECT asub.*, json_agg(
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
       LEFT JOIN submission_files sf ON asub.id = sf.submission_id
       WHERE asub.assignment_id = $1 AND asub.student_id = $2
       GROUP BY asub.id`, [assignmentId, req.user.userId]);
        res.json({
            message: 'Assignment details retrieved successfully',
            assignment: {
                ...assignment,
                assignmentFiles: filesResult.rows,
                submission: submissionResult.rows.length > 0 ? submissionResult.rows[0] : null
            }
        });
    }
    catch (error) {
        console.error('Error fetching assignment details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Submit assignment
router.post('/assignments/:assignmentId/submit', upload_1.uploadMultipleFiles, upload_1.handleMulterError, async (req, res) => {
    const client = await database_1.pool.connect();
    try {
        const { assignmentId } = req.params;
        const { submissionText } = req.body;
        const files = req.files;
        // Get assignment and verify enrollment
        const assignmentResult = await database_1.pool.query(`SELECT a.*, c.id as course_id
       FROM assignments a
       JOIN courses c ON a.course_id = c.id
       WHERE a.id = $1`, [assignmentId]);
        if (assignmentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Assignment not found' });
        }
        const assignment = assignmentResult.rows[0];
        // Verify student is enrolled
        const enrollment = await database_1.pool.query('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2', [req.user.userId, assignment.course_id]);
        if (enrollment.rows.length === 0) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You must be enrolled in this course to submit this assignment'
            });
        }
        await client.query('BEGIN');
        // Check if submission already exists
        const existingSubmission = await client.query('SELECT id FROM assignment_submissions WHERE assignment_id = $1 AND student_id = $2', [assignmentId, req.user.userId]);
        let submissionId;
        if (existingSubmission.rows.length > 0) {
            // Update existing submission
            submissionId = existingSubmission.rows[0].id;
            await client.query(`UPDATE assignment_submissions
         SET submission_text = $1, submitted_at = CURRENT_TIMESTAMP
         WHERE id = $2`, [submissionText || null, submissionId]);
            // Delete old files from database (GCS files will be overwritten with new timestamps)
            await client.query('DELETE FROM submission_files WHERE submission_id = $1', [submissionId]);
        }
        else {
            // Create new submission
            const submissionResult = await client.query(`INSERT INTO assignment_submissions (assignment_id, student_id, submission_text)
         VALUES ($1, $2, $3)
         RETURNING id`, [assignmentId, req.user.userId, submissionText || null]);
            submissionId = submissionResult.rows[0].id;
        }
        // Upload files to GCS
        const uploadedFiles = [];
        if (files && files.length > 0) {
            for (const file of files) {
                const timestamp = Date.now();
                const filePath = `submissions/${assignmentId}/${req.user.userId}/${timestamp}-${file.originalname}`;
                // Upload to GCS
                const uploadResult = await (0, storage_1.uploadFile)(file, filePath);
                // Save to database
                const fileResult = await client.query(`INSERT INTO submission_files (submission_id, file_name, file_path, file_size, file_type)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING *`, [submissionId, uploadResult.fileName, uploadResult.filePath, uploadResult.fileSize, file.mimetype]);
                uploadedFiles.push(fileResult.rows[0]);
            }
        }
        await client.query('COMMIT');
        res.status(201).json({
            message: 'Assignment submitted successfully',
            submission: {
                id: submissionId,
                assignment_id: assignmentId,
                student_id: req.user.userId,
                submission_text: submissionText,
                files: uploadedFiles
            }
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        console.error('Error submitting assignment:', error);
        res.status(500).json({ error: 'Failed to submit assignment' });
    }
    finally {
        client.release();
    }
});
// Get signed URL for assignment file download
router.get('/assignments/files/:fileId/download', async (req, res) => {
    try {
        const { fileId } = req.params;
        // Get file and verify student is enrolled in the course
        const result = await database_1.pool.query(`SELECT af.* FROM assignment_files af
       JOIN assignments a ON af.assignment_id = a.id
       JOIN enrollments e ON a.course_id = e.course_id
       WHERE af.id = $1 AND e.user_id = $2`, [fileId, req.user.userId]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'File not found or you are not enrolled in this course'
            });
        }
        const file = result.rows[0];
        // Generate signed URL (valid for 60 minutes)
        const signedUrl = await (0, storage_1.generateSignedUrl)(file.file_path, 60);
        res.json({
            message: 'Download URL generated successfully',
            url: signedUrl,
            fileName: file.file_name
        });
    }
    catch (error) {
        console.error('Error generating download URL:', error);
        res.status(500).json({ error: 'Failed to generate download URL' });
    }
});
// Get my submission for an assignment
router.get('/assignments/:assignmentId/my-submission', async (req, res) => {
    try {
        const { assignmentId } = req.params;
        // Verify assignment exists and student is enrolled
        const assignmentResult = await database_1.pool.query(`SELECT a.*, c.id as course_id
       FROM assignments a
       JOIN courses c ON a.course_id = c.id
       WHERE a.id = $1`, [assignmentId]);
        if (assignmentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Assignment not found' });
        }
        const assignment = assignmentResult.rows[0];
        const enrollment = await database_1.pool.query('SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2', [req.user.userId, assignment.course_id]);
        if (enrollment.rows.length === 0) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'You must be enrolled in this course'
            });
        }
        // Get submission
        const submissionResult = await database_1.pool.query(`SELECT asub.*, json_agg(
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
       LEFT JOIN submission_files sf ON asub.id = sf.submission_id
       WHERE asub.assignment_id = $1 AND asub.student_id = $2
       GROUP BY asub.id`, [assignmentId, req.user.userId]);
        if (submissionResult.rows.length === 0) {
            return res.json({
                message: 'No submission found',
                submission: null
            });
        }
        res.json({
            message: 'Submission retrieved successfully',
            submission: submissionResult.rows[0]
        });
    }
    catch (error) {
        console.error('Error fetching submission:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=student.js.map