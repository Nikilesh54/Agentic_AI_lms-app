import { pool } from '../../../config/database';
import { ITool, ToolInput, ToolOutput, ToolExecutionContext } from '../types';

/**
 * Search course materials tool
 * Performs full-text search on course materials
 */
export class SearchCourseMaterialsTool implements ITool {
  name = 'searchCourseMaterials';
  description = 'Search through course materials using keywords or topics';
  parameters = {
    type: 'object' as const,
    properties: {
      query: {
        type: 'string',
        description: 'Search query (keywords or topics)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 5)',
      },
    },
    required: ['query'],
  };

  async execute(input: ToolInput, context: ToolExecutionContext): Promise<ToolOutput> {
    try {
      const { query, limit = 5 } = input;
      const courseId = context.courseId;

      if (!courseId) {
        return {
          success: false,
          error: 'Course ID is required',
        };
      }

      // Full-text search on course materials
      const result = await pool.query(
        `SELECT
          cm.id,
          cm.file_name,
          cm.file_path,
          cm.file_type,
          cm.uploaded_at,
          ts_rank(to_tsvector('english', cm.file_name), plainto_tsquery('english', $1)) as relevance
        FROM course_materials cm
        WHERE cm.course_id = $2
          AND to_tsvector('english', cm.file_name) @@ plainto_tsquery('english', $1)
        ORDER BY relevance DESC, cm.uploaded_at DESC
        LIMIT $3`,
        [query, courseId, limit]
      );

      // Also search in context materials if available
      const contextResult = await pool.query(
        `SELECT
          ctx.id,
          ctx.content,
          cm.file_name,
          ctx.metadata,
          ts_rank(to_tsvector('english', ctx.content), plainto_tsquery('english', $1)) as relevance
        FROM context_materials ctx
        LEFT JOIN course_materials cm ON ctx.material_id = cm.id
        WHERE ctx.course_id = $2
          AND to_tsvector('english', ctx.content) @@ plainto_tsquery('english', $1)
        ORDER BY relevance DESC
        LIMIT $3`,
        [query, courseId, limit]
      );

      return {
        success: true,
        data: {
          materials: result.rows,
          contentChunks: contextResult.rows,
          query,
          totalFound: result.rows.length + contextResult.rows.length,
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

    if (!input.query || typeof input.query !== 'string') {
      errors.push('query is required and must be a string');
    }

    if (input.limit !== undefined && (typeof input.limit !== 'number' || input.limit < 1)) {
      errors.push('limit must be a positive number');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

/**
 * Get course materials list tool
 */
export class GetCourseMaterialsTool implements ITool {
  name = 'getCourseMaterials';
  description = 'Get a list of all course materials for the current course';
  parameters = {
    type: 'object' as const,
    properties: {
      fileType: {
        type: 'string',
        description: 'Filter by file type (optional)',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of materials to return (default: 20)',
      },
    },
    required: [],
  };

  async execute(input: ToolInput, context: ToolExecutionContext): Promise<ToolOutput> {
    try {
      const { fileType, limit = 20 } = input;
      const courseId = context.courseId;

      if (!courseId) {
        return {
          success: false,
          error: 'Course ID is required',
        };
      }

      let query = `
        SELECT
          cm.id,
          cm.file_name,
          cm.file_type,
          cm.file_size,
          cm.uploaded_at,
          u.full_name as uploaded_by_name
        FROM course_materials cm
        JOIN users u ON cm.uploaded_by = u.id
        WHERE cm.course_id = $1
      `;

      const params: any[] = [courseId];

      if (fileType) {
        query += ` AND cm.file_type = $2`;
        params.push(fileType);
        query += ` ORDER BY cm.uploaded_at DESC LIMIT $3`;
        params.push(limit);
      } else {
        query += ` ORDER BY cm.uploaded_at DESC LIMIT $2`;
        params.push(limit);
      }

      const result = await pool.query(query, params);

      return {
        success: true,
        data: {
          materials: result.rows,
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
    const errors: string[] = [];

    if (input.limit !== undefined && (typeof input.limit !== 'number' || input.limit < 1)) {
      errors.push('limit must be a positive number');
    }

    return {
      valid: errors.length === 0,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}
