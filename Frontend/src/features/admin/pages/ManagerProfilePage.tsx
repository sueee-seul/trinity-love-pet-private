import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { ProfileIdentityCard } from '../components/profile/ProfileIdentityCard';
import { AssignedPetsPanel } from '../components/profile/AssignedPetsPanel';
import { AdminSettingsView } from '../components/profile/AdminSettingsView';
import {
  ManagerProfileSidebar,
  type ManagerProfileTab,
} from '../components/profile/ManagerProfileSidebar';
import type { CurrentStaffViewProps } from '../store/currentStaffStore';
import { AdminPage } from '../components/layout/AdminPage';

export const ManagerProfilePage: React.FC<CurrentStaffViewProps> = ({
  staff: me,
  assignments,
  assignmentStatus,
  assignmentError,
  saveError,
  saving,
  saveProfile,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  /*
   * The tab is read from the URL, matching the staff profile, so the accessibility toolbar can
   * link straight to Platform Settings with `?tab=settings`. Pressing that button while already
   * on this page is a same-route navigation - the query string changes without a remount - so
   * state seeded once at mount would leave the tab where it was.
   */
  const activeTab: ManagerProfileTab =
    searchParams.get('tab') === 'settings' ? 'settings' : 'profile';

  // `replace` so moving between tabs does not fill the history with entries to step back through.
  const setActiveTab = (tab: ManagerProfileTab): void => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'profile') {
      next.delete('tab');
    } else {
      next.set('tab', tab);
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <AdminPage width="standard">
      <div className="flex flex-col md:flex-row gap-8">
        <ManagerProfileSidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Content Area */}
        <div className="flex-1 min-w-0 space-y-6">
          {activeTab === 'profile' && (
            <div className="animate-in fade-in duration-300 space-y-6">
              <ProfileIdentityCard
                staff={me}
                saving={saving}
                saveError={saveError}
                onSave={saveProfile}
              />
              {assignmentError ? (
                <p role="alert" className="type-body text-status-danger">
                  {assignmentError}
                </p>
              ) : (
                <AssignedPetsPanel
                  assignments={assignments}
                  loading={assignmentStatus === 'loading'}
                />
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="animate-in fade-in duration-300">
              <AdminSettingsView />
            </div>
          )}
        </div>
      </div>
    </AdminPage>
  );
};
