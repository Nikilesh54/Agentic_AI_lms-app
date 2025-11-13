import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/Toast';
import { studentAPI } from '../services/api';
import './StudentDashboard.css';

interface Course {
  id: number;
  title: string;
  description: string;
  instructor_name: string;
  enrolled_students_count: number;
  is_enrolled?: boolean;
}

interface Assignment {
  id: number;
  title: string;
  description: string;
  due_date: string;
  points: number;
}

interface Announcement {
  id: number;
  title: string;
  content: string;
  created_at: string;
}

const StudentDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'all-courses' | 'my-courses'>('all-courses');
  const [loading, setLoading] = useState(false);

  const [allCourses, setAllCourses] = useState<Course[]>([]);
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [courseAssignments, setCourseAssignments] = useState<Assignment[]>([]);
  const [courseAnnouncements, setCourseAnnouncements] = useState<Announcement[]>([]);
  const [showCourseDetails, setShowCourseDetails] = useState(false);

  useEffect(() => {
    if (activeTab === 'all-courses') {
      loadAllCourses();
    } else if (activeTab === 'my-courses') {
      loadMyCourses();
    }
  }, [activeTab]);

  const loadAllCourses = async () => {
    try {
      setLoading(true);
      const response = await studentAPI.getCourses();
      setAllCourses(response.data.courses);
    } catch (error) {
      showToast('Failed to load courses', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMyCourses = async () => {
    try {
      setLoading(true);
      const response = await studentAPI.getMyCourses();
      setMyCourses(response.data.courses);
    } catch (error) {
      showToast('Failed to load your courses', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEnroll = async (courseId: number) => {
    try {
      await studentAPI.enrollInCourse(courseId);
      showToast('Successfully enrolled in course', 'success');
      loadAllCourses();
      loadMyCourses();
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to enroll in course', 'error');
    }
  };

  const handleUnenroll = async (courseId: number) => {
    if (!confirm('Are you sure you want to unenroll from this course?')) return;
    try {
      await studentAPI.unenrollFromCourse(courseId);
      showToast('Successfully unenrolled from course', 'success');
      loadAllCourses();
      loadMyCourses();
      if (showCourseDetails && selectedCourse?.id === courseId) {
        setShowCourseDetails(false);
        setSelectedCourse(null);
      }
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to unenroll from course', 'error');
    }
  };

  const handleViewCourseDetails = async (course: Course) => {
    try {
      setLoading(true);
      setSelectedCourse(course);
      setShowCourseDetails(true);

      // Load assignments and announcements
      const [assignmentsRes, announcementsRes] = await Promise.all([
        studentAPI.getCourseAssignments(course.id),
        studentAPI.getCourseAnnouncements(course.id)
      ]);

      setCourseAssignments(assignmentsRes.data.assignments);
      setCourseAnnouncements(announcementsRes.data.announcements);
    } catch (error) {
      showToast('Failed to load course details', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderCourseCard = (course: Course, isEnrolled: boolean) => (
    <div key={course.id} className="course-card">
      <div className="course-card-header">
        <h3>{course.title}</h3>
        {isEnrolled ? (
          <button
            className="btn-unenroll"
            onClick={() => handleUnenroll(course.id)}
          >
            Unenroll
          </button>
        ) : (
          <button
            className="btn-enroll"
            onClick={() => handleEnroll(course.id)}
          >
            Enroll
          </button>
        )}
      </div>
      <p className="course-description">{course.description}</p>
      <div className="course-meta">
        <p className="instructor-name">Instructor: {course.instructor_name}</p>
        <p className="students-count">{course.enrolled_students_count} students enrolled</p>
      </div>
      {isEnrolled && (
        <button
          className="btn-view-details"
          onClick={() => handleViewCourseDetails(course)}
        >
          View Course Details
        </button>
      )}
    </div>
  );

  return (
    <div className="student-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <div>
            <h1>Student Dashboard</h1>
            <p>Welcome, {user?.fullName}</p>
          </div>
          <div className="header-actions">
            <button onClick={() => navigate('/ai-agent-hub')} className="ai-hub-button">
              🤖 AI Agent Hub
            </button>
            <button onClick={logout} className="logout-button">Logout</button>
          </div>
        </div>
      </header>

      {!showCourseDetails ? (
        <>
          <div className="dashboard-tabs">
            <button
              className={`tab ${activeTab === 'all-courses' ? 'active' : ''}`}
              onClick={() => setActiveTab('all-courses')}
            >
              All Courses
            </button>
            <button
              className={`tab ${activeTab === 'my-courses' ? 'active' : ''}`}
              onClick={() => setActiveTab('my-courses')}
            >
              My Courses
            </button>
          </div>

          <main className="dashboard-main">
            {loading && <div className="loading">Loading...</div>}

            {activeTab === 'all-courses' && !loading && (
              <div className="courses-section">
                <h2>All Available Courses</h2>
                {allCourses.length === 0 ? (
                  <p className="empty-message">No courses available</p>
                ) : (
                  <div className="courses-grid">
                    {allCourses.map((course) => renderCourseCard(course, course.is_enrolled || false))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'my-courses' && !loading && (
              <div className="courses-section">
                <h2>My Enrolled Courses</h2>
                {myCourses.length === 0 ? (
                  <p className="empty-message">You are not enrolled in any courses yet</p>
                ) : (
                  <div className="courses-grid">
                    {myCourses.map((course) => renderCourseCard(course, true))}
                  </div>
                )}
              </div>
            )}
          </main>
        </>
      ) : (
        <div className="course-details">
          <div className="course-details-header">
            <button
              className="btn-back"
              onClick={() => {
                setShowCourseDetails(false);
                setSelectedCourse(null);
              }}
            >
              ← Back to Courses
            </button>
          </div>

          <main className="dashboard-main">
            <div className="course-info-section">
              <div className="course-info-card">
                <h1>{selectedCourse?.title}</h1>
                <p>{selectedCourse?.description}</p>
                <div className="course-meta-detail">
                  <span>Instructor: {selectedCourse?.instructor_name}</span>
                  <span>{selectedCourse?.enrolled_students_count} students enrolled</span>
                </div>
              </div>
            </div>

            <div className="content-grid">
              <div className="assignments-section">
                <h2>Assignments</h2>
                {courseAssignments.length === 0 ? (
                  <p className="empty-message">No assignments yet</p>
                ) : (
                  <div className="content-list">
                    {courseAssignments.map((assignment) => (
                      <div key={assignment.id} className="content-card">
                        <h3>{assignment.title}</h3>
                        <p>{assignment.description}</p>
                        <div className="content-footer">
                          <span>Due: {assignment.due_date ? new Date(assignment.due_date).toLocaleDateString() : 'No due date'}</span>
                          <span className="points">{assignment.points} points</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="announcements-section">
                <h2>Announcements</h2>
                {courseAnnouncements.length === 0 ? (
                  <p className="empty-message">No announcements yet</p>
                ) : (
                  <div className="content-list">
                    {courseAnnouncements.map((announcement) => (
                      <div key={announcement.id} className="content-card">
                        <h3>{announcement.title}</h3>
                        <p>{announcement.content}</p>
                        <div className="content-footer">
                          <span>Posted {new Date(announcement.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </main>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;
