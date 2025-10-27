import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { studentAPI } from '../services/api';
import './CoursePage.css';

const CoursePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);

  const [course, setCourse] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [materials, setMaterials] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      loadCourseData();
    }
  }, [id]);

  useEffect(() => {
    if (id && activeTab === 'materials') {
      loadMaterials();
    }
  }, [activeTab, id]);

  const loadCourseData = async () => {
    try {
      setLoading(true);
      const courseId = parseInt(id!);

      const [courseRes, assignmentsRes, announcementsRes] = await Promise.all([
        studentAPI.getCourseDetails(courseId),
        studentAPI.getCourseAssignments(courseId),
        studentAPI.getCourseAnnouncements(courseId)
      ]);

      setCourse(courseRes.data.course);
      setAssignments(assignmentsRes.data.assignments || []);
      setAnnouncements(announcementsRes.data.announcements || []);
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to load course data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMaterials = async () => {
    try {
      setLoading(true);
      const response = await studentAPI.getCourseMaterials(parseInt(id!));
      setMaterials(response.data.materials || []);
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to load course materials', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadMaterial = async (materialId: number) => {
    try {
      const response = await studentAPI.downloadMaterial(materialId);
      window.open(response.data.url, '_blank');
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to download material', 'error');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  if (!course) {
    return <div className="loading">Loading...</div>;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <div className="overview-content">
            <div className="course-info">
              <h2>Course Overview</h2>
              <p>{course.description}</p>
              <div className="course-details">
                <div className="detail-item">
                  <strong>Instructor:</strong> {course.instructor}
                </div>
                <div className="detail-item">
                  <strong>Progress:</strong> {course.progress}%
                </div>
              </div>
            </div>
            
            <div className="recent-activity">
              <h3>Recent Activity</h3>
              <div className="activity-list">
                <div className="activity-item">
                  <span className="activity-type">Assignment</span>
                  <span className="activity-text">Assignment 3 submitted</span>
                  <span className="activity-date">2 days ago</span>
                </div>
                <div className="activity-item">
                  <span className="activity-type">Announcement</span>
                  <span className="activity-text">New announcement posted</span>
                  <span className="activity-date">3 days ago</span>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'assignments':
        return (
          <div className="assignments-content">
            <h2>Assignments</h2>
            {assignments.length === 0 ? (
              <p className="empty-message">No assignments available yet</p>
            ) : (
              <div className="assignments-list">
                {assignments.map((assignment) => (
                  <Link
                    key={assignment.id}
                    to={`/assignments/${assignment.id}`}
                    className="assignment-item-link"
                  >
                    <div className="assignment-item">
                      <div className="assignment-header">
                        <h3>{assignment.title}</h3>
                        {assignment.due_date && (
                          <span className="due-date">
                            Due: {new Date(assignment.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {assignment.description && (
                        <p className="assignment-description">{assignment.description}</p>
                      )}
                      <div className="assignment-footer">
                        <span className="points">{assignment.points} points</span>
                        <span className="view-button">View Assignment →</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      
      case 'announcements':
        return (
          <div className="announcements-content">
            <h2>Announcements</h2>
            <div className="announcements-list">
              {announcements.map((announcement) => (
                <div key={announcement.id} className="announcement-item">
                  <div className="announcement-header">
                    <h3>{announcement.title}</h3>
                    <span className="announcement-date">{announcement.date}</span>
                  </div>
                  <p className="announcement-content">{announcement.content}</p>
                  <div className="announcement-author">
                    Posted by {announcement.author}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      
      case 'materials':
        return (
          <div className="materials-content">
            <h2>Course Materials</h2>
            {loading ? (
              <p>Loading materials...</p>
            ) : materials.length === 0 ? (
              <p className="empty-message">No course materials available yet</p>
            ) : (
              <div className="materials-list">
                {materials.map((material: any) => (
                  <div key={material.id} className="material-card">
                    <div className="material-icon">📄</div>
                    <div className="material-info">
                      <h3>{material.file_name}</h3>
                      <p className="material-meta">
                        {formatFileSize(material.file_size)} •
                        Uploaded {new Date(material.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="material-actions">
                      <button
                        className="btn-primary"
                        onClick={() => handleDownloadMaterial(material.id)}
                      >
                        Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="course-page">
      <header className="course-header">
        <div className="header-content">
          <div className="breadcrumb">
            <Link to="/courses">Courses</Link>
            <span> / </span>
            <span>{course.title}</span>
          </div>
          <div className="header-actions">
            <span className="user-info">Welcome, {user?.fullName}</span>
            <button onClick={logout} className="logout-button">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="course-main">
        <div className="course-container">
          <div className="course-title-section">
            <h1>{course.title}</h1>
            <p className="course-instructor">Instructor: {course.instructor}</p>
          </div>

          <div className="course-tabs">
            <button 
              className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              Overview
            </button>
            <button 
              className={`tab ${activeTab === 'assignments' ? 'active' : ''}`}
              onClick={() => setActiveTab('assignments')}
            >
              Assignments
            </button>
            <button 
              className={`tab ${activeTab === 'announcements' ? 'active' : ''}`}
              onClick={() => setActiveTab('announcements')}
            >
              Announcements
            </button>
            <button
              className={`tab ${activeTab === 'materials' ? 'active' : ''}`}
              onClick={() => setActiveTab('materials')}
            >
              Materials
            </button>
          </div>

          <div className="course-content">
            {renderTabContent()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default CoursePage;
