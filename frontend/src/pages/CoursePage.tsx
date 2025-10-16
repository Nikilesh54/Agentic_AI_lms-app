import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './CoursePage.css';

const CoursePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  // Mock data for demonstration
  const course = {
    id: parseInt(id || '1'),
    title: 'Web Development',
    description: 'Learn modern web development with React, Node.js, and databases.',
    instructor: 'Dr. Smith',
    progress: 75
  };

  const assignments = [
    {
      id: 1,
      title: 'React Components Assignment',
      description: 'Create reusable React components for a todo application.',
      dueDate: '2024-01-15',
      points: 100,
      status: 'pending'
    },
    {
      id: 2,
      title: 'API Integration Project',
      description: 'Build a RESTful API using Node.js and Express.',
      dueDate: '2024-01-22',
      points: 150,
      status: 'pending'
    },
    {
      id: 3,
      title: 'Database Design',
      description: 'Design and implement a database schema for an e-commerce site.',
      dueDate: '2024-01-25',
      points: 120,
      status: 'completed'
    }
  ];

  const announcements = [
    {
      id: 1,
      title: 'Assignment 1 Due Date Extended',
      content: 'The due date for Assignment 1 has been extended to January 15th. Please submit your work by 11:59 PM.',
      author: 'Dr. Smith',
      date: '2024-01-10'
    },
    {
      id: 2,
      title: 'Office Hours Update',
      content: 'Office hours for this week will be held on Tuesday and Thursday from 2-4 PM.',
      author: 'Dr. Smith',
      date: '2024-01-08'
    }
  ];

  const modules = [
    {
      id: 1,
      title: 'Introduction to React',
      description: 'Learn the basics of React components and JSX.',
      lessons: 5,
      completed: 5
    },
    {
      id: 2,
      title: 'State Management',
      description: 'Understanding React state and props.',
      lessons: 4,
      completed: 3
    },
    {
      id: 3,
      title: 'API Integration',
      description: 'Connecting React apps to backend APIs.',
      lessons: 6,
      completed: 1
    }
  ];

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
            <div className="assignments-list">
              {assignments.map((assignment) => (
                <div key={assignment.id} className="assignment-item">
                  <div className="assignment-header">
                    <h3>{assignment.title}</h3>
                    <span className={`status ${assignment.status}`}>
                      {assignment.status}
                    </span>
                  </div>
                  <p className="assignment-description">{assignment.description}</p>
                  <div className="assignment-details">
                    <span className="due-date">Due: {assignment.dueDate}</span>
                    <span className="points">{assignment.points} points</span>
                  </div>
                </div>
              ))}
            </div>
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
      
      case 'modules':
        return (
          <div className="modules-content">
            <h2>Course Modules</h2>
            <div className="modules-list">
              {modules.map((module) => (
                <div key={module.id} className="module-item">
                  <div className="module-header">
                    <h3>{module.title}</h3>
                    <span className="module-progress">
                      {module.completed}/{module.lessons} lessons
                    </span>
                  </div>
                  <p className="module-description">{module.description}</p>
                  <div className="module-progress-bar">
                    <div 
                      className="progress-fill" 
                      style={{ width: `${(module.completed / module.lessons) * 100}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
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
              className={`tab ${activeTab === 'modules' ? 'active' : ''}`}
              onClick={() => setActiveTab('modules')}
            >
              Modules
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
