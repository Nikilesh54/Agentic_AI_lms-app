import express, { Request, Response } from 'express';
import { pool } from '../config/database';
import { authenticate, authorize } from '../middleware/auth';

const router = express.Router();

// Only root admins can view usage logs
router.use(authenticate);
router.use(authorize('root'));

// Get usage summary per user
router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { actionType, startDate, endDate } = req.query;

    let query = `
      SELECT
        u.id as user_id,
        u.full_name,
        u.email,
        u.role,
        COUNT(*) FILTER (WHERE l.action_type = 'file_upload') as file_uploads,
        COUNT(*) FILTER (WHERE l.action_type = 'llm_request') as llm_requests,
        COUNT(*) FILTER (WHERE l.action_type = 'grading_request') as grading_requests,
        COUNT(*) FILTER (WHERE l.action_type = 'file_download') as file_downloads,
        COUNT(*) as total_actions,
        MAX(l.created_at) as last_activity
      FROM users u
      LEFT JOIN api_usage_logs l ON u.id = l.user_id
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (actionType) {
      params.push(actionType);
      conditions.push(`l.action_type = $${params.length}`);
    }

    if (startDate) {
      params.push(startDate);
      conditions.push(`l.created_at >= $${params.length}::timestamp`);
    }

    if (endDate) {
      params.push(endDate);
      conditions.push(`l.created_at <= $${params.length}::timestamp`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += `
      GROUP BY u.id, u.full_name, u.email, u.role
      ORDER BY total_actions DESC
    `;

    const result = await pool.query(query, params);

    res.json({
      message: 'Usage summary retrieved successfully',
      summary: result.rows,
    });
  } catch (error) {
    console.error('Error fetching usage summary:', error);
    res.status(500).json({ error: 'Failed to fetch usage summary' });
  }
});

// Get detailed logs (paginated)
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const {
      userId,
      actionType,
      startDate,
      endDate,
      limit = '50',
      offset = '0',
    } = req.query;

    let query = `
      SELECT
        l.*,
        u.full_name,
        u.email,
        u.role
      FROM api_usage_logs l
      JOIN users u ON l.user_id = u.id
    `;

    const params: any[] = [];
    const conditions: string[] = [];

    if (userId) {
      params.push(userId);
      conditions.push(`l.user_id = $${params.length}`);
    }

    if (actionType) {
      params.push(actionType);
      conditions.push(`l.action_type = $${params.length}`);
    }

    if (startDate) {
      params.push(startDate);
      conditions.push(`l.created_at >= $${params.length}::timestamp`);
    }

    if (endDate) {
      params.push(endDate);
      conditions.push(`l.created_at <= $${params.length}::timestamp`);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    // Get total count for pagination
    const countQuery = query.replace(
      /SELECT[\s\S]*?FROM/,
      'SELECT COUNT(*) as total FROM'
    );
    const countResult = await pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Add ordering and pagination
    const parsedLimit = Math.min(parseInt(limit as string) || 50, 200);
    const parsedOffset = parseInt(offset as string) || 0;
    params.push(parsedLimit);
    query += ` ORDER BY l.created_at DESC LIMIT $${params.length}`;
    params.push(parsedOffset);
    query += ` OFFSET $${params.length}`;

    const result = await pool.query(query, params);

    res.json({
      message: 'Usage logs retrieved successfully',
      logs: result.rows,
      pagination: {
        total,
        limit: parsedLimit,
        offset: parsedOffset,
      },
    });
  } catch (error) {
    console.error('Error fetching usage logs:', error);
    res.status(500).json({ error: 'Failed to fetch usage logs' });
  }
});

// Get overall platform stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const params: any[] = [];
    let dateFilter = '';

    if (startDate) {
      params.push(startDate);
      dateFilter += ` AND created_at >= $${params.length}::timestamp`;
    }
    if (endDate) {
      params.push(endDate);
      dateFilter += ` AND created_at <= $${params.length}::timestamp`;
    }

    const statsQuery = `
      SELECT
        COUNT(*) FILTER (WHERE action_type = 'file_upload') as total_file_uploads,
        COUNT(*) FILTER (WHERE action_type = 'llm_request') as total_llm_requests,
        COUNT(*) FILTER (WHERE action_type = 'grading_request') as total_grading_requests,
        COUNT(*) FILTER (WHERE action_type = 'file_download') as total_file_downloads,
        COUNT(*) as total_actions,
        COUNT(DISTINCT user_id) as unique_users
      FROM api_usage_logs
      WHERE 1=1 ${dateFilter}
    `;

    const dailyQuery = `
      SELECT
        DATE(created_at) as date,
        action_type,
        COUNT(*) as count
      FROM api_usage_logs
      WHERE created_at >= NOW() - INTERVAL '30 days' ${dateFilter}
      GROUP BY DATE(created_at), action_type
      ORDER BY date DESC
    `;

    const [statsResult, dailyResult] = await Promise.all([
      pool.query(statsQuery, params),
      pool.query(dailyQuery, params),
    ]);

    res.json({
      message: 'Usage stats retrieved successfully',
      stats: statsResult.rows[0],
      dailyBreakdown: dailyResult.rows,
    });
  } catch (error) {
    console.error('Error fetching usage stats:', error);
    res.status(500).json({ error: 'Failed to fetch usage stats' });
  }
});

export default router;
