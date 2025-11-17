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

    // Migration 1: Multi-agent HITL schema
    const hitlMigrationPath = path.join(__dirname, 'multi-agent-hitl-schema.sql');
    const hitlMigrationSQL = fs.readFileSync(hitlMigrationPath, 'utf8');
    await client.query(hitlMigrationSQL);
    console.log('✓ Multi-agent HITL schema migration completed successfully');

    // Migration 2: New Agent System (Grading Assistant, Chatbot, Integrity Verifier)
    const newAgentMigrationPath = path.join(__dirname, 'new-agent-system-schema.sql');
    const newAgentMigrationSQL = fs.readFileSync(newAgentMigrationPath, 'utf8');
    await client.query(newAgentMigrationSQL);
    console.log('✓ New Agent System schema migration completed successfully');

  } catch (error) {
    console.error('Error running migrations:', error);
    throw error;
  } finally {
    client.release();
  }
}
