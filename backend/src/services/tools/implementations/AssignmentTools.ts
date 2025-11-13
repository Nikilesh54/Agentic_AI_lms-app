import { pool } from '../../../config/database';
import { ITool, ToolInput, ToolOutput, ToolExecutionContext } from '../types';

/**
 * Get active assignments tool
 */
export class GetActiveAssignmentsTool implements ITool {
  name = 'getActiveAssignments';
  description = 'Get all active assignments for the current course';
  parameters = {
    type: 'object' as const,
    properties: {
      includePast: {
        type: 'boolean',
        description: 'Include past due assignments (default: false)',
      },
    },
    required: [],
  };

  async execute(input: ToolInput, context: ToolExecutionContext): Promise<ToolOutput> {
    try {
      const { includePast = false } = input;
      const courseId = context.courseId;
      const userId = context.userId;

      if (!courseId) {
        return {
          success: false,
          error: 'Course ID is required',
        };
      }

      let query = `
        SELECT
          a.id,
          a.title,
          a.description,
          a.question_text,
          a.due_date,
          a.points,
          a.created_at,
          CASE
            WHEN a.due_date < CURRENT_TIMESTAMP THEN 'overdue'
            WHEN a.due_date < CURRENT_TIMESTAMP + INTERVAL '7 days' THEN 'upcoming'
            ELSE 'active'
          END as status,
          asub.id as submission_id,
          asub.submitted_at,
          asub.grade,
          CASE WHEN asub.id IS NOT NULL THEN true ELSE false END as has_submitted
        FROM assignments a
        LEFT JOIN assignment_submissions asub
          ON a.id = asub.assignment_id AND asub.student_id = $2
        WHERE a.course_id = $1
      `;

      const params: any[] = [courseId, userId];

      if (!includePast) {
        query += ` AND (a.due_date >= CURRENT_TIMESTAMP OR asub.id IS NULL)`;
      }

      query += ` ORDER BY a.due_date ASC`;

      const result = await pool.query(query, params);

      return {
        success: true,
        data: {
          assignments: result.rows,
          totalCount: result.rows.length,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  validate(input: ToolInput): { valid: boolean; errors?: string[] } {
    return { valid: true };
  }
}

/**
 * Get assignment details tool
 */
export class GetAssignmentDetailsTool implements ITool {
  name = 'getAssignmentDetails';
  description = 'Get detailed information about a specific assignment';
  parameters = {
    type: 'object' as const,
    properties: {
      assignmentId: {
        type: 'number',
        description: 'The ID of the assignment',
      },
    },
    required: ['assignmentId'],
  };

  async execute(input: ToolInput, context: ToolExecutionContext): Promise<ToolOutput> {
    try {
      const { assignmentId } = input;
      const userId = context.userId;

      // Get assignment details
      const assignmentResult = await pool.query(
        `SELECT
          a.id,
          a.title,
          a.description,
          a.question_text,
          a.due_date,
          a.points,
          a.created_at,
          c.title as course_title
        FROM assignments a
        JOIN courses c ON a.course_id = c.id
        WHERE a.id = $1`,
        [assignmentId]
      );

      if (assignmentResult.rows.length === 0) {
        return {
          success: false,
          error: 'Assignment not found',
        };
      }

      const assignment = assignmentResult.rows[0];

      // Get assignment files
      const filesResult = await pool.query(
        `SELECT id, file_name, file_type, file_size
         FROM assignment_files
         WHERE assignment_id = $1`,
        [assignmentId]
      );

      // Get student's submission if exists
      const submissionResult = await pool.query(
        `SELECT
          id,
          submission_text,
          grade,
          feedback,
          submitted_at,
          graded_at
        FROM assignment_submissions
        WHERE assignment_id = $1 AND student_id = $2`,
        [assignmentId, userId]
      );

      return {
        success: true,
        data: {
          assignment,
          files: filesResult.rows,
          submission: submissionResult.rows[0] || null,
          hasSubmitted: submissionResult.rows.length > 0,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  validate(input: ToolInput): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!input.assignmentId || typeof input.assignmentId !== 'number') {
      errors.push('assignmentId is required and must be a number');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

/**
 * Get grading criteria tool (for instructors)
 */
export class GetGradingCriteriaTool implements ITool {
  name = 'getGradingCriteria';
  description = 'Get or suggest grading criteria for an assignment';
  parameters = {
    type: 'object' as const,
    properties: {
      assignmentId: {
        type: 'number',
        description: 'The ID of the assignment',
      },
      generateSuggestions: {
        type: 'boolean',
        description: 'Whether to generate AI suggestions for criteria',
      },
    },
    required: ['assignmentId'],
  };

  async execute(input: ToolInput, context: ToolExecutionContext): Promise<ToolOutput> {
    try {
      const { assignmentId, generateSuggestions = false } = input;

      // Only instructors and professors can access this
      if (context.userRole !== 'professor' && context.userRole !== 'root') {
        return {
          success: false,
          error: 'Unauthorized: Only instructors can access grading criteria',
        };
      }

      // Get assignment details
      const assignmentResult = await pool.query(
        `SELECT
          a.id,
          a.title,
          a.description,
          a.question_text,
          a.points
        FROM assignments a
        WHERE a.id = $1`,
        [assignmentId]
      );

      if (assignmentResult.rows.length === 0) {
        return {
          success: false,
          error: 'Assignment not found',
        };
      }

      const assignment = assignmentResult.rows[0];

      // Generate suggested criteria
      let suggestions = null;
      if (generateSuggestions) {
        suggestions = this.generateCriteriaSuggestions(assignment);
      }

      return {
        success: true,
        data: {
          assignment,
          suggestions,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  validate(input: ToolInput): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];

    if (!input.assignmentId || typeof input.assignmentId !== 'number') {
      errors.push('assignmentId is required and must be a number');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private generateCriteriaSuggestions(assignment: any): any {
    const totalPoints = assignment.points || 100;

    return {
      criteria: [
        {
          category: 'Understanding of Concepts',
          weight: 0.4,
          points: Math.round(totalPoints * 0.4),
          description: 'Demonstrates clear understanding of key concepts',
        },
        {
          category: 'Analysis and Critical Thinking',
          weight: 0.3,
          points: Math.round(totalPoints * 0.3),
          description: 'Shows analytical thinking and problem-solving skills',
        },
        {
          category: 'Completeness',
          weight: 0.2,
          points: Math.round(totalPoints * 0.2),
          description: 'Addresses all parts of the assignment',
        },
        {
          category: 'Clarity and Organization',
          weight: 0.1,
          points: Math.round(totalPoints * 0.1),
          description: 'Well-organized and clearly presented',
        },
      ],
      rubric: {
        excellent: '90-100%: Exceeds expectations in all criteria',
        good: '80-89%: Meets all criteria with minor issues',
        satisfactory: '70-79%: Meets most criteria with some gaps',
        needsImprovement: 'Below 70%: Missing key elements or understanding',
      },
    };
  }
}
