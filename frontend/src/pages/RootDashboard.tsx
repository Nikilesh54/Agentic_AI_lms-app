import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { rootAPI } from '../services/api';
import './RootDashboard.css';

interface PendingProfessor {
  id: number;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
  course_id: number;
  course_title: string;
}

interface User {
  id: number;
  full_name: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
}

interface Professor {
  id: number;
  full_name: string;
  email: string;
  status: string;
  created_at: string;
  assigned_courses: Array<{
    course_id: number;
    course_title: string;
    assigned_at: string;
  }> | null;
}

interface Course {
  id: number;
  title: string;
  description: string;
  instructor_name: string;
  instructor_email: string;
  enrolled_students: number;
}

interface Stats {
  users: { [role: string]: number };
  totalCourses: number;
  totalEnrollments: number;
  pendingProfessors: number;
}

const RootDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'overview' | 'professors' | 'users' | 'courses'>('overview');
  const [loading, setLoading] = useState(false);

  // State
  const [stats, setStats] = useState<Stats | null>(null);
  const [pendingProfessors, setPendingProfessors] = useState<PendingProfessor[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);

  // New course form
  const [showAddCourse, setShowAddCourse] = useState(false);
  const [newCourse, setNewCourse] = useState({ title: '', description: '' });

  useEffect(() => {
    if (activeTab === 'overview') loadStats();
    if (activeTab === 'professors') loadPendingProfessors();
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'courses') loadCourses();
  }, [activeTab]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await rootAPI.getStats();
      setStats(response.data.stats);
    } catch (error) {
      showToast('Failed to load statistics', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadPendingProfessors = async () => {
    try {
      setLoading(true);
      const response = await rootAPI.getPendingProfessors();
      setPendingProfessors(response.data.professors);
    } catch (error) {
      showToast('Failed to load pending professors', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await rootAPI.getUsers();
      setUsers(response.data.users);
    } catch (error) {
      showToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadCourses = async () => {
    try {
      setLoading(true);
      const response = await rootAPI.getCourses();
      setCourses(response.data.courses);
    } catch (error) {
      showToast('Failed to load courses', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveProfessor = async (professorId: number, status: 'approved' | 'rejected') => {
    if (!confirm(`Are you sure you want to ${status === 'approved' ? 'approve' : 'reject'} this professor?`)) {
      return;
    }

    try {
      await rootAPI.updateProfessorStatus(professorId, status);
      showToast(`Professor ${status} successfully`, 'success');
      loadPendingProfessors();
      if (activeTab === 'overview') loadStats();
    } catch (error: any) {
      showToast(error.response?.data?.error || `Failed to ${status} professor`, 'error');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return;
    }

    try {
      await rootAPI.deleteUser(userId);
      showToast('User deleted successfully', 'success');
      loadUsers();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to delete user', 'error');
    }
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await rootAPI.createCourse(newCourse);
      showToast('Course created successfully', 'success');
      setNewCourse({ title: '', description: '' });
      setShowAddCourse(false);
      loadCourses();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to create course', 'error');
    }
  };

  const handleDeleteCourse = async (courseId: number) => {
    if (!confirm('Are you sure you want to delete this course? This will also remove all enrollments and assignments.')) {
      return;
    }

    try {
      await rootAPI.deleteCourse(courseId);
      showToast('Course deleted successfully', 'success');
      loadCourses();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to delete course', 'error');
    }
  };

  return (
    <div className="root-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div>
            <h1>Root Dashboard</h1>
            <p>Welcome, {user?.fullName}</p>
          </div>
          <button onClick={logout} className="logout-button">
            Logout
          </button>
        </div>
      </header>

      <div className="dashboard-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'professors' ? 'active' : ''}`}
          onClick={() => setActiveTab('professors')}
        >
          Pending Professors
          {stats && stats.pendingProfessors > 0 && (
            <span className="badge">{stats.pendingProfessors}</span>
          )}
        </button>
        <button
          className={`tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button
          className={`tab ${activeTab === 'courses' ? 'active' : ''}`}
          onClick={() => setActiveTab('courses')}
        >
          Courses
        </button>
      </div>

      <main className="dashboard-main">
        {loading && <div className="loading">Loading...</div>}

        {/* Overview Tab */}
        {activeTab === 'overview' && stats && (
          <div className="overview-section">
            <h2>System Statistics</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>{stats.users.student || 0}</h3>
                <p>Students</p>
              </div>
              <div className="stat-card">
                <h3>{stats.users.professor || 0}</h3>
                <p>Professors</p>
              </div>
              <div className="stat-card">
                <h3>{stats.totalCourses}</h3>
                <p>Total Courses</p>
              </div>
              <div className="stat-card">
                <h3>{stats.totalEnrollments}</h3>
                <p>Total Enrollments</p>
              </div>
              <div className="stat-card highlight">
                <h3>{stats.pendingProfessors}</h3>
                <p>Pending Approvals</p>
              </div>
            </div>
          </div>
        )}

        {/* Pending Professors Tab */}
        {activeTab === 'professors' && (
          <div className="professors-section">
            <h2>Pending Professor Approvals</h2>
            {pendingProfessors.length === 0 ? (
              <p className="empty-message">No pending professor approvals</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Requested Course</th>
                      <th>Applied On</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingProfessors.map((prof) => (
                      <tr key={prof.id}>
                        <td>{prof.full_name}</td>
                        <td>{prof.email}</td>
                        <td>{prof.course_title}</td>
                        <td>{new Date(prof.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="action-buttons">
                            <button
                              className="btn-approve"
                              onClick={() => handleApproveProfessor(prof.id, 'approved')}
                            >
                              Approve
                            </button>
                            <button
                              className="btn-reject"
                              onClick={() => handleApproveProfessor(prof.id, 'rejected')}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="users-section">
            <h2>All Users</h2>
            {users.length === 0 ? (
              <p className="empty-message">No users found</p>
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td>{user.full_name}</td>
                        <td>{user.email}</td>
                        <td>
                          <span className={`role-badge ${user.role}`}>
                            {user.role}
                          </span>
                        </td>
                        <td>
                          <span className={`status-badge ${user.status}`}>
                            {user.status}
                          </span>
                        </td>
                        <td>{new Date(user.created_at).toLocaleDateString()}</td>
                        <td>
                          {user.role !== 'root' && (
                            <button
                              className="btn-delete"
                              onClick={() => handleDeleteUser(user.id)}
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Courses Tab */}
        {activeTab === 'courses' && (
          <div className="courses-section">
            <div className="section-header">
              <h2>All Courses</h2>
              <button
                className="btn-primary"
                onClick={() => setShowAddCourse(true)}
              >
                + Add Course
              </button>
            </div>

            {showAddCourse && (
              <div className="modal-overlay" onClick={() => setShowAddCourse(false)}>
                <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                  <h3>Create New Course</h3>
                  <form onSubmit={handleAddCourse}>
                    <div className="form-group">
                      <label>Course Title</label>
                      <input
                        type="text"
                        value={newCourse.title}
                        onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
                        required
                        placeholder="e.g., Introduction to Computer Science"
                      />
                    </div>
                    <div className="form-group">
                      <label>Description</label>
                      <textarea
                        value={newCourse.description}
                        onChange={(e) => setNewCourse({ ...newCourse, description: e.target.value })}
                        placeholder="Course description..."
                        rows={4}
                      />
                    </div>
                    <div className="modal-actions">
                      <button type="button" onClick={() => setShowAddCourse(false)} className="btn-secondary">
                        Cancel
                      </button>
                      <button type="submit" className="btn-primary">
                        Create Course
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {courses.length === 0 ? (
              <p className="empty-message">No courses found</p>
            ) : (
              <div className="courses-grid">
                {courses.map((course) => (
                  <div key={course.id} className="course-card">
                    <div className="course-header">
                      <h3>{course.title}</h3>
                      <button
                        className="btn-delete-icon"
                        onClick={() => handleDeleteCourse(course.id)}
                        title="Delete course"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="course-description">{course.description}</p>
                    <div className="course-info">
                      <p><strong>Instructor:</strong> {course.instructor_name || 'Not assigned'}</p>
                      <p><strong>Students:</strong> {course.enrolled_students}</p>
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

export default RootDashboard;
