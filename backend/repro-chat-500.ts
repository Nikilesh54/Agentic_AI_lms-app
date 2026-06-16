import dotenv from 'dotenv';
dotenv.config();
import { pool } from './src/config/database';
import { SubjectChatbotAgent } from './src/services/agents/SubjectChatbotAgent';

(async () => {
  try {
    const s = await pool.query(
      'SELECT course_id, student_id FROM chat_sessions WHERE id = $1',
      [14]
    );
    const { course_id, student_id } = s.rows[0] || {};
    console.log('session 14 -> course_id', course_id, 'student_id', student_id);

    const c = await pool.query('SELECT id, title, description FROM courses WHERE id = $1', [course_id]);
    const course = c.rows[0];

    // insert a student message to get a real messageId (mirrors the route)
    const sm = await pool.query(
      `INSERT INTO chat_messages (session_id, sender_type, content) VALUES ($1,$2,$3) RETURNING id`,
      [14, 'student', 'what are the four components of computer system']
    );
    const messageId = sm.rows[0].id;

    const agent = new SubjectChatbotAgent();
    const resp = await agent.execute(
      {
        content: 'what are the four components of computer system',
        userId: student_id,
        role: 'student',
        sessionId: 14,
        messageId,
        timestamp: new Date(),
      } as any,
      {
        conversationHistory: [],
        courseMetadata: { id: course.id, title: course.title, description: course.description },
      } as any
    );

    console.log('OK content (first 200):', resp.content?.substring(0, 200));
    console.log('sources:', resp.sources?.length);
  } catch (e: any) {
    console.error('REPRO ERROR name:', e?.constructor?.name);
    console.error('REPRO ERROR message:', e?.message);
    console.error('REPRO ERROR stack:', e?.stack?.split('\n').slice(0, 8).join('\n'));
  } finally {
    await pool.end();
  }
})();
