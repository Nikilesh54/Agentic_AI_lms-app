import express, { Request, Response } from 'express';
import { pool } from '../config/database';
import { authenticate, authorize, requireActiveStatus } from '../middleware/auth';

const router = express.Router();

// Apply middleware to all routes
router.use(authenticate);
router.use(authorize('student', 'professor', 'root'));
router.use(requireActiveStatus);

// Helper function to simulate AI response (replace with actual AI integration later)
const generateAIResponse = async (message: string, courseId: number, sessionHistory: any[]): Promise<string> => {
  // This is a placeholder. Later, integrate with actual AI service (OpenAI, Anthropic, etc.)
  const responses = [
    `I understand you're asking about "${message}". Let me help you with that concept from your course materials.`,
    `Great question! Based on your course content, here's what I can explain: ${message}`,
    `Let me break this down for you. Regarding "${message}", here are the key points you should know...`,
    `That's an interesting topic! From your enrolled course materials, I can provide this explanation about ${message}...`,
  ];

  // Simulate thinking delay
  await new Promise(resolve => setTimeout(resolve, 500));

  return responses[Math.floor(Math.random() * responses.length)];
};

// Get all courses for chatbot selection (based on user role)
router.get('/courses', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let result;

    if (userRole === 'student') {
      // Students: Get enrolled courses
      result = await pool.query(
        `SELECT
          c.id,
          c.title,
          c.description,
          u.full_name as instructor_name,
          e.enrolled_at,
          COUNT(DISTINCT cs.id) as session_count,
          MAX(cs.last_activity_at) as last_chat_activity
        FROM courses c
        INNER JOIN enrollments e ON c.id = e.course_id
        LEFT JOIN users u ON c.instructor_id = u.id
        LEFT JOIN chat_sessions cs ON c.id = cs.course_id AND cs.student_id = $1 AND cs.status = 'active'
        WHERE e.user_id = $1
        GROUP BY c.id, c.title, c.description, u.full_name, e.enrolled_at
        ORDER BY last_chat_activity DESC NULLS LAST, e.enrolled_at DESC`,
        [userId]
      );
    } else if (userRole === 'professor') {
      // Professors: Get courses they teach
      result = await pool.query(
        `SELECT
          c.id,
          c.title,
          c.description,
          u.full_name as instructor_name,
          ci.assigned_at,
          COUNT(DISTINCT cs.id) as session_count,
          MAX(cs.last_activity_at) as last_chat_activity
        FROM courses c
        INNER JOIN course_instructors ci ON c.id = ci.course_id
        LEFT JOIN users u ON c.instructor_id = u.id
        LEFT JOIN chat_sessions cs ON c.id = cs.course_id AND cs.student_id = $1 AND cs.status = 'active'
        WHERE ci.user_id = $1
        GROUP BY c.id, c.title, c.description, u.full_name, ci.assigned_at
        ORDER BY last_chat_activity DESC NULLS LAST, ci.assigned_at DESC`,
        [userId]
      );
    } else if (userRole === 'root') {
      // Root: Get all courses
      result = await pool.query(
        `SELECT
          c.id,
          c.title,
          c.description,
          u.full_name as instructor_name,
          c.created_at,
          COUNT(DISTINCT cs.id) as session_count,
          MAX(cs.last_activity_at) as last_chat_activity
        FROM courses c
        LEFT JOIN users u ON c.instructor_id = u.id
        LEFT JOIN chat_sessions cs ON c.id = cs.course_id AND cs.student_id = $1 AND cs.status = 'active'
        GROUP BY c.id, c.title, c.description, u.full_name, c.created_at
        ORDER BY last_chat_activity DESC NULLS LAST, c.created_at DESC`,
        [userId]
      );
    }

    res.json({
      message: 'Courses retrieved successfully',
      courses: result?.rows || []
    });
  } catch (error) {
    console.error('Error fetching courses for chat:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// Get or create a chat session for a course
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    const { courseId } = req.body;

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!courseId) {
      return res.status(400).json({ error: 'Course ID is required' });
    }

    // Verify course access based on role
    let hasAccess = false;

    if (userRole === 'student') {
      const enrollmentCheck = await pool.query(
        'SELECT id FROM enrollments WHERE user_id = $1 AND course_id = $2',
        [userId, courseId]
      );
      hasAccess = enrollmentCheck.rows.length > 0;
    } else if (userRole === 'professor') {
      const instructorCheck = await pool.query(
        'SELECT id FROM course_instructors WHERE user_id = $1 AND course_id = $2',
        [userId, courseId]
      );
      hasAccess = instructorCheck.rows.length > 0;
    } else if (userRole === 'root') {
      const courseCheck = await pool.query(
        'SELECT id FROM courses WHERE id = $1',
        [courseId]
      );
      hasAccess = courseCheck.rows.length > 0;
    }

    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this course' });
    }

    // Get or create agent based on user role
    const agentType = userRole === 'professor' ? 'instructor_assistant' :
                      userRole === 'root' ? 'admin_assistant' : 'course_assistant';

    let agentResult = await pool.query(
      'SELECT id FROM chat_agents WHERE agent_type = $1 AND is_active = true LIMIT 1',
      [agentType]
    );

    let agentId;
    if (agentResult.rows.length === 0) {
      // Create role-specific agent
      let agentName, agentDescription, systemPrompt;

      if (userRole === 'professor') {
        agentName = 'Instructor Assistant';
        agentDescription = 'AI assistant to help with course management, assignment creation, and student engagement.';
        systemPrompt = 'You are an AI assistant for course instructors. Help with creating assignments, grading strategies, student engagement, and course content organization.';
      } else if (userRole === 'root') {
        agentName = 'Admin Assistant';
        agentDescription = 'AI assistant for system administration, analytics, and platform management.';
        systemPrompt = 'You are an AI assistant for LMS administrators. Help with user management, system analytics, course oversight, and platform optimization.';
      } else {
        agentName = 'Course Assistant';
        agentDescription = 'Your AI-powered course assistant ready to help with questions, explanations, and study materials.';
        systemPrompt = 'You are a helpful AI assistant for students. Provide clear, educational responses based on course materials.';
      }

      const newAgent = await pool.query(
        `INSERT INTO chat_agents (name, description, agent_type, system_prompt)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [agentName, agentDescription, agentType, systemPrompt]
      );
      agentId = newAgent.rows[0].id;
    } else {
      agentId = agentResult.rows[0].id;
    }

    // Check for existing active session
    const existingSession = await pool.query(
      `SELECT cs.*, c.title as course_name, ca.name as agent_name, ca.description as agent_description
       FROM chat_sessions cs
       JOIN courses c ON cs.course_id = c.id
       JOIN chat_agents ca ON cs.agent_id = ca.id
       WHERE cs.student_id = $1 AND cs.course_id = $2 AND cs.status = 'active'
       ORDER BY cs.last_activity_at DESC
       LIMIT 1`,
      [userId, courseId]
    );

    if (existingSession.rows.length > 0) {
      return res.json({
        message: 'Active session retrieved',
        session: existingSession.rows[0]
      });
    }

    // Create new session
    const courseResult = await pool.query('SELECT title FROM courses WHERE id = $1', [courseId]);
    const courseName = courseResult.rows[0]?.title || 'Course';

    const newSession = await pool.query(
      `INSERT INTO chat_sessions (student_id, agent_id, course_id, session_name)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [userId, agentId, courseId, `${courseName} Chat`]
    );

    const sessionId = newSession.rows[0].id;

    // Add welcome message
    await pool.query(
      `INSERT INTO chat_messages (session_id, sender_type, content, message_metadata)
       VALUES ($1, $2, $3, $4)`,
      [
        sessionId,
        'system',
        `Welcome to ${courseName}! I'm your AI assistant. Feel free to ask me anything about your course materials, assignments, or concepts you'd like to understand better.`,
        JSON.stringify({ type: 'welcome' })
      ]
    );

    // Get complete session data
    const completeSession = await pool.query(
      `SELECT cs.*, c.title as course_name, ca.name as agent_name, ca.description as agent_description
       FROM chat_sessions cs
       JOIN courses c ON cs.course_id = c.id
       JOIN chat_agents ca ON cs.agent_id = ca.id
       WHERE cs.id = $1`,
      [sessionId]
    );

    res.json({
      message: 'Chat session created successfully',
      session: completeSession.rows[0]
    });
  } catch (error) {
    console.error('Error creating chat session:', error);
    res.status(500).json({ error: 'Failed to create chat session' });
  }
});

// Get all chat sessions for a student
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { courseId, status = 'active' } = req.query;

    let query = `
      SELECT
        cs.*,
        c.title as course_name,
        ca.name as agent_name,
        ca.description as agent_description,
        (SELECT COUNT(*) FROM chat_messages WHERE session_id = cs.id) as message_count,
        (SELECT content FROM chat_messages WHERE session_id = cs.id ORDER BY created_at DESC LIMIT 1) as last_message
      FROM chat_sessions cs
      JOIN courses c ON cs.course_id = c.id
      JOIN chat_agents ca ON cs.agent_id = ca.id
      WHERE cs.student_id = $1
    `;

    const params: any[] = [userId];
    let paramIndex = 2;

    if (courseId) {
      query += ` AND cs.course_id = $${paramIndex}`;
      params.push(courseId);
      paramIndex++;
    }

    if (status) {
      query += ` AND cs.status = $${paramIndex}`;
      params.push(status);
    }

    query += ' ORDER BY cs.last_activity_at DESC';

    const result = await pool.query(query, params);

    res.json({
      message: 'Chat sessions retrieved successfully',
      sessions: result.rows
    });
  } catch (error) {
    console.error('Error fetching chat sessions:', error);
    res.status(500).json({ error: 'Failed to fetch chat sessions' });
  }
});

// Get messages for a specific chat session
router.get('/sessions/:sessionId/messages', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { sessionId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    // Verify session belongs to user
    const sessionCheck = await pool.query(
      'SELECT id FROM chat_sessions WHERE id = $1 AND student_id = $2',
      [sessionId, userId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this chat session' });
    }

    const result = await pool.query(
      `SELECT * FROM chat_messages
       WHERE session_id = $1 AND is_deleted = false
       ORDER BY created_at ASC
       LIMIT $2 OFFSET $3`,
      [sessionId, limit, offset]
    );

    res.json({
      message: 'Messages retrieved successfully',
      messages: result.rows
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a message in a chat session
router.post('/sessions/:sessionId/messages', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { sessionId } = req.params;
    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    // Verify session belongs to user
    const sessionCheck = await pool.query(
      'SELECT course_id FROM chat_sessions WHERE id = $1 AND student_id = $2 AND status = $3',
      [sessionId, userId, 'active']
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied or session is not active' });
    }

    const courseId = sessionCheck.rows[0].course_id;

    // Save student message
    const studentMessage = await pool.query(
      `INSERT INTO chat_messages (session_id, sender_type, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [sessionId, 'student', content]
    );

    // Get recent message history for context
    const historyResult = await pool.query(
      `SELECT sender_type, content FROM chat_messages
       WHERE session_id = $1 AND is_deleted = false
       ORDER BY created_at DESC
       LIMIT 10`,
      [sessionId]
    );

    // Generate AI response (placeholder - replace with actual AI integration)
    const aiResponse = await generateAIResponse(content, courseId, historyResult.rows);

    // Save AI response
    const agentMessage = await pool.query(
      `INSERT INTO chat_messages (session_id, sender_type, content)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [sessionId, 'agent', aiResponse]
    );

    // Update session last activity
    await pool.query(
      'UPDATE chat_sessions SET last_activity_at = CURRENT_TIMESTAMP WHERE id = $1',
      [sessionId]
    );

    res.json({
      message: 'Message sent successfully',
      studentMessage: studentMessage.rows[0],
      agentMessage: agentMessage.rows[0]
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Archive a chat session
router.patch('/sessions/:sessionId/archive', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { sessionId } = req.params;

    const result = await pool.query(
      `UPDATE chat_sessions
       SET status = 'archived', ended_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND student_id = $2 AND status = 'active'
       RETURNING *`,
      [sessionId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Active session not found' });
    }

    res.json({
      message: 'Session archived successfully',
      session: result.rows[0]
    });
  } catch (error) {
    console.error('Error archiving session:', error);
    res.status(500).json({ error: 'Failed to archive session' });
  }
});

// Get generated content for a student
router.get('/generated-content', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { courseId, contentType, isSaved } = req.query;

    let query = `
      SELECT
        agc.*,
        c.title as course_name,
        ca.name as agent_name
      FROM agent_generated_content agc
      JOIN courses c ON agc.course_id = c.id
      JOIN chat_agents ca ON agc.agent_id = ca.id
      WHERE agc.student_id = $1
    `;

    const params: any[] = [userId];
    let paramIndex = 2;

    if (courseId) {
      query += ` AND agc.course_id = $${paramIndex}`;
      params.push(courseId);
      paramIndex++;
    }

    if (contentType) {
      query += ` AND agc.content_type = $${paramIndex}`;
      params.push(contentType);
      paramIndex++;
    }

    if (isSaved !== undefined) {
      query += ` AND agc.is_saved = $${paramIndex}`;
      params.push(isSaved === 'true');
      paramIndex++;
    }

    query += ' ORDER BY agc.generated_at DESC';

    const result = await pool.query(query, params);

    res.json({
      message: 'Generated content retrieved successfully',
      content: result.rows
    });
  } catch (error) {
    console.error('Error fetching generated content:', error);
    res.status(500).json({ error: 'Failed to fetch generated content' });
  }
});

// Save generated content
router.post('/generated-content', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { sessionId, contentType, title, content, metadata } = req.body;

    if (!sessionId || !contentType || !content) {
      return res.status(400).json({ error: 'Session ID, content type, and content are required' });
    }

    // Verify session belongs to user
    const sessionCheck = await pool.query(
      'SELECT course_id, agent_id FROM chat_sessions WHERE id = $1 AND student_id = $2',
      [sessionId, userId]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this session' });
    }

    const { course_id, agent_id } = sessionCheck.rows[0];

    const result = await pool.query(
      `INSERT INTO agent_generated_content
       (agent_id, student_id, course_id, session_id, content_type, title, content, content_metadata, is_saved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [agent_id, userId, course_id, sessionId, contentType, title, content, JSON.stringify(metadata || {}), true]
    );

    res.json({
      message: 'Content saved successfully',
      generatedContent: result.rows[0]
    });
  } catch (error) {
    console.error('Error saving generated content:', error);
    res.status(500).json({ error: 'Failed to save generated content' });
  }
});

// Delete generated content
router.delete('/generated-content/:contentId', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { contentId } = req.params;

    const result = await pool.query(
      'DELETE FROM agent_generated_content WHERE id = $1 AND student_id = $2 RETURNING id',
      [contentId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }

    res.json({ message: 'Content deleted successfully' });
  } catch (error) {
    console.error('Error deleting generated content:', error);
    res.status(500).json({ error: 'Failed to delete content' });
  }
});

// Regenerate last AI response
router.post('/sessions/:sessionId/regenerate', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const { sessionId } = req.params;

    // Verify session belongs to user
    const sessionCheck = await pool.query(
      'SELECT course_id FROM chat_sessions WHERE id = $1 AND student_id = $2 AND status = $3',
      [sessionId, userId, 'active']
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied or session is not active' });
    }

    const courseId = sessionCheck.rows[0].course_id;

    // Get the last student message
    const lastStudentMessage = await pool.query(
      `SELECT content FROM chat_messages
       WHERE session_id = $1 AND sender_type = 'student' AND is_deleted = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [sessionId]
    );

    if (lastStudentMessage.rows.length === 0) {
      return res.status(400).json({ error: 'No student messages found' });
    }

    // Mark the last agent message as deleted
    await pool.query(
      `UPDATE chat_messages
       SET is_deleted = true
       WHERE session_id = $1 AND sender_type = 'agent' AND is_deleted = false
       AND id = (
         SELECT id FROM chat_messages
         WHERE session_id = $1 AND sender_type = 'agent' AND is_deleted = false
         ORDER BY created_at DESC
         LIMIT 1
       )`,
      [sessionId]
    );

    // Get message history
    const historyResult = await pool.query(
      `SELECT sender_type, content FROM chat_messages
       WHERE session_id = $1 AND is_deleted = false
       ORDER BY created_at DESC
       LIMIT 10`,
      [sessionId]
    );

    // Generate new AI response
    const aiResponse = await generateAIResponse(
      lastStudentMessage.rows[0].content,
      courseId,
      historyResult.rows
    );

    // Save new AI response
    const agentMessage = await pool.query(
      `INSERT INTO chat_messages (session_id, sender_type, content, message_metadata)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [sessionId, 'agent', aiResponse, JSON.stringify({ regenerated: true })]
    );

    res.json({
      message: 'Response regenerated successfully',
      agentMessage: agentMessage.rows[0]
    });
  } catch (error) {
    console.error('Error regenerating response:', error);
    res.status(500).json({ error: 'Failed to regenerate response' });
  }
});

export default router;
