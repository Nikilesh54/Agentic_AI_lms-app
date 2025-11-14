import { pool } from '../../config/database';
import { TriggerDetector } from './TriggerDetector';
import { PolicyGuardrails } from '../policy/PolicyGuardrails';

export interface InterventionTrigger {
  type: string;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  requiresImmediate: boolean;
}

export interface InterventionContext {
  sessionId: number;
  messageId?: number;
  userId: number;
  userRole: string;
  message: string;
  aiResponse?: string;
  conversationHistory?: any[];
}

/**
 * Intervention Manager - Manages human intervention queue
 */
export class InterventionManager {
  private triggerDetector: TriggerDetector;
  private policyGuardrails: PolicyGuardrails;

  constructor() {
    this.triggerDetector = new TriggerDetector();
    this.policyGuardrails = new PolicyGuardrails();
  }

  /**
   * Check if intervention is needed
   */
  async checkForIntervention(context: InterventionContext): Promise<InterventionTrigger | null> {
    // Check policy violations first (highest priority)
    const policyViolation = await this.policyGuardrails.checkMessage(
      context.message,
      context.aiResponse || '',
      context
    );

    if (policyViolation) {
      return {
        type: 'POLICY_VIOLATION',
        reason: policyViolation.violation,
        priority: 'critical',
        requiresImmediate: true,
      };
    }

    // Check for intervention triggers
    const trigger = await this.triggerDetector.detect(context);

    return trigger;
  }

  /**
   * Create intervention request
   */
  async createIntervention(
    context: InterventionContext,
    trigger: InterventionTrigger
  ): Promise<number> {
    try {
      // Find appropriate professor to assign
      const assignedTo = await this.findProfessorForSession(context.sessionId);

      const result = await pool.query(
        `INSERT INTO intervention_queue
         (session_id, message_id, trigger_type, trigger_reason, priority, assigned_to, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          context.sessionId,
          context.messageId || null,
          trigger.type,
          trigger.reason,
          trigger.priority,
          assignedTo,
          'pending',
        ]
      );

      const interventionId = result.rows[0].id;

      // Send notification if immediate attention required
      if (trigger.requiresImmediate) {
        await this.sendImmediateNotification(interventionId, assignedTo);
      }

      return interventionId;
    } catch (error) {
      console.error('Error creating intervention:', error);
      throw error;
    }
  }

  /**
   * Get pending interventions
   */
  async getPendingInterventions(
    professorId?: number,
    priority?: string
  ): Promise<any[]> {
    try {
      let query = `
        SELECT
          iq.*,
          cs.session_name,
          c.title as course_name,
          u.full_name as student_name,
          u.email as student_email,
          EXTRACT(EPOCH FROM (NOW() - iq.created_at))/3600 as hours_pending
        FROM intervention_queue iq
        JOIN chat_sessions cs ON iq.session_id = cs.id
        JOIN courses c ON cs.course_id = c.id
        JOIN users u ON cs.student_id = u.id
        WHERE iq.status IN ('pending', 'in_progress')
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (professorId) {
        query += ` AND iq.assigned_to = $${paramIndex}`;
        params.push(professorId);
        paramIndex++;
      }

      if (priority) {
        query += ` AND iq.priority = $${paramIndex}`;
        params.push(priority);
        paramIndex++;
      }

      query += `
        ORDER BY
          CASE iq.priority
            WHEN 'critical' THEN 1
            WHEN 'high' THEN 2
            WHEN 'medium' THEN 3
            WHEN 'low' THEN 4
          END,
          iq.created_at ASC
      `;

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting pending interventions:', error);
      return [];
    }
  }

  /**
   * Assign intervention to professor
   */
  async assignIntervention(interventionId: number, professorId: number): Promise<void> {
    try {
      await pool.query(
        `UPDATE intervention_queue
         SET assigned_to = $1, status = 'in_progress', updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [professorId, interventionId]
      );
    } catch (error) {
      console.error('Error assigning intervention:', error);
      throw error;
    }
  }

  /**
   * Resolve intervention
   */
  async resolveIntervention(
    interventionId: number,
    resolutionNotes: string,
    resolvedBy: number
  ): Promise<void> {
    try {
      await pool.query(
        `UPDATE intervention_queue
         SET status = 'resolved',
             resolution_notes = $1,
             resolved_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [resolutionNotes, interventionId]
      );

      // Log the resolution
      await this.logResolution(interventionId, resolvedBy, resolutionNotes);
    } catch (error) {
      console.error('Error resolving intervention:', error);
      throw error;
    }
  }

  /**
   * Dismiss intervention
   */
  async dismissIntervention(
    interventionId: number,
    reason: string,
    dismissedBy: number
  ): Promise<void> {
    try {
      await pool.query(
        `UPDATE intervention_queue
         SET status = 'dismissed',
             resolution_notes = $1,
             resolved_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [reason, interventionId]
      );
    } catch (error) {
      console.error('Error dismissing intervention:', error);
      throw error;
    }
  }

  /**
   * Get intervention statistics
   */
  async getStatistics(startDate?: Date, endDate?: Date): Promise<any> {
    try {
      let query = `
        SELECT
          COUNT(*) as total_interventions,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress,
          COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
          COUNT(CASE WHEN status = 'dismissed' THEN 1 END) as dismissed,
          COUNT(CASE WHEN priority = 'critical' THEN 1 END) as critical_priority,
          COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority,
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/3600) as avg_resolution_hours,
          trigger_type,
          priority
        FROM intervention_queue
        WHERE 1=1
      `;

      const params: any[] = [];
      let paramIndex = 1;

      if (startDate) {
        query += ` AND created_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
      }

      if (endDate) {
        query += ` AND created_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
      }

      query += ' GROUP BY trigger_type, priority';

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      console.error('Error getting intervention statistics:', error);
      return [];
    }
  }

  /**
   * Find professor for a session
   */
  private async findProfessorForSession(sessionId: number): Promise<number | null> {
    try {
      const result = await pool.query(
        `SELECT c.instructor_id
         FROM chat_sessions cs
         JOIN courses c ON cs.course_id = c.id
         WHERE cs.id = $1`,
        [sessionId]
      );

      return result.rows[0]?.instructor_id || null;
    } catch (error) {
      console.error('Error finding professor:', error);
      return null;
    }
  }

  /**
   * Send immediate notification
   */
  private async sendImmediateNotification(
    interventionId: number,
    professorId: number | null
  ): Promise<void> {
    // TODO: Implement actual notification system (email, push, etc.)
    console.log(`🚨 IMMEDIATE INTERVENTION NEEDED: ID ${interventionId} for professor ${professorId}`);
  }

  /**
   * Log resolution
   */
  private async logResolution(
    interventionId: number,
    resolvedBy: number,
    notes: string
  ): Promise<void> {
    try {
      // Get intervention details to create learning
      const intervention = await pool.query(
        `SELECT
          iq.*,
          cm.content as message_content,
          cm.id as message_id
         FROM intervention_queue iq
         LEFT JOIN chat_messages cm ON iq.message_id = cm.id
         WHERE iq.id = $1`,
        [interventionId]
      );

      if (intervention.rows.length > 0) {
        const data = intervention.rows[0];

        // Create agent learning from this intervention
        await pool.query(
          `INSERT INTO agent_learnings
           (agent_id, intervention_id, original_response, learning_summary, learning_category)
           SELECT
             cs.agent_id,
             $1,
             $2,
             $3,
             $4
           FROM chat_sessions cs
           WHERE cs.id = $5`,
          [
            interventionId,
            data.message_content || '',
            notes,
            data.trigger_type,
            data.session_id,
          ]
        );
      }
    } catch (error) {
      console.error('Error logging resolution:', error);
    }
  }
}

export const interventionManager = new InterventionManager();
