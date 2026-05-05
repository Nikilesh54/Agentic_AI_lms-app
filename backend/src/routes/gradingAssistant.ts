import express, { Request, Response } from 'express';
import { pool } from '../config/database';
import { authenticate } from '../middleware/auth';
import { GradingAssistantAgent } from '../services/agents/GradingAssistantAgent';
import {
  validateRequired,
  validatePositiveInteger,
  validateRubricCriteria,
  validatePoints
} from '../middleware/validation';
import { logUsage } from '../utils/usageLogger';

const router = express.Router();

async function professorCanAccessAssignment(userId: number, assignmentId: number) {
  const result = await pool.query(
    `SELECT a.course_id
     FROM assignments a
     JOIN courses c ON a.course_id = c.id
     LEFT JOIN course_instructors ci ON ci.course_id = a.course_id AND ci.user_id = $2
     WHERE a.id = $1 AND (c.instructor_id = $2 OR ci.user_id IS NOT NULL)`,
    [assignmentId, userId]
  );

  return result.rows[0] || null;
}

async function professorCanAccessSubmission(userId: number, submissionId: number) {
  const result = await pool.query(
    `SELECT sub.id, sub.assignment_id, sub.student_id, a.course_id, a.points
     FROM assignment_submissions sub
     JOIN assignments a ON sub.assignment_id = a.id
     JOIN courses c ON a.course_id = c.id
     LEFT JOIN course_instructors ci ON ci.course_id = a.course_id AND ci.user_id = $2
     WHERE sub.id = $1 AND (c.instructor_id = $2 OR ci.user_id IS NOT NULL)`,
    [submissionId, userId]
  );

  return result.rows[0] || null;
}

/**
 * @route   POST /api/grading-assistant/generate-tentative-grade
 * @desc    Generate tentative grade for a submission
 * @access  Private (Student or Professor)
 */
router.post('/generate-tentative-grade',
  authenticate,
  validateRequired('submissionId'),
  validatePositiveInteger('submissionId', 'body'),
  async (req: Request, res: Response): Promise<void> => {
  try {
    const { submissionId } = req.body;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    if (!['student', 'professor', 'root'].includes(userRole)) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const accessCondition = userRole === 'student'
      ? 'sub.student_id = $2'
      : userRole === 'professor'
        ? '(c.instructor_id = $2 OR ci.user_id IS NOT NULL)'
        : '1 = 1';

    // Get submission details
    const submissionResult = await pool.query(
      `SELECT sub.*, a.id as assignment_id, a.title, a.description, a.question_text, a.points,
              sf.file_name
       FROM assignment_submissions sub
       JOIN assignments a ON sub.assignment_id = a.id
       JOIN courses c ON a.course_id = c.id
       LEFT JOIN course_instructors ci ON ci.course_id = a.course_id AND ci.user_id = $2
       LEFT JOIN submission_files sf ON sub.id = sf.submission_id
       WHERE sub.id = $1 AND ${accessCondition}`,
      [submissionId, userId]
    );

    if (submissionResult.rows.length === 0) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }

    const submission = submissionResult.rows[0];
    const files = submissionResult.rows.map(row => row.file_name).filter(Boolean);

    // Get grading rubric
    const rubricResult = await pool.query(
      'SELECT * FROM grading_rubrics WHERE assignment_id = $1',
      [submission.assignment_id]
    );

    const rubric = rubricResult.rows.length > 0 ? {
      id: rubricResult.rows[0].id,
      assignment_id: rubricResult.rows[0].assignment_id,
      rubric_name: rubricResult.rows[0].rubric_name,
      criteria: rubricResult.rows[0].criteria,
      total_points: rubricResult.rows[0].total_points
    } : null;

    // Generate tentative grade
    const gradingAgent = new GradingAssistantAgent();
    const tentativeGrade = await gradingAgent.generateTentativeGrade(
      submissionId,
      submission.assignment_id,
      submission.student_id,
      submission.submission_text || '',
      files,
      rubric
    );

    // Log grading LLM usage
    logUsage({
      userId,
      actionType: 'grading_request',
      endpoint: '/api/grading-assistant/generate-tentative-grade',
      method: 'POST',
      statusCode: 200,
      metadata: {
        submissionId,
        assignmentId: submission.assignment_id,
        assignmentTitle: submission.title,
      },
    });

    res.status(200).json({
      success: true,
      tentativeGrade
    });

  } catch (error: any) {
    console.error('Error generating tentative grade:', error);
    res.status(500).json({ error: error.message || 'Failed to generate tentative grade' });
  }
});

/**
 * @route   GET /api/grading-assistant/tentative-grade/:submissionId
 * @desc    Get tentative grade for a submission
 * @access  Private (Student or Professor)
 */
router.get('/tentative-grade/:submissionId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { submissionId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Check access rights
    if (userRole === 'student') {
      // Students can only view their own tentative grades
      const submissionCheck = await pool.query(
        'SELECT student_id FROM assignment_submissions WHERE id = $1',
        [submissionId]
      );

      if (submissionCheck.rows.length === 0 || submissionCheck.rows[0].student_id !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    } else if (userRole === 'professor') {
      const submissionAccess = await professorCanAccessSubmission(userId, parseInt(submissionId, 10));
      if (!submissionAccess) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    } else if (userRole !== 'root') {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    // Get tentative grade
    const result = await pool.query(
      'SELECT * FROM tentative_grades WHERE submission_id = $1',
      [submissionId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No tentative grade found' });
      return;
    }

    res.status(200).json({
      success: true,
      tentativeGrade: result.rows[0]
    });

  } catch (error: any) {
    console.error('Error fetching tentative grade:', error);
    res.status(500).json({ error: 'Failed to fetch tentative grade' });
  }
});

/**
 * @route   POST /api/grading-assistant/finalize-grade/:tentativeGradeId
 * @desc    Finalize a tentative grade (Professor only)
 * @access  Private (Professor)
 */
router.post('/finalize-grade/:tentativeGradeId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { tentativeGradeId } = req.params;
    const { finalGrade, feedback } = req.body;
    const userId = req.user!.userId;
    const userRole = req.user!.role;
    const parsedFinalGrade = parseFloat(finalGrade);

    if (userRole !== 'professor') {
      res.status(403).json({ error: 'Only professors can finalize grades' });
      return;
    }

    if (Number.isNaN(parsedFinalGrade) || parsedFinalGrade < 0) {
      res.status(400).json({ error: 'Final grade must be a non-negative number' });
      return;
    }

    // Get tentative grade details
    const tentativeResult = await pool.query(
      'SELECT * FROM tentative_grades WHERE id = $1',
      [tentativeGradeId]
    );

    if (tentativeResult.rows.length === 0) {
      res.status(404).json({ error: 'Tentative grade not found' });
      return;
    }

    const tentativeGrade = tentativeResult.rows[0];
    const submissionAccess = await professorCanAccessSubmission(userId, tentativeGrade.submission_id);

    if (!submissionAccess) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const maxPoints = parseFloat(submissionAccess.points || tentativeGrade.max_points || 100);
    if (parsedFinalGrade > maxPoints) {
      res.status(400).json({ error: `Final grade must be between 0 and ${maxPoints}` });
      return;
    }

    // Update the actual submission with the final grade
    const submissionResult = await pool.query(
      `UPDATE assignment_submissions
       SET grade = $1, feedback = $2, graded_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [parsedFinalGrade, feedback || null, tentativeGrade.submission_id]
    );

    // Mark tentative grade as finalized
    const finalTentativeResult = await pool.query(
      `UPDATE tentative_grades
       SET is_final = true, finalized_at = CURRENT_TIMESTAMP, finalized_by = $1
       WHERE id = $2
       RETURNING *`,
      [userId, tentativeGradeId]
    );

    res.status(200).json({
      success: true,
      message: 'Grade finalized successfully',
      submission: submissionResult.rows[0],
      tentativeGrade: finalTentativeResult.rows[0]
    });

  } catch (error: any) {
    console.error('Error finalizing grade:', error);
    res.status(500).json({ error: 'Failed to finalize grade' });
  }
});

/**
 * @route   POST /api/grading-assistant/create-rubric
 * @desc    Create a grading rubric for an assignment (Professor only)
 * @access  Private (Professor)
 */
router.post('/create-rubric',
  authenticate,
  validateRequired('assignmentId', 'rubricName', 'criteria', 'totalPoints'),
  validatePositiveInteger('assignmentId', 'body'),
  validateRubricCriteria(),
  validatePoints('totalPoints', 10000),
  async (req: Request, res: Response): Promise<void> => {
  try {
    const { assignmentId, rubricName, criteria, totalPoints } = req.body;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    if (userRole !== 'professor') {
      res.status(403).json({ error: 'Only professors can create rubrics' });
      return;
    }

    const assignment = await professorCanAccessAssignment(userId, assignmentId);

    if (!assignment) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const courseId = assignment.course_id;

    // Create rubric
    const result = await pool.query(
      `INSERT INTO grading_rubrics (assignment_id, course_id, rubric_name, criteria, total_points, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [assignmentId, courseId, rubricName, JSON.stringify(criteria), totalPoints, userId]
    );

    res.status(201).json({
      success: true,
      rubric: result.rows[0]
    });

  } catch (error: any) {
    console.error('Error creating rubric:', error);
    res.status(500).json({ error: 'Failed to create rubric' });
  }
});

/**
 * @route   PUT /api/grading-assistant/rubric/:assignmentId
 * @desc    Update a grading rubric for an assignment (Professor only)
 * @access  Private (Professor)
 */
router.put('/rubric/:assignmentId',
  authenticate,
  validatePositiveInteger('assignmentId', 'params'),
  validateRequired('rubricName', 'criteria', 'totalPoints'),
  validateRubricCriteria(),
  validatePoints('totalPoints', 10000),
  async (req: Request, res: Response): Promise<void> => {
  try {
    const assignmentId = parseInt(req.params.assignmentId, 10);
    const { rubricName, criteria, totalPoints } = req.body;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    if (userRole !== 'professor') {
      res.status(403).json({ error: 'Only professors can update rubrics' });
      return;
    }

    const assignment = await professorCanAccessAssignment(userId, assignmentId);
    if (!assignment) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const result = await pool.query(
      `UPDATE grading_rubrics
       SET rubric_name = $1, criteria = $2, total_points = $3, updated_at = CURRENT_TIMESTAMP
       WHERE assignment_id = $4
       RETURNING *`,
      [rubricName, JSON.stringify(criteria), totalPoints, assignmentId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No rubric found for this assignment' });
      return;
    }

    res.status(200).json({
      success: true,
      rubric: result.rows[0]
    });
  } catch (error: any) {
    console.error('Error updating rubric:', error);
    res.status(500).json({ error: 'Failed to update rubric' });
  }
});

/**
 * @route   DELETE /api/grading-assistant/rubric/:assignmentId
 * @desc    Delete a grading rubric for an assignment (Professor only)
 * @access  Private (Professor)
 */
router.delete('/rubric/:assignmentId',
  authenticate,
  validatePositiveInteger('assignmentId', 'params'),
  async (req: Request, res: Response): Promise<void> => {
  try {
    const assignmentId = parseInt(req.params.assignmentId, 10);
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    if (userRole !== 'professor') {
      res.status(403).json({ error: 'Only professors can delete rubrics' });
      return;
    }

    const assignment = await professorCanAccessAssignment(userId, assignmentId);
    if (!assignment) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const result = await pool.query(
      'DELETE FROM grading_rubrics WHERE assignment_id = $1 RETURNING id',
      [assignmentId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No rubric found for this assignment' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Rubric deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting rubric:', error);
    res.status(500).json({ error: 'Failed to delete rubric' });
  }
});

/**
 * @route   GET /api/grading-assistant/rubric/:assignmentId
 * @desc    Get rubric for an assignment
 * @access  Private
 */
router.get('/rubric/:assignmentId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { assignmentId } = req.params;
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    if (userRole === 'professor') {
      const assignment = await professorCanAccessAssignment(userId, parseInt(assignmentId, 10));
      if (!assignment) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }
    }

    const result = await pool.query(
      'SELECT * FROM grading_rubrics WHERE assignment_id = $1',
      [assignmentId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'No rubric found for this assignment' });
      return;
    }

    res.status(200).json({
      success: true,
      rubric: result.rows[0]
    });

  } catch (error: any) {
    console.error('Error fetching rubric:', error);
    res.status(500).json({ error: 'Failed to fetch rubric' });
  }
});

export default router;
