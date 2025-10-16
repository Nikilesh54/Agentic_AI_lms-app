import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import RootDashboard from '../pages/RootDashboard';
import ProfessorDashboard from '../pages/ProfessorDashboard';
import StudentDashboard from '../pages/StudentDashboard';

const RoleBasedDashboard: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return null;
  }

  switch (user.role) {
    case 'root':
      return <RootDashboard />;
    case 'professor':
      return <ProfessorDashboard />;
    case 'student':
      return <StudentDashboard />;
    default:
      return <StudentDashboard />;
  }
};

export default RoleBasedDashboard;
