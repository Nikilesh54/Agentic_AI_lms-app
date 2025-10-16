import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

  // Mock data for demonstration
  const upcomingAssignments = [
    {
      id: 1,
      title: 'React Components Assignment',
      course: 'Web Development',
      dueDate: '2024-01-15',
      points: 100
    },
    {
      id: 2,
      title: 'Database Design Project',
      course: 'Database Systems',
      dueDate: '2024-01-18',
      points: 150
    },
    {
      id: 3,
      title: 'Algorithm Analysis Quiz',
      course: 'Data Structures',
      dueDate: '2024-01-20',
      points: 50
    }
  ];

  const recentCourses = [
    {
      id: 1,
      title: 'Web Development',
      instructor: 'Dr. Smith',
      progress: 75
    },
    {
      id: 2,
      title: 'Database Systems',
      instructor: 'Prof. Johnson',
      progress: 60
    },
    {
      id: 3,
      title: 'Data Structures',
      instructor: 'Dr. Brown',
      progress: 45
    }
  ];

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Welcome back, {user?.fullName}!</h1>
          <button onClick={logout} className="logout-button">
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-grid">
          {/* Quick Stats */}
          <div className="stats-section">
            <h2>Quick Overview</h2>
            <div className="stats-grid">
              <div className="stat-card">
                <h3>3</h3>
                <p>Active Courses</p>
              </div>
              <div className="stat-card">
                <h3>5</h3>
                <p>Upcoming Assignments</p>
              </div>
              <div className="stat-card">
                <h3>85%</h3>
                <p>Average Grade</p>
              </div>
            </div>
          </div>

          {/* Upcoming Assignments */}
          <div className="assignments-section">
            <div className="section-header">
              <h2>Upcoming Assignments</h2>
              <Link to="/courses" className="view-all-link">View All</Link>
            </div>
            <div className="assignments-list">
              {upcomingAssignments.map((assignment) => (
                <div key={assignment.id} className="assignment-card">
                  <div className="assignment-info">
                    <h3>{assignment.title}</h3>
                    <p className="course-name">{assignment.course}</p>
                    <p className="due-date">Due: {assignment.dueDate}</p>
                  </div>
                  <div className="assignment-points">
                    {assignment.points} pts
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Courses */}
          <div className="courses-section">
            <div className="section-header">
              <h2>My Courses</h2>
              <Link to="/courses" className="view-all-link">View All</Link>
            </div>
            <div className="courses-grid">
              {recentCourses.map((course) => (
                <Link key={course.id} to={`/courses/${course.id}`} className="course-card">
                  <div className="course-header">
                    <h3>{course.title}</h3>
                    <p className="instructor">{course.instructor}</p>
                  </div>
                  <div className="course-progress">
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${course.progress}%` }}
                      ></div>
                    </div>
                    <span className="progress-text">{course.progress}% Complete</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
