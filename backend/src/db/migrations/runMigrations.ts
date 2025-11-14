import { pool } from '../../config/database';
import fs from 'fs';
import path from 'path';

/**
 * Run database migrations
 * This ensures the multi-agent HITL schema is applied
 */
export async function runMigrations(): Promise<void> {
  const client = await pool.connect();

  try {
    console.log('Running database migrations...');

    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'multi-agent-hitl-schema.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    await client.query(migrationSQL);

    console.log('✓ Multi-agent HITL schema migration completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  } finally {
    client.release();
  }
}
