import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { chatAPI } from '../services/api';
import { useToast } from '../components/Toast';
import './AIAgentHub.css';

interface Course {
  id: number;
  title: string;
  description: string;
  instructor_name: string;
  enrolled_at: string;
  session_count: number;
  last_chat_activity: string | null;
}

interface ChatSession {
  id: number;
  course_id: number;
  course_name: string;
  agent_name: string;
  agent_description: string;
  session_name: string;
  status: string;
  last_activity_at: string;
  message_count: number;
  last_message: string;
}

interface GeneratedContent {
  id: number;
  content_type: string;
  title: string;
  content: string;
  course_name: string;
  agent_name: string;
  generated_at: string;
}

const AIAgentHub: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'courses' | 'history' | 'content'>('courses');
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load courses
      const coursesResponse = await chatAPI.getCourses();
      setCourses(coursesResponse.data.courses);

      // Load chat sessions
      const sessionsResponse = await chatAPI.getSessions({ status: 'active' });
      setSessions(sessionsResponse.data.sessions);

      // Load generated content
      const contentResponse = await chatAPI.getGeneratedContent({ isSaved: true });
      setGeneratedContent(contentResponse.data.content);

    } catch (error: any) {
      console.error('Error loading AI Agent Hub data:', error);
      showToast(error.response?.data?.error || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async (courseId: number) => {
    try {
      const response = await chatAPI.createSession(courseId);
      const sessionId = response.data.session.id;
      navigate(`/chat/${sessionId}`);
    } catch (error: any) {
      console.error('Error starting chat:', error);
      showToast(error.response?.data?.error || 'Failed to start chat', 'error');
    }
  };

  const handleContinueChat = (sessionId: number) => {
    navigate(`/chat/${sessionId}`);
  };

  const handleViewContent = (contentId: number) => {
    navigate(`/agent-content/${contentId}`);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  };

  const getContentTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      summary: 'Summary',
      practice_questions: 'Practice Questions',
      explanation: 'Explanation',
      study_guide: 'Study Guide',
      quiz: 'Quiz',
      notes: 'Notes',
      other: 'Other'
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <div className="ai-agent-hub">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading AI Agent Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="ai-agent-hub">
      <div className="hub-header">
        <div className="header-content">
          <div className="header-left">
            <button className="back-home-button" onClick={() => navigate('/dashboard')}>
              ← Back to Dashboard
            </button>
            <div className="header-titles">
              <h1>AI Agent Hub</h1>
              <p className="subtitle">
                Your personal AI learning assistants for all your enrolled courses
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="hub-tabs">
        <button
          className={`tab-button ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          Start New Chat
        </button>
        <button
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          Chat History ({sessions.length})
        </button>
        <button
          className={`tab-button ${activeTab === 'content' ? 'active' : ''}`}
          onClick={() => setActiveTab('content')}
        >
          Generated Content ({generatedContent.length})
        </button>
      </div>

      <div className="hub-content">
        {activeTab === 'courses' && (
          <div className="courses-section">
            <div className="section-header">
              <h2>Choose a Course to Chat About</h2>
              {/* <p>Select any of your enrolled courses to start a conversation with your AI assistant</p> */}
            </div>

            {courses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📚</div>
                <h3>No Courses Enrolled</h3>
                <p>Enroll in courses to start chatting with AI assistants</p>
                <button onClick={() => navigate('/dashboard')} className="primary-button">
                  Browse Courses
                </button>
              </div>
            ) : (
              <div className="courses-grid">
                {courses.map((course) => (
                  <div key={course.id} className="course-card">
                    <div className="course-card-header">
                      <h3>{course.title}</h3>
                      <span className="instructor-tag">
                        Prof. {course.instructor_name}
                      </span>
                    </div>
                    <p className="course-description">{course.description}</p>
                    <div className="course-stats">
                      <span className="stat">
                        <span className="stat-icon">💬</span>
                        {course.session_count} session{course.session_count !== 1 ? 's' : ''}
                      </span>
                      {course.last_chat_activity && (
                        <span className="stat">
                          <span className="stat-icon">🕐</span>
                          Last chat: {formatDate(course.last_chat_activity)}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleStartChat(course.id)}
                      className="start-chat-button"
                    >
                      Start Chat
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-section">
            <div className="section-header">
              <h2>Your Chat History</h2>
                <p>Continue your previous conversations or review past interactions</p>
            </div>

            {sessions.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">💬</div>
                <h3>No Chat History</h3>
                <p>Start a conversation with an AI assistant to see it here</p>
                <button onClick={() => setActiveTab('courses')} className="primary-button">
                  Start New Chat
                </button>
              </div>
            ) : (
              <div className="sessions-list">
                {sessions.map((session) => (
                  <div key={session.id} className="session-card" onClick={() => handleContinueChat(session.id)}>
                    <div className="session-header">
                      <div className="session-info">
                        <h3>{session.course_name}</h3>
                        <p className="session-name">{session.session_name}</p>
                      </div>
                      <div className="session-meta">
                        <span className="agent-badge">{session.agent_name}</span>
                        <span className="time-badge">{formatDate(session.last_activity_at)}</span>
                      </div>
                    </div>
                    <div className="session-preview">
                      <p className="last-message">
                        {session.last_message?.substring(0, 120)}
                        {session.last_message?.length > 120 ? '...' : ''}
                      </p>
                      <span className="message-count">{session.message_count} messages</span>
                    </div>
                    <div className="session-actions">
                      <button className="continue-button">Continue Chat →</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'content' && (
          <div className="content-section">
            <div className="section-header">
              <h2>Generated Content</h2>
              <p>Summaries, practice questions, and study materials created by your AI assistants</p>
            </div>

            {generatedContent.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📝</div>
                <h3>No Generated Content</h3>
                <p>AI-generated study materials will appear here</p>
                <button onClick={() => setActiveTab('courses')} className="primary-button">
                  Start New Chat
                </button>
              </div>
            ) : (
              <div className="content-grid">
                {generatedContent.map((content) => (
                  <div key={content.id} className="content-card" onClick={() => handleViewContent(content.id)}>
                    <div className="content-type-badge">
                      {getContentTypeLabel(content.content_type)}
                    </div>
                    <h3>{content.title || 'Untitled'}</h3>
                    <p className="content-preview">
                      {content.content.substring(0, 150)}
                      {content.content.length > 150 ? '...' : ''}
                    </p>
                    <div className="content-footer">
                      <span className="course-tag">{content.course_name}</span>
                      <span className="date-tag">{formatDate(content.generated_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAgentHub;
