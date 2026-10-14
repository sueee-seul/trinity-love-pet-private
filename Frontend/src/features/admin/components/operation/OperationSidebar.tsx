import React, { type ReactNode } from 'react';
import { useCurrentStaffStore } from '../../store/currentStaffStore';
import { useAuthStore } from '../../../../shared/auth/store/authStore';

export type OperationTab = 'feedback' | 'team' | 'kpi' | 'staff' | 'notifications';

interface OperationNavigationItem {
  id: OperationTab;
  label: string;
  mobileLabel: string;
  icon: ReactNode;
}

interface OperationNavigationGroup {
  label: string;
  items: readonly OperationNavigationItem[];
}

interface OperationSidebarProps {
  activeTab: OperationTab;
  onTabChange: (tab: OperationTab) => void;
}

const FeedbackIcon: React.FC = () => (
  <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M2.25 4.5c0-.828.672-1.5 1.5-1.5h16.5c.828 0 1.5.672 1.5 1.5v12c0 .828-.672 1.5-1.5 1.5h-4.872l-4.148 3.11a1.5 1.5 0 01-1.8 0L5.278 18H3.75c-.828 0-1.5-.672-1.5-1.5v-12z" />
  </svg>
);

const TeamIcon: React.FC = () => (
  <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path
      fillRule="evenodd"
      d="M8.25 6a3 3 0 11-6 0 3 3 0 016 0zM15.75 6a3 3 0 11-6 0 3 3 0 016 0zM23.25 6a3 3 0 11-6 0 3 3 0 016 0zM7.151 14.325a2.25 2.25 0 01-2.115 1.925H3.75a2.25 2.25 0 01-2.115-1.925 15.342 15.342 0 015.516 0zM14.651 14.325a2.25 2.25 0 01-2.115 1.925h-1.286a2.25 2.25 0 01-2.115-1.925 15.342 15.342 0 015.516 0zM22.151 14.325a2.25 2.25 0 01-2.115 1.925h-1.286a2.25 2.25 0 01-2.115-1.925 15.342 15.342 0 015.516 0z"
      clipRule="evenodd"
    />
  </svg>
);

const StaffDashboardIcon: React.FC = () => (
  <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <rect x="3.75" y="3.75" width="1.5" height="16.5" rx="0.75" />
    <rect x="3.75" y="18.75" width="16.5" height="1.5" rx="0.75" />
    <rect x="7.5" y="14.25" width="2.5" height="4.5" rx="0.75" />
    <rect x="12" y="10.5" width="2.5" height="8.25" rx="0.75" />
    <rect x="16.5" y="6.75" width="2.5" height="12" rx="0.75" />
  </svg>
);

const KpiIcon: React.FC = () => (
  <svg aria-hidden="true" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    <path
      fillRule="evenodd"
      d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
      clipRule="evenodd"
    />
  </svg>
);

const NotificationIcon: React.FC = () => (
  <svg
    aria-hidden="true"
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M15 17h5l-1.4-1.4a2 2 0 01-.6-1.4V11a6 6 0 00-4.9-5.9V4a1.1 1.1 0 00-2.2 0v1.1A6 6 0 006 11v3.2a2 2 0 01-.6 1.4L4 17h5m6 0a3 3 0 01-6 0m6 0H9"
    />
  </svg>
);

export const OperationSidebar: React.FC<OperationSidebarProps> = ({ activeTab, onTabChange }) => {
  const user = useAuthStore((state) => state.user);
  const staff = useCurrentStaffStore((state) => state.staff);
  const resolvedRole = staff?.employee_role ?? user?.employee_role ?? null;
  const isManager = resolvedRole === 'manager';

  const navigationGroups: OperationNavigationGroup[] = [
    {
      label: 'Operations',
      items: [
        {
          id: 'feedback',
          label: 'Feedback Overview',
          mobileLabel: 'Feedback',
          icon: <FeedbackIcon />,
        },
        ...(isManager
          ? [
              {
                id: 'team',
                label: 'Team Management',
                mobileLabel: 'Team',
                icon: <TeamIcon />,
              } as const,
              {
                id: 'staff',
                label: 'Staff Management',
                mobileLabel: 'Staff',
                icon: <StaffDashboardIcon />,
              } as const,
              { id: 'kpi', label: 'KPI', mobileLabel: 'KPI', icon: <KpiIcon /> } as const,
              {
                id: 'notifications',
                label: 'Notifications',
                mobileLabel: 'Alerts',
                icon: <NotificationIcon />,
              } as const,
            ]
          : []),
      ],
    },
  ];

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden h-fit w-full flex-shrink-0 rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card md:block md:w-64">
        <header className="mb-7">
          <h2 className="type-card-title text-theme-earth">My workspace</h2>
        </header>

        <nav aria-label="Operation workspace sections" className="space-y-5">
          {navigationGroups.map((group, groupIndex) => (
            <section
              key={group.label}
              className={groupIndex > 0 ? 'border-t border-border-soft pt-5' : undefined}
            >
              <p className="mb-2 type-eyebrow text-notice-muted">{group.label}</p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = item.id === activeTab;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => onTabChange(item.id)}
                      className={`group flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                        isActive
                          ? 'bg-surface-cream text-accent-foreground'
                          : 'text-notice-secondary hover:bg-surface-cream/70 hover:text-accent-foreground'
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors ${
                          isActive
                            ? 'bg-theme-sun text-on-sun'
                            : 'bg-surface-deep text-notice-secondary group-hover:bg-surface-bubbles group-hover:text-accent-foreground'
                        }`}
                      >
                        {item.icon}
                      </span>
                      <span className="type-button text-inherit">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-[56px] border-t border-border-soft bg-surface-card pb-safe md:hidden">
        {navigationGroups[0].items.map((item) => {
          const isActive = item.id === activeTab;
          return (
            <button
              key={item.id}
              type="button"
              aria-label={item.label}
              aria-pressed={isActive}
              onClick={() => onTabChange(item.id)}
              className={`flex h-full w-full flex-col items-center justify-center type-meta font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                isActive
                  ? 'text-accent-foreground'
                  : 'text-notice-primary hover:text-accent-foreground-hover'
              }`}
            >
              <span
                className={`mb-0.5 flex h-5 w-5 items-center justify-center ${isActive ? 'text-accent-foreground' : 'text-notice-secondary'}`}
              >
                {item.icon}
              </span>
              <span className="type-meta sm:type-meta text-inherit line-clamp-1 px-1">
                {item.mobileLabel}
              </span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
