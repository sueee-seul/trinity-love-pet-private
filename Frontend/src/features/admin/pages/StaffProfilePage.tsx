import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { AccessibilitySettingsToggle, AppearanceSettings } from '../../../shared/accessibility';
import { ProfileIdentityCard } from '../components/profile/ProfileIdentityCard';
import { AssignedPetsPanel } from '../components/profile/AssignedPetsPanel';
import type { CurrentStaffViewProps } from '../store/currentStaffStore';
import { AdminPage } from '../components/layout/AdminPage';

const STAFF_TABS = ['profile', 'assigned', 'settings'] as const;
type StaffTab = (typeof STAFF_TABS)[number];

/** Guards the query string: an unknown or hand-edited value falls back to the overview. */
const isStaffTab = (value: string | null): value is StaffTab =>
  value !== null && STAFF_TABS.includes(value as StaffTab);

interface NavItem {
  id: StaffTab;
  label: string;
  iconPath: string;
}

// Same icon paths the manager sidebar uses for its own "Profile Overview" and
// "Platform Settings" items, so the two surfaces read as one product.
const PROFILE_ICON_PATH =
  'M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z';
const SETTINGS_ICON_PATH =
  'M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.014-.2.059-.352.153-.43l.841-.692a1.875 1.875 0 00.432-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z';
// Same paw glyph the pet parent sidebar uses for "My Pets" - the staff
// equivalent is the pets assigned to this carer.
const ASSIGNED_PETS_ICON_PATH =
  'M8.25 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm12 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zM6 8.25a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm16.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zM12 8.25c2.485 0 4.5 2.686 4.5 6 0 2.09-1.007 3.75-2.7 3.75-.72 0-1.26-.24-1.8-.24s-1.08.24-1.8.24c-1.693 0-2.7-1.66-2.7-3.75 0-3.314 2.015-6 4.5-6z';

const ACCOUNT_ITEMS: NavItem[] = [
  { id: 'profile', label: 'Profile Overview', iconPath: PROFILE_ICON_PATH },
];

const ORGANIZATION_ITEMS: NavItem[] = [
  { id: 'assigned', label: 'Assigned Pets', iconPath: ASSIGNED_PETS_ICON_PATH },
];

const SETTING_ITEMS: NavItem[] = [
  { id: 'settings', label: 'Settings', iconPath: SETTINGS_ICON_PATH },
];

function NavButton({
  item,
  isActive,
  onClick,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      aria-current={isActive ? 'page' : undefined}
      onClick={onClick}
      className={`group flex items-center px-4 py-3 text-left rounded-2xl transition-all duration-200 ease-out ${
        isActive
          ? 'bg-surface-cream text-accent-foreground font-medium shadow-sm ring-1 ring-border-soft'
          : 'text-notice-secondary hover:bg-surface-cream/50 hover:text-accent-foreground'
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className={`mr-3 h-5 w-5 shrink-0 transition-colors ${
          isActive
            ? 'text-accent-foreground'
            : 'text-notice-muted group-hover:text-accent-foreground'
        }`}
      >
        <path fillRule="evenodd" d={item.iconPath} clipRule="evenodd" />
      </svg>
      {item.label}
    </button>
  );
}

function NavSection({
  heading,
  items,
  activeTab,
  onChange,
}: {
  heading: string;
  items: NavItem[];
  activeTab: StaffTab;
  onChange: (tab: StaffTab) => void;
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <p className="px-4 type-eyebrow text-notice-muted">{heading}</p>
      {items.map((item) => (
        <NavButton
          key={item.id}
          item={item}
          isActive={activeTab === item.id}
          onClick={() => onChange(item.id)}
        />
      ))}
    </div>
  );
}

export const StaffProfilePage: React.FC<CurrentStaffViewProps> = ({
  staff,
  assignments,
  assignmentStatus,
  assignmentError,
  saveError,
  saving,
  saveProfile,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();

  /*
   * The tab is read from the URL rather than held in local state, matching the pet parent profile
   * and, more importantly, working with the accessibility toolbar: it links here with
   * `?tab=settings`, and pressing it while already on this page is a same-route navigation. React
   * Router updates the query string without remounting, so state seeded once at mount would leave
   * the tab where it was. Deriving it also makes a tab linkable and survive a refresh.
   */
  const tabParam = searchParams.get('tab');
  const activeTab: StaffTab = isStaffTab(tabParam) ? tabParam : 'profile';

  // `replace` so moving between tabs does not fill the history with entries to step back through.
  const setActiveTab = (tab: StaffTab): void => {
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
        {/* Sidebar - mirrors the manager sidebar's shell, pill states and icon
            sizing (see ManagerProfilePage.tsx), grouped the same way the pet
            parent sidebar is: account / organization / setting. */}
        <div className="w-full md:w-64 flex-shrink-0 rounded-2xl border border-border-soft bg-surface-card p-6 shadow-card h-fit">
          <header className="mb-6">
            <p className="type-eyebrow text-notice-muted">My account</p>
            <h1 className="type-display mt-1">Staff profile</h1>
          </header>

          <nav className="flex flex-col gap-5" aria-label="Staff account sections">
            <NavSection
              heading="Account"
              items={ACCOUNT_ITEMS}
              activeTab={activeTab}
              onChange={setActiveTab}
            />
            <NavSection
              heading="Organization"
              items={ORGANIZATION_ITEMS}
              activeTab={activeTab}
              onChange={setActiveTab}
            />
            <NavSection
              heading="Setting"
              items={SETTING_ITEMS}
              activeTab={activeTab}
              onChange={setActiveTab}
            />
          </nav>
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0 space-y-6">
          {activeTab === 'profile' && (
            <div className="animate-in fade-in duration-300">
              <ProfileIdentityCard
                staff={staff}
                saving={saving}
                saveError={saveError}
                onSave={saveProfile}
              />
            </div>
          )}

          {activeTab === 'assigned' && (
            <div className="animate-in fade-in duration-300">
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
            <div className="animate-in fade-in duration-300 space-y-4">
              <section className="rounded-2xl border border-border-soft bg-surface-card p-6 shadow-card">
                <h2 className="type-title mb-4">Appearance</h2>
                <AppearanceSettings />
              </section>

              <AccessibilitySettingsToggle />

              <p className="type-meta text-notice-muted px-1">
                Notification and account preferences will land here too; they have no data or API
                behind them yet.
              </p>
            </div>
          )}
        </div>
      </div>
    </AdminPage>
  );
};
