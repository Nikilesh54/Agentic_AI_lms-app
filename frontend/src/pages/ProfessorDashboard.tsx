import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { professorAPI } from '../services/api';
import './ProfessorDashboard.css';

const ProfessorDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'students' | 'assignments' | 'announcements'>('overview');
  const [loading, setLoading] = useState(false);

  const [course, setCourse] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);

  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [showAddAnnouncement, setShowAddAnnouncement] = useState(false);
  const [newAssignment, setNewAssignment] = useState({ title: '', description: '', dueDate: '', points: 100 });
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '' });

  useEffect(() => {
    loadCourse();
  }, []);

  useEffect(() => {
    if (activeTab === 'students') loadStudents();
    if (activeTab === 'assignments') loadAssignments();
    if (activeTab === 'announcements') loadAnnouncements();
  }, [activeTab]);

  const loadCourse = async () => {
    try {
      const response = await professorAPI.getCourse();
      setCourse(response.data.course);
    } catch (error) {
      showToast('Failed to load course', 'error');
    }
  };

  const loadStudents = async () => {
    try {
      setLoading(true);
      const response = await professorAPI.getStudents();
      setStudents(response.data.students);
    } catch (error) {
      showToast('Failed to load students', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAssignments = async () => {
    try {
      setLoading(true);
      const response = await professorAPI.getAssignments();
      setAssignments(response.data.assignments);
    } catch (error) {
      showToast('Failed to load assignments', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadAnnouncements = async () => {
    try {
      setLoading(true);
      const response = await professorAPI.getAnnouncements();
      setAnnouncements(response.data.announcements);
    } catch (error) {
      showToast('Failed to load announcements', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAddAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await professorAPI.createAssignment(newAssignment);
      showToast('Assignment created successfully', 'success');
      setNewAssignment({ title: '', description: '', dueDate: '', points: 100 });
      setShowAddAssignment(false);
      loadAssignments();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to create assignment', 'error');
    }
  };

  const handleDeleteAssignment = async (id: number) => {
    if (!confirm('Are you sure you want to delete this assignment?')) return;
    try {
      await professorAPI.deleteAssignment(id);
      showToast('Assignment deleted successfully', 'success');
      loadAssignments();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to delete assignment', 'error');
    }
  };

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await professorAPI.createAnnouncement(newAnnouncement);
      showToast('Announcement posted successfully', 'success');
      setNewAnnouncement({ title: '', content: '' });
      setShowAddAnnouncement(false);
      loadAnnouncements();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to post announcement', 'error');
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    try {
      await professorAPI.deleteAnnouncement(id);
      showToast('Announcement deleted successfully', 'success');
      loadAnnouncements();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to delete announcement', 'error');
    }
  };

  // Check if professor is pending
  if (user?.status === 'pending') {
    return (
      <div className="pending-approval">
        <div className="pending-card">
          <h1>Account Pending Approval</h1>
          <p>Your professor account is currently under review by an administrator.</p>
          <p>You will receive access to your dashboard once your account is approved.</p>
          <button onClick={logout} className="logout-button">Logout</button>
        </div>
      </div>
    );
  }

  return (
    <div className="professor-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div>
            <h1>Professor Dashboard</h1>
            <p>Welcome, {user?.fullName}</p>
            {course && <p className="course-title">{course.title}</p>}
          </div>
          <button onClick={logout} className="logout-button">Logout</button>
        </div>
      </header>

      <div className="dashboard-tabs">
        <button className={`tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          Overview
        </button>
        <button className={`tab ${activeTab === 'students' ? 'active' : ''}`} onClick={() => setActiveTab('students')}>
          Students
        </button>
        <button className={`tab ${activeTab === 'assignments' ? 'active' : ''}`} onClick={() => setActiveTab('assignments')}>
          Assignments
        </button>
        <button className={`tab ${activeTab === 'announcements' ? 'active' : ''}`} onClick={() => setActiveTab('announcements')}>
          Announcements
        </button>
      </div>

      <main className="dashboard-main">
        {loading && <div className="loading">Loading...</div>}

        {activeTab === 'overview' && course && (
          <div className="overview-section">
            <div className="course-info-card">
              <h2>{course.title}</h2>
              <p>{course.description}</p>
              <div className="stats">
                <div className="stat">
                  <span className="stat-number">{course.enrolled_students_count}</span>
                  <span className="stat-label">Enrolled Students</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="students-section">
            <h2>Enrolled Students</h2>
            {students.length === 0 ? (
              <p className="empty-message">No students enrolled yet</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Enrolled On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student: any) => (
                      <tr key={student.id}>
                        <td>{student.full_name}</td>
                        <td>{student.email}</td>
                        <td>{new Date(student.enrolled_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'assignments' && (
          <div className="assignments-section">
            <div className="section-header">
              <h2>Assignments</h2>
              <button className="btn-primary" onClick={() => setShowAddAssignment(true)}>
                + Create Assignment
              </button>
            </div>

            {showAddAssignment && (
              <div className="modal-overlay" onClick={() => setShowAddAssignment(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <h3>Create Assignment</h3>
                  <form onSubmit={handleAddAssignment}>
                    <div className="form-group">
                      <label>Title</label>
                      <input
                        type="text"
                        value={newAssignment.title}
                        onChange={(e) => setNewAssignment({ ...newAssignment, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Description</label>
                      <textarea
                        value={newAssignment.description}
                        onChange={(e) => setNewAssignment({ ...newAssignment, description: e.target.value })}
                        rows={4}
                      />
                    </div>
                    <div className="form-group">
                      <label>Due Date</label>
                      <input
                        type="datetime-local"
                        value={newAssignment.dueDate}
                        onChange={(e) => setNewAssignment({ ...newAssignment, dueDate: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Points</label>
                      <input
                        type="number"
                        value={newAssignment.points}
                        onChange={(e) => setNewAssignment({ ...newAssignment, points: parseInt(e.target.value) })}
                        min="0"
                      />
                    </div>
                    <div className="modal-actions">
                      <button type="button" onClick={() => setShowAddAssignment(false)} className="btn-secondary">
                        Cancel
                      </button>
                      <button type="submit" className="btn-primary">Create</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {assignments.length === 0 ? (
              <p className="empty-message">No assignments created yet</p>
            ) : (
              <div className="assignments-list">
                {assignments.map((assignment: any) => (
                  <div key={assignment.id} className="assignment-card">
                    <div className="assignment-header">
                      <h3>{assignment.title}</h3>
                      <button className="btn-delete-icon" onClick={() => handleDeleteAssignment(assignment.id)}>✕</button>
                    </div>
                    <p>{assignment.description}</p>
                    <div className="assignment-footer">
                      <span>Due: {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'No due date'}</span>
                      <span>{assignment.points} points</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'announcements' && (
          <div className="announcements-section">
            <div className="section-header">
              <h2>Announcements</h2>
              <button className="btn-primary" onClick={() => setShowAddAnnouncement(true)}>
                + Post Announcement
              </button>
            </div>

            {showAddAnnouncement && (
              <div className="modal-overlay" onClick={() => setShowAddAnnouncement(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <h3>Post Announcement</h3>
                  <form onSubmit={handleAddAnnouncement}>
                    <div className="form-group">
                      <label>Title</label>
                      <input
                        type="text"
                        value={newAnnouncement.title}
                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Content</label>
                      <textarea
                        value={newAnnouncement.content}
                        onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                        required
                        rows={6}
                      />
                    </div>
                    <div className="modal-actions">
                      <button type="button" onClick={() => setShowAddAnnouncement(false)} className="btn-secondary">
                        Cancel
                      </button>
                      <button type="submit" className="btn-primary">Post</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {announcements.length === 0 ? (
              <p className="empty-message">No announcements posted yet</p>
            ) : (
              <div className="announcements-list">
                {announcements.map((announcement: any) => (
                  <div key={announcement.id} className="announcement-card">
                    <div className="announcement-header">
                      <h3>{announcement.title}</h3>
                      <button className="btn-delete-icon" onClick={() => handleDeleteAnnouncement(announcement.id)}>✕</button>
                    </div>
                    <p>{announcement.content}</p>
                    <div className="announcement-footer">
                      <span>Posted {new Date(announcement.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ProfessorDashboard;
