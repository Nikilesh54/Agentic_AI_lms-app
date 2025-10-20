"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("../config/database");
const auth_1 = require("../middleware/auth");
const router = express_1.default.Router();
// Apply authentication and authorization to all professor routes
router.use(auth_1.authenticate);
router.use((0, auth_1.authorize)('professor'));
router.use(auth_1.requireApprovedProfessor);
// Get professor's assigned course
router.get('/course', async (req, res) => {
    try {
        const result = await database_1.pool.query(`SELECT c.id, c.title, c.description, c.created_at, c.updated_at,
              COUNT(DISTINCT e.id) as enrolled_students_count
       FROM course_instructors ci
       JOIN courses c ON ci.course_id = c.id
       LEFT JOIN enrollments e ON c.id = e.course_id
       WHERE ci.user_id = $1
       GROUP BY c.id`, [req.user.userId]);
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
    }
    catch (error) {
        console.error('Error fetching professor course:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all students enrolled in professor's course
router.get('/students', async (req, res) => {
    try {
        // First get the professor's course
        const courseResult = await database_1.pool.query('SELECT course_id FROM course_instructors WHERE user_id = $1', [req.user.userId]);
        if (courseResult.rows.length === 0) {
            return res.status(404).json({
                error: 'No course assigned',
                message: 'You are not assigned to any course yet'
            });
        }
        const courseId = courseResult.rows[0].course_id;
        // Get all enrolled students
        const studentsResult = await database_1.pool.query(`SELECT u.id, u.full_name, u.email, e.enrolled_at
       FROM enrollments e
       JOIN users u ON e.user_id = u.id
       WHERE e.course_id = $1 AND u.role = 'student'
       ORDER BY u.full_name ASC`, [courseId]);
        res.json({
            message: 'Students retrieved successfully',
            courseId: courseId,
            students: studentsResult.rows
        });
    }
    catch (error) {
        console.error('Error fetching enrolled students:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update course details
router.put('/course', async (req, res) => {
    try {
        const { title, description } = req.body;
        // Get professor's course
        const courseResult = await database_1.pool.query('SELECT course_id FROM course_instructors WHERE user_id = $1', [req.user.userId]);
        if (courseResult.rows.length === 0) {
            return res.status(404).json({
                error: 'No course assigned',
                message: 'You are not assigned to any course yet'
            });
        }
        const courseId = courseResult.rows[0].course_id;
        // Update course
        const result = await database_1.pool.query(`UPDATE courses
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`, [title, description, courseId]);
        res.json({
            message: 'Course updated successfully',
            course: result.rows[0]
        });
    }
    catch (error) {
        console.error('Error updating course:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all assignments for professor's course
router.get('/assignments', async (req, res) => {
    try {
        // Get professor's course
        const courseResult = await database_1.pool.query('SELECT course_id FROM course_instructors WHERE user_id = $1', [req.user.userId]);
        if (courseResult.rows.length === 0) {
            return res.status(404).json({
                error: 'No course assigned'
            });
        }
        const courseId = courseResult.rows[0].course_id;
        // Get assignments
        const result = await database_1.pool.query(`SELECT id, title, description, due_date, points, created_at, updated_at
       FROM assignments
       WHERE course_id = $1
       ORDER BY due_date DESC`, [courseId]);
        res.json({
            message: 'Assignments retrieved successfully',
            courseId: courseId,
            assignments: result.rows
        });
    }
    catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Create a new assignment
router.post('/assignments', async (req, res) => {
    try {
        const { title, description, dueDate, points } = req.body;
        if (!title) {
            return res.status(400).json({ error: 'Assignment title is required' });
        }
        // Get professor's course
        const courseResult = await database_1.pool.query('SELECT course_id FROM course_instructors WHERE user_id = $1', [req.user.userId]);
        if (courseResult.rows.length === 0) {
            return res.status(404).json({
                error: 'No course assigned'
            });
        }
        const courseId = courseResult.rows[0].course_id;
        // Create assignment
        const result = await database_1.pool.query(`INSERT INTO assignments (title, description, course_id, due_date, points)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`, [title, description || null, courseId, dueDate || null, points || 100]);
        res.status(201).json({
            message: 'Assignment created successfully',
            assignment: result.rows[0]
        });
    }
    catch (error) {
        console.error('Error creating assignment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Update an assignment
router.put('/assignments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, dueDate, points } = req.body;
        // Get professor's course
        const courseResult = await database_1.pool.query('SELECT course_id FROM course_instructors WHERE user_id = $1', [req.user.userId]);
        if (courseResult.rows.length === 0) {
            return res.status(404).json({
                error: 'No course assigned'
            });
        }
        const courseId = courseResult.rows[0].course_id;
        // Verify assignment belongs to professor's course
        const assignmentCheck = await database_1.pool.query('SELECT id FROM assignments WHERE id = $1 AND course_id = $2', [id, courseId]);
        if (assignmentCheck.rows.length === 0) {
            return res.status(404).json({
                error: 'Assignment not found or does not belong to your course'
            });
        }
        // Update assignment
        const result = await database_1.pool.query(`UPDATE assignments
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           due_date = COALESCE($3, due_date),
           points = COALESCE($4, points),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`, [title, description, dueDate, points, id]);
        res.json({
            message: 'Assignment updated successfully',
            assignment: result.rows[0]
        });
    }
    catch (error) {
        console.error('Error updating assignment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Delete an assignment
router.delete('/assignments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Get professor's course
        const courseResult = await database_1.pool.query('SELECT course_id FROM course_instructors WHERE user_id = $1', [req.user.userId]);
        if (courseResult.rows.length === 0) {
            return res.status(404).json({
                error: 'No course assigned'
            });
        }
        const courseId = courseResult.rows[0].course_id;
        // Delete assignment (must belong to professor's course)
        const result = await database_1.pool.query('DELETE FROM assignments WHERE id = $1 AND course_id = $2 RETURNING id, title', [id, courseId]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Assignment not found or does not belong to your course'
            });
        }
        res.json({
            message: 'Assignment deleted successfully',
            assignment: result.rows[0]
        });
    }
    catch (error) {
        console.error('Error deleting assignment:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Get all announcements for professor's course
router.get('/announcements', async (req, res) => {
    try {
        // Get professor's course
        const courseResult = await database_1.pool.query('SELECT course_id FROM course_instructors WHERE user_id = $1', [req.user.userId]);
        if (courseResult.rows.length === 0) {
            return res.status(404).json({
                error: 'No course assigned'
            });
        }
        const courseId = courseResult.rows[0].course_id;
        // Get announcements
        const result = await database_1.pool.query(`SELECT a.id, a.title, a.content, a.created_at, a.updated_at,
              u.full_name as author_name
       FROM announcements a
       JOIN users u ON a.author_id = u.id
       WHERE a.course_id = $1
       ORDER BY a.created_at DESC`, [courseId]);
        res.json({
            message: 'Announcements retrieved successfully',
            courseId: courseId,
            announcements: result.rows
        });
    }
    catch (error) {
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
        const courseResult = await database_1.pool.query('SELECT course_id FROM course_instructors WHERE user_id = $1', [req.user.userId]);
        if (courseResult.rows.length === 0) {
            return res.status(404).json({
                error: 'No course assigned'
            });
        }
        const courseId = courseResult.rows[0].course_id;
        // Create announcement
        const result = await database_1.pool.query(`INSERT INTO announcements (title, content, course_id, author_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`, [title, content, courseId, req.user.userId]);
        res.status(201).json({
            message: 'Announcement created successfully',
            announcement: result.rows[0]
        });
    }
    catch (error) {
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
        const courseResult = await database_1.pool.query('SELECT course_id FROM course_instructors WHERE user_id = $1', [req.user.userId]);
        if (courseResult.rows.length === 0) {
            return res.status(404).json({
                error: 'No course assigned'
            });
        }
        const courseId = courseResult.rows[0].course_id;
        // Verify announcement belongs to professor's course
        const announcementCheck = await database_1.pool.query('SELECT id FROM announcements WHERE id = $1 AND course_id = $2', [id, courseId]);
        if (announcementCheck.rows.length === 0) {
            return res.status(404).json({
                error: 'Announcement not found or does not belong to your course'
            });
        }
        // Update announcement
        const result = await database_1.pool.query(`UPDATE announcements
       SET title = COALESCE($1, title),
           content = COALESCE($2, content),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`, [title, content, id]);
        res.json({
            message: 'Announcement updated successfully',
            announcement: result.rows[0]
        });
    }
    catch (error) {
        console.error('Error updating announcement:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Delete an announcement
router.delete('/announcements/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Get professor's course
        const courseResult = await database_1.pool.query('SELECT course_id FROM course_instructors WHERE user_id = $1', [req.user.userId]);
        if (courseResult.rows.length === 0) {
            return res.status(404).json({
                error: 'No course assigned'
            });
        }
        const courseId = courseResult.rows[0].course_id;
        // Delete announcement (must belong to professor's course)
        const result = await database_1.pool.query('DELETE FROM announcements WHERE id = $1 AND course_id = $2 RETURNING id, title', [id, courseId]);
        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Announcement not found or does not belong to your course'
            });
        }
        res.json({
            message: 'Announcement deleted successfully',
            announcement: result.rows[0]
        });
    }
    catch (error) {
        console.error('Error deleting announcement:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=professor.js.map