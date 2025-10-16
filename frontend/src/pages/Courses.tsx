import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Courses.css';

const Courses: React.FC = () => {
  const { user, logout } = useAuth();

  // Mock data for demonstration
  const courses = [
    {
      id: 1,
      title: 'Web Development',
      description: 'Learn modern web development with React, Node.js, and databases.',
      instructor: 'Dr. Smith',
      progress: 75,
      assignments: 8,
      announcements: 3
    },
    {
      id: 2,
      title: 'Database Systems',
      description: 'Comprehensive study of database design, implementation, and management.',
      instructor: 'Prof. Johnson',
      progress: 60,
      assignments: 6,
      announcements: 2
    },
    {
      id: 3,
      title: 'Data Structures',
      description: 'Advanced data structures and algorithms for efficient programming.',
      instructor: 'Dr. Brown',
      progress: 45,
      assignments: 10,
      announcements: 4
    },
    {
      id: 4,
      title: 'Software Engineering',
      description: 'Software development methodologies and best practices.',
      instructor: 'Prof. Davis',
      progress: 30,
      assignments: 4,
      announcements: 1
    }
  ];

  return (
    <div className="courses-page">
      <header className="courses-header">
        <div className="header-content">
          <h1>My Courses</h1>
          <div className="header-actions">
            <span className="user-info">Welcome, {user?.fullName}</span>
            <button onClick={logout} className="logout-button">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="courses-main">
        <div className="courses-container">
          <div className="courses-grid">
            {courses.map((course) => (
              <Link key={course.id} to={`/courses/${course.id}`} className="course-card">
                <div className="course-header">
                  <h2>{course.title}</h2>
                  <p className="instructor">Instructor: {course.instructor}</p>
                </div>
                
                <div className="course-description">
                  <p>{course.description}</p>
                </div>

                <div className="course-stats">
                  <div className="stat">
                    <span className="stat-number">{course.assignments}</span>
                    <span className="stat-label">Assignments</span>
                  </div>
                  <div className="stat">
                    <span className="stat-number">{course.announcements}</span>
                    <span className="stat-label">Announcements</span>
                  </div>
                </div>

                <div className="course-progress">
                  <div className="progress-header">
                    <span>Progress</span>
                    <span>{course.progress}%</span>
                  </div>
                  <div className="progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${course.progress}%` }}
                    ></div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Courses;
