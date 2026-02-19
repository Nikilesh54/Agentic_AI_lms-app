import { pool } from '../config/database';

type ActionType = 'file_upload' | 'llm_request' | 'grading_request' | 'file_download';

interface UsageLogEntry {
  userId: number;
  actionType: ActionType;
  endpoint: string;
  method: string;
  statusCode?: number;
  metadata?: Record<string, any>;
}

/**
 * Logs an API usage event to the database (non-blocking).
 * Fires and forgets — errors are logged but never thrown.
 */
export function logUsage(entry: UsageLogEntry): void {
  pool.query(
    `INSERT INTO api_usage_logs (user_id, action_type, endpoint, method, status_code, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      entry.userId,
      entry.actionType,
      entry.endpoint,
      entry.method,
      entry.statusCode || null,
      JSON.stringify(entry.metadata || {}),
    ]
  ).catch(err => {
    console.error('Failed to log API usage:', err.message);
  });
}
