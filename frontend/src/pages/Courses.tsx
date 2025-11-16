import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * This page redirects to the dashboard
 * Students should use the Student Dashboard for course management
 */
const Courses: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to dashboard based on user role
    navigate('/dashboard', { replace: true });
  }, [navigate, user]);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontSize: '1.2rem',
      color: '#666'
    }}>
      Redirecting to dashboard...
    </div>
  );
};

export default Courses;
