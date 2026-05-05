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
  course_id?: number;
}

const AIAgentHub: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'courses' | 'history' | 'quiz' | 'content'>('courses');
  const [historyStatus, setHistoryStatus] = useState<'active' | 'archived'>('active');
  const [historyCourseId, setHistoryCourseId] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState('');
  const [contentSearch, setContentSearch] = useState('');
  const [editingContentId, setEditingContentId] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingType, setEditingType] = useState('notes');
  const [quizForm, setQuizForm] = useState({
    courseId: '',
    topic: '',
    questionCount: 5,
    difficulty: 'mixed' as 'easy' | 'medium' | 'hard' | 'mixed',
  });
  const [generatingQuiz, setGeneratingQuiz] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') {
      loadSessions();
    }
  }, [historyStatus, historyCourseId, activeTab]);

  useEffect(() => {
    if (activeTab === 'content') {
      loadGeneratedContent();
    }
  }, [contentTypeFilter, activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load courses
      const coursesResponse = await chatAPI.getCourses();
      setCourses(coursesResponse.data.courses);

      await Promise.all([
        loadSessions(false),
        loadGeneratedContent(false),
      ]);

    } catch (error: any) {
      console.error('Error loading AI Agent Hub data:', error);
      showToast(error.response?.data?.error || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async (showErrors = true) => {
    try {
      const sessionsResponse = await chatAPI.getSessions({
        status: historyStatus,
        courseId: historyCourseId ? parseInt(historyCourseId) : undefined,
      });
      setSessions(sessionsResponse.data.sessions);
    } catch (error: any) {
      console.error('Error loading sessions:', error);
      if (showErrors) {
        showToast(error.response?.data?.error || 'Failed to load chat history', 'error');
      }
    }
  };

  const loadGeneratedContent = async (showErrors = true) => {
    try {
      const contentResponse = await chatAPI.getGeneratedContent({
        isSaved: true,
        contentType: contentTypeFilter || undefined,
      });
      setGeneratedContent(contentResponse.data.content);
    } catch (error: any) {
      console.error('Error loading generated content:', error);
      if (showErrors) {
        showToast(error.response?.data?.error || 'Failed to load saved content', 'error');
      }
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

  const handleGenerateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quizForm.courseId) {
      showToast('Choose a course for the quiz', 'error');
      return;
    }

    try {
      setGeneratingQuiz(true);
      const response = await chatAPI.generatePracticeQuiz({
        courseId: parseInt(quizForm.courseId),
        topic: quizForm.topic,
        questionCount: quizForm.questionCount,
        difficulty: quizForm.difficulty,
      });
      showToast('Practice quiz generated', 'success');
      await loadGeneratedContent(false);
      setActiveTab('content');
      navigate(`/agent-content/${response.data.quiz.id}`);
    } catch (error: any) {
      console.error('Error generating quiz:', error);
      showToast(error.response?.data?.error || 'Failed to generate quiz', 'error');
    } finally {
      setGeneratingQuiz(false);
    }
  };

  const startEditingContent = (content: GeneratedContent, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingContentId(content.id);
    setEditingTitle(content.title || 'Untitled');
    setEditingType(content.content_type);
  };

  const cancelEditingContent = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingContentId(null);
    setEditingTitle('');
    setEditingType('notes');
  };

  const handleUpdateContent = async (contentId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingTitle.trim()) {
      showToast('Title cannot be empty', 'error');
      return;
    }

    try {
      await chatAPI.updateGeneratedContent(contentId, {
        title: editingTitle.trim(),
        contentType: editingType,
      });
      showToast('Saved content updated', 'success');
      cancelEditingContent();
      loadGeneratedContent(false);
    } catch (error: any) {
      console.error('Error updating content:', error);
      showToast(error.response?.data?.error || 'Failed to update content', 'error');
    }
  };

  const handleDeleteContent = async (contentId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this saved content?')) return;

    try {
      await chatAPI.deleteGeneratedContent(contentId);
      showToast('Saved content deleted', 'success');
      setGeneratedContent(prev => prev.filter(item => item.id !== contentId));
    } catch (error: any) {
      console.error('Error deleting content:', error);
      showToast(error.response?.data?.error || 'Failed to delete content', 'error');
    }
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

  const filteredContent = generatedContent.filter((content) => {
    const search = contentSearch.trim().toLowerCase();
    if (!search) return true;
    return (
      content.title?.toLowerCase().includes(search) ||
      content.content?.toLowerCase().includes(search) ||
      content.course_name?.toLowerCase().includes(search)
    );
  });

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
          className={`tab-button ${activeTab === 'quiz' ? 'active' : ''}`}
          onClick={() => setActiveTab('quiz')}
        >
          Practice Quiz
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
            <div className="hub-controls">
              <select
                value={historyStatus}
                onChange={(e) => setHistoryStatus(e.target.value as 'active' | 'archived')}
                title="Filter chat status"
              >
                <option value="active">Active chats</option>
                <option value="archived">Archived chats</option>
              </select>
              <select
                value={historyCourseId}
                onChange={(e) => setHistoryCourseId(e.target.value)}
                title="Filter by course"
              >
                <option value="">All courses</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>{course.title}</option>
                ))}
              </select>
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
                      <div className="session-preview-meta">
                        <span className="message-count">{session.message_count} messages</span>
                        <span className={`status-chip ${session.status}`}>{session.status}</span>
                      </div>
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

        {activeTab === 'quiz' && (
          <div className="quiz-section">
            <div className="section-header">
              <h2>Generate a Practice Quiz</h2>
              <p>Create a saved quiz from your enrolled course context.</p>
            </div>

            {courses.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">✅</div>
                <h3>No Courses Available</h3>
                <p>Enroll in a course before generating practice quizzes.</p>
                <button onClick={() => navigate('/dashboard')} className="primary-button">
                  Browse Courses
                </button>
              </div>
            ) : (
              <form className="quiz-form" onSubmit={handleGenerateQuiz}>
                <div className="form-row">
                  <label>
                    Course
                    <select
                      value={quizForm.courseId}
                      onChange={(e) => setQuizForm({ ...quizForm, courseId: e.target.value })}
                      required
                    >
                      <option value="">Choose a course</option>
                      {courses.map((course) => (
                        <option key={course.id} value={course.id}>{course.title}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Difficulty
                    <select
                      value={quizForm.difficulty}
                      onChange={(e) => setQuizForm({ ...quizForm, difficulty: e.target.value as any })}
                    >
                      <option value="mixed">Mixed</option>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </label>
                  <label>
                    Questions
                    <input
                      type="number"
                      min="3"
                      max="12"
                      value={quizForm.questionCount}
                      onChange={(e) => setQuizForm({ ...quizForm, questionCount: parseInt(e.target.value) || 5 })}
                    />
                  </label>
                </div>
                <label className="topic-field">
                  Topic focus
                  <input
                    type="text"
                    value={quizForm.topic}
                    onChange={(e) => setQuizForm({ ...quizForm, topic: e.target.value })}
                    placeholder="Optional: recursion, database indexes, lecture 3..."
                    maxLength={120}
                  />
                </label>
                <button className="primary-button" type="submit" disabled={generatingQuiz}>
                  {generatingQuiz ? 'Generating...' : 'Generate Quiz'}
                </button>
              </form>
            )}
          </div>
        )}

        {activeTab === 'content' && (
          <div className="content-section">
            <div className="section-header">
              <h2>Generated Content</h2>
              <p>Summaries, practice questions, and study materials created by your AI assistants</p>
            </div>
            <div className="hub-controls">
              <input
                type="search"
                value={contentSearch}
                onChange={(e) => setContentSearch(e.target.value)}
                placeholder="Search saved content"
              />
              <select
                value={contentTypeFilter}
                onChange={(e) => setContentTypeFilter(e.target.value)}
                title="Filter by content type"
              >
                <option value="">All types</option>
                <option value="notes">Notes</option>
                <option value="summary">Summary</option>
                <option value="quiz">Quiz</option>
                <option value="practice_questions">Practice Questions</option>
                <option value="explanation">Explanation</option>
                <option value="study_guide">Study Guide</option>
                <option value="other">Other</option>
              </select>
            </div>

            {filteredContent.length === 0 ? (
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
                {filteredContent.map((content) => (
                  <div key={content.id} className="content-card" onClick={() => handleViewContent(content.id)}>
                    <div className="content-type-badge">
                      {getContentTypeLabel(content.content_type)}
                    </div>
                    {editingContentId === content.id ? (
                      <div className="content-edit-form" onClick={(e) => e.stopPropagation()}>
                        <input
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          maxLength={100}
                        />
                        <select
                          value={editingType}
                          onChange={(e) => setEditingType(e.target.value)}
                        >
                          <option value="notes">Notes</option>
                          <option value="summary">Summary</option>
                          <option value="quiz">Quiz</option>
                          <option value="practice_questions">Practice Questions</option>
                          <option value="explanation">Explanation</option>
                          <option value="study_guide">Study Guide</option>
                          <option value="other">Other</option>
                        </select>
                        <div className="inline-actions">
                          <button type="button" onClick={(e) => handleUpdateContent(content.id, e)}>Save</button>
                          <button type="button" onClick={cancelEditingContent}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <h3>{content.title || 'Untitled'}</h3>
                    )}
                    <p className="content-preview">
                      {content.content.substring(0, 150)}
                      {content.content.length > 150 ? '...' : ''}
                    </p>
                    <div className="content-footer">
                      <span className="course-tag">{content.course_name}</span>
                      <span className="date-tag">{formatDate(content.generated_at)}</span>
                    </div>
                    {editingContentId !== content.id && (
                      <div className="content-actions">
                        <button type="button" onClick={(e) => startEditingContent(content, e)}>Edit</button>
                        <button type="button" onClick={(e) => handleDeleteContent(content.id, e)}>Delete</button>
                      </div>
                    )}
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
