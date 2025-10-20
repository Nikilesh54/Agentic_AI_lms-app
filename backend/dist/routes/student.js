"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
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
        const assignments = await database_1.pool.query(`SELECT id, title, description, due_date, points, created_at
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
        const assignments = await database_1.pool.query(`SELECT id, title, description, due_date, points, created_at
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
exports.default = router;
//# sourceMappingURL=student.js.map