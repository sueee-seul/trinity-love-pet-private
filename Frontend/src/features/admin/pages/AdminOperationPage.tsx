import React, { useState } from 'react';
import { OperationSidebar, type OperationTab } from '../components/operation/OperationSidebar';
import { GoogleReviewDashboard } from '../components/operation/feedback-dashboard/GoogleReviewDashboard';
import { KpiDashboard } from '../components/operation/KpiDashboard';
import { AdminTeamPage } from './AdminTeamPage';
import { StaffDashboardPage } from './StaffDashboardPage';
import { AdminNotificationCenterPage } from './AdminNotificationCenterPage';
import { useLocation, useSearchParams } from 'react-router-dom';
import { AdminPage } from '../components/layout/AdminPage';

const OPERATION_TABS: readonly OperationTab[] = [
  'feedback',
  'team',
  'kpi',
  'staff',
  'notifications',
];

/** `?tab=notifications` opens that tab; an unknown or missing value keeps the default. */
const toOperationTab = (value: string | null): OperationTab | null =>
  OPERATION_TABS.find((tab) => tab === value) ?? null;

export const AdminOperationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const requestedTab = toOperationTab(searchParams.get('tab'));
  const [activeTab, setActiveTab] = useState<OperationTab>(requestedTab ?? 'feedback');
  // Opening the page again from the bell (a new navigation) switches to the requested tab, even
  // when the page is already open; the sidebar still changes tabs without touching the URL.
  const [handledNavigation, setHandledNavigation] = useState(location.key);
  if (location.key !== handledNavigation) {
    setHandledNavigation(location.key);
    if (requestedTab) {
      setActiveTab(requestedTab);
    }
  }

  return (
    <AdminPage width="wide">
      <div className="flex flex-col md:flex-row gap-8">
        <OperationSidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Content Area */}
        <div className="flex-1 min-w-0 space-y-6">
          {activeTab === 'feedback' && <GoogleReviewDashboard />}
          {activeTab === 'team' && <AdminTeamPage />}
          {activeTab === 'staff' && <StaffDashboardPage />}
          {activeTab === 'kpi' && <KpiDashboard />}
          {activeTab === 'notifications' && <AdminNotificationCenterPage />}
        </div>
      </div>
    </AdminPage>
  );
};
