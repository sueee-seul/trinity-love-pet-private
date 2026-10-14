import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAdminFeedbackSnapshot } from '../hooks/useAdminFeedbackSnapshot';

export const AdminFeedbackLayout: React.FC = () => {
  useAdminFeedbackSnapshot(true);

  return <Outlet />;
};
