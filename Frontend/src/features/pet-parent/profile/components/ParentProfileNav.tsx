import type { ReactElement, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { PARENT_STAYS_PATH, type ParentProfileTab } from '../parentProfileTabs';
import { usePortalCopy } from '../../i18n/portalLocale';
import { ACCOUNT_COPY, type AccountCopy } from '../copy/accountCopy';

/**
 * Left-hand navigation for the pet parent account area.
 *
 * It uses the words a customer uses: "Account" for their own details and pets, "Stays" for their
 * bookings and "Settings" for preferences. (It used to copy the manager sidebar's
 * "Organization" and "Setting", which mean nothing to a pet parent.)
 *
 * Profile, My pets, Emergency contacts and Updates and notifications are views of this page, kept
 * in the query string (`?tab=`), so each one is linkable and survives a refresh. My stays is a
 * link: the stays list lives at /parent/stays, and this area does not keep a second copy of it.
 * Account settings has no view of its own, so it opens the same settings dialog the top navbar's
 * avatar menu does.
 */
interface NavTab {
  id: ParentProfileTab;
  /** Which word of the nav copy names this tab, so the label follows the site language. */
  labelKey: keyof Pick<AccountCopy['nav'], 'profileTab' | 'petsTab' | 'contactsTab' | 'updatesTab'>;
  iconPath: string;
}

const ACCOUNT_TABS: NavTab[] = [
  {
    id: 'profile',
    labelKey: 'profileTab',
    iconPath:
      'M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z',
  },
  {
    id: 'pets',
    labelKey: 'petsTab',
    iconPath:
      'M8.25 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm12 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zM6 8.25a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm16.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zM12 8.25c2.485 0 4.5 2.686 4.5 6 0 2.09-1.007 3.75-2.7 3.75-.72 0-1.26-.24-1.8-.24s-1.08.24-1.8.24c-1.693 0-2.7-1.66-2.7-3.75 0-3.314 2.015-6 4.5-6z',
  },
  {
    id: 'contacts',
    labelKey: 'contactsTab',
    // A telephone handset: the people we call when we cannot reach the parent.
    iconPath:
      'M1.5 4.5a3 3 0 013-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 01-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 006.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 011.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 01-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5z',
  },
];

const SETTINGS_TABS: NavTab[] = [
  {
    id: 'updates',
    labelKey: 'updatesTab',
    // A bell: the daily update, its language, quiet hours and email.
    iconPath:
      'M5.25 9a6.75 6.75 0 0113.5 0v.75c0 2.123.8 4.057 2.118 5.52a.75.75 0 01-.297 1.206c-1.544.57-3.16.99-4.831 1.243a3.75 3.75 0 11-7.48 0 24.585 24.585 0 01-4.831-1.244.75.75 0 01-.298-1.205A8.217 8.217 0 005.25 9.75V9zm4.502 8.9a2.25 2.25 0 104.496 0 25.057 25.057 0 01-4.496 0z',
  },
];

const STAYS_ICON_PATH =
  'M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z';

const SETTINGS_ICON_PATH =
  'M11.078 2.25c-.917 0-1.699.663-1.85 1.567L9.05 4.889c-.02.12-.115.26-.297.348a7.493 7.493 0 00-.986.57c-.166.115-.334.126-.45.083L6.3 5.508a1.875 1.875 0 00-2.282.819l-.922 1.597a1.875 1.875 0 00.432 2.385l.84.692c.095.078.17.229.154.43a7.598 7.598 0 000 1.139c.015.2-.059.352-.153.43l-.841.692a1.875 1.875 0 00-.432 2.385l.922 1.597a1.875 1.875 0 002.282.818l1.019-.382c.115-.043.283-.031.45.082.312.214.641.405.985.57.182.088.277.228.297.35l.178 1.071c.151.904.933 1.567 1.85 1.567h1.844c.916 0 1.699-.663 1.85-1.567l.178-1.072c.02-.12.114-.26.297-.349.344-.165.673-.356.985-.57.167-.114.335-.125.45-.082l1.02.382a1.875 1.875 0 002.28-.819l.923-1.597a1.875 1.875 0 00-.432-2.385l-.84-.692c-.095-.078-.17-.229-.154-.43a7.614 7.614 0 000-1.139c-.014-.2.059-.352.153-.43l.841-.692a1.875 1.875 0 00.432-2.385l-.922-1.597a1.875 1.875 0 00-2.282-.818l-1.02.382c-.114.043-.282.031-.449-.083a7.49 7.49 0 00-.985-.57c-.183-.087-.277-.227-.297-.348l-.179-1.072a1.875 1.875 0 00-1.85-1.567h-1.843zM12 15.75a3.75 3.75 0 100-7.5 3.75 3.75 0 000 7.5z';

// `type-button` sets Inter; without it the item text fell back to the page's Times New Roman.
const itemClass = (isActive: boolean): string =>
  `group flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-left type-button transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
    isActive
      ? 'bg-surface-cream text-accent-foreground ring-1 ring-border-soft'
      : 'text-notice-secondary hover:bg-surface-cream/60 hover:text-accent-foreground'
  }`;

function NavIcon({ path, isActive }: { path: string; isActive: boolean }): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={`h-5 w-5 shrink-0 transition-colors ${
        isActive ? 'text-accent-foreground' : 'text-notice-muted group-hover:text-accent-foreground'
      }`}
    >
      <path fillRule="evenodd" d={path} clipRule="evenodd" />
    </svg>
  );
}

function TabButton({
  tab,
  activeTab,
  label,
  onChange,
}: {
  tab: NavTab;
  activeTab: ParentProfileTab;
  label: string;
  onChange: (tab: ParentProfileTab) => void;
}): ReactElement {
  const isActive = activeTab === tab.id;
  return (
    <button
      type="button"
      aria-current={isActive ? 'page' : undefined}
      onClick={() => onChange(tab.id)}
      className={itemClass(isActive)}
    >
      <NavIcon path={tab.iconPath} isActive={isActive} />
      {label}
    </button>
  );
}

function NavGroup({ heading, children }: { heading: string; children: ReactNode }): ReactElement {
  return (
    <div className="flex flex-col gap-1">
      <p className="m-0 px-3 pb-1 type-eyebrow text-notice-muted">{heading}</p>
      {children}
    </div>
  );
}

export function ParentProfileNav({
  activeTab,
  onChange,
  onOpenSettings,
}: {
  activeTab: ParentProfileTab;
  onChange: (tab: ParentProfileTab) => void;
  onOpenSettings: () => void;
}): ReactElement {
  const copy = usePortalCopy(ACCOUNT_COPY).nav;
  return (
    <nav
      aria-label={copy.label}
      className="flex w-full shrink-0 flex-col gap-5 rounded-2xl border border-border-soft bg-surface-card p-4 shadow-card md:w-60"
    >
      <NavGroup heading={copy.accountHeading}>
        {ACCOUNT_TABS.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            activeTab={activeTab}
            label={copy[tab.labelKey]}
            onChange={onChange}
          />
        ))}
      </NavGroup>
      <NavGroup heading={copy.staysHeading}>
        <Link to={PARENT_STAYS_PATH} className={itemClass(false)}>
          <NavIcon path={STAYS_ICON_PATH} isActive={false} />
          {copy.myStays}
        </Link>
      </NavGroup>
      <NavGroup heading={copy.settingsHeading}>
        {SETTINGS_TABS.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            activeTab={activeTab}
            label={copy[tab.labelKey]}
            onChange={onChange}
          />
        ))}
        <button type="button" onClick={onOpenSettings} className={itemClass(false)}>
          <NavIcon path={SETTINGS_ICON_PATH} isActive={false} />
          {copy.accountSettings}
        </button>
      </NavGroup>
    </nav>
  );
}
