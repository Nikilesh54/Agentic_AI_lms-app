import { pool } from '../../config/database';
import { AIContext } from '../ai/types';

/**
 * Context Builder - Builds AI context from various sources
 * Provides relevant information for AI responses
 */
export class ContextBuilder {
  /**
   * Build comprehensive context for AI
   */
  async buildContext(
    sessionId: number,
    message: string,
    options: {
      includeCourseMaterials?: boolean;
      includeAssignments?: boolean;
      includeProgress?: boolean;
      maxMaterials?: number;
    } = {}
  ): Promise<AIContext> {
    const {
      includeCourseMaterials = true,
      includeAssignments = true,
      includeProgress = false,
      maxMaterials = 5,
    } = options;

    // Get session info
    const session = await this.getSessionInfo(sessionId);

    if (!session) {
      throw new Error('Session not found');
    }

    const context: AIContext = {
      conversationHistory: await this.getConversationHistory(sessionId),
    };

    // Add course materials if requested
    if (includeCourseMaterials) {
      context.relevantMaterials = await this.searchRelevantMaterials(
        session.course_id,
        message,
        maxMaterials
      );
    }

    // Add assignments if requested
    if (includeAssignments) {
      context.activeAssignments = await this.getActiveAssignments(
        session.course_id,
        session.student_id
      );
    }

    // Add student progress if requested
    if (includeProgress) {
      context.studentContext = await this.getStudentProgress(
        session.course_id,
        session.student_id
      );
    }

    // Add course metadata
    context.courseMetadata = await this.getCourseMetadata(session.course_id);

    return context;
  }

  /**
   * Get session information
   */
  private async getSessionInfo(sessionId: number): Promise<any> {
    const result = await pool.query(
      `SELECT
        cs.id,
        cs.student_id,
        cs.course_id,
        cs.agent_id,
        u.role as user_role
      FROM chat_sessions cs
      JOIN users u ON cs.student_id = u.id
      WHERE cs.id = $1`,
      [sessionId]
    );

    return result.rows[0];
  }

  /**
   * Get conversation history
   */
  private async getConversationHistory(sessionId: number, limit: number = 10): Promise<any[]> {
    const result = await pool.query(
      `SELECT
        sender_type,
        content,
        created_at
      FROM chat_messages
      WHERE session_id = $1
        AND is_deleted = false
      ORDER BY created_at DESC
      LIMIT $2`,
      [sessionId, limit]
    );

    // Reverse to get chronological order
    return result.rows.reverse().map(row => ({
      role: row.sender_type === 'student' ? 'user' : 'assistant',
      content: row.content,
      metadata: {
        timestamp: row.created_at,
      },
    }));
  }

  /**
   * Search for relevant course materials
   */
  private async searchRelevantMaterials(
    courseId: number,
    query: string,
    limit: number
  ): Promise<any[]> {
    // First try context materials (chunked content)
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

    if (contextResult.rows.length > 0) {
      return contextResult.rows;
    }

    // Fallback to course materials metadata
    const materialsResult = await pool.query(
      `SELECT
        id,
        file_name,
        file_type,
        uploaded_at
      FROM course_materials
      WHERE course_id = $1
      ORDER BY uploaded_at DESC
      LIMIT $2`,
      [courseId, limit]
    );

    return materialsResult.rows;
  }

  /**
   * Get active assignments
   */
  private async getActiveAssignments(courseId: number, studentId: number): Promise<any[]> {
    const result = await pool.query(
      `SELECT
        a.id,
        a.title,
        a.description,
        a.due_date,
        a.points,
        asub.id as submission_id,
        asub.submitted_at
      FROM assignments a
      LEFT JOIN assignment_submissions asub
        ON a.id = asub.assignment_id AND asub.student_id = $2
      WHERE a.course_id = $1
        AND (a.due_date >= CURRENT_TIMESTAMP OR asub.id IS NULL)
      ORDER BY a.due_date ASC
      LIMIT 5`,
      [courseId, studentId]
    );

    return result.rows;
  }

  /**
   * Get student progress
   */
  private async getStudentProgress(courseId: number, studentId: number): Promise<any> {
    // Get assignment statistics
    const assignmentStats = await pool.query(
      `SELECT
        COUNT(*) as total_assignments,
        COUNT(asub.id) as submitted,
        AVG(asub.grade) as avg_grade
      FROM assignments a
      LEFT JOIN assignment_submissions asub
        ON a.id = asub.assignment_id AND asub.student_id = $2
      WHERE a.course_id = $1`,
      [courseId, studentId]
    );

    // Get recent activity
    const recentActivity = await pool.query(
      `SELECT
        COUNT(*) as message_count,
        MAX(created_at) as last_active
      FROM chat_messages cm
      JOIN chat_sessions cs ON cm.session_id = cs.id
      WHERE cs.course_id = $1
        AND cs.student_id = $2
        AND cm.created_at > NOW() - INTERVAL '7 days'`,
      [courseId, studentId]
    );

    return {
      assignments: assignmentStats.rows[0],
      recentActivity: recentActivity.rows[0],
    };
  }

  /**
   * Get course metadata
   */
  private async getCourseMetadata(courseId: number): Promise<any> {
    const result = await pool.query(
      `SELECT
        c.title,
        c.description,
        u.full_name as instructor_name
      FROM courses c
      JOIN users u ON c.instructor_id = u.id
      WHERE c.id = $1`,
      [courseId]
    );

    return result.rows[0];
  }

  /**
   * Store conversation context for future use
   */
  async storeContext(
    sessionId: number,
    contextKey: string,
    contextValue: any,
    expiresInHours?: number
  ): Promise<void> {
    const expiresAt = expiresInHours
      ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000)
      : null;

    await pool.query(
      `INSERT INTO agent_conversation_context
       (session_id, context_key, context_value, expires_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id, context_key)
       DO UPDATE SET
         context_value = $3,
         expires_at = $4,
         updated_at = CURRENT_TIMESTAMP`,
      [sessionId, contextKey, JSON.stringify(contextValue), expiresAt]
    );
  }

  /**
   * Retrieve stored context
   */
  async getStoredContext(sessionId: number, contextKey: string): Promise<any | null> {
    const result = await pool.query(
      `SELECT context_value
       FROM agent_conversation_context
       WHERE session_id = $1
         AND context_key = $2
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [sessionId, contextKey]
    );

    return result.rows[0]?.context_value || null;
  }
}

export const contextBuilder = new ContextBuilder();
