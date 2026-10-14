import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../../shared/auth/store/authStore';
import { BrandMark } from '../../../shared/brand/BrandMark';
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery';
import { AiChatIconButton } from '../ai-chat/components/AiChatIconButton';
import { useProfileState } from '../profile/useProfileState';
import { useProfileSync } from '../profile/useProfileSync';
import { usePortalCopy } from '../i18n/portalLocale';
import { HomeIcon } from './home/HomeIcons';
import { NAVBAR_COPY } from './navbar/navbarCopy';
import { ParentAccountMenu, type ParentAccount } from './navbar/ParentAccountMenu';
import {
  DESKTOP_NAV_ITEMS,
  PHONE_TAB_ITEMS,
  isNavItemCurrent,
  type ParentNavItem,
} from './navbar/parentNavItems';
import { PetParentNotificationPopover } from './PetParentNotificationPopover';
import { PetParentSettingsModal } from './PetParentSettingsModal';

// The wordmark goes to the public front page, which a signed-in parent also sees; Home in the
// pill navigation stays the way to the pet centre.
const FRONT_PAGE = '/';
// Tailwind's `md` breakpoint, where the desktop header replaces the phone header.
const DESKTOP_HEADER_QUERY = '(min-width: 48rem)';

/** The fixed Wagstay paw and wordmark; `markClassName` sizes the paw for the bar it sits in. */
function BrandLink({ markClassName }: { markClassName: string }): React.ReactElement {
  return (
    <Link to={FRONT_PAGE} className="group flex min-h-11 items-center gap-3">
      <BrandMark className={markClassName} />
      {/* The logo font has one weight, so the wordmark is never asked to be bold. */}
      <span className="type-card-title font-logo font-normal tracking-wide transition-colors group-hover:text-accent-foreground-hover">
        Wagstay
      </span>
    </Link>
  );
}

function DesktopNavLink({
  item,
  pathname,
}: {
  item: ParentNavItem;
  pathname: string;
}): React.ReactElement {
  const isCurrent = isNavItemCurrent(pathname, item);
  const copy = usePortalCopy(NAVBAR_COPY);
  // The current page is the solid pill (navigation.css reads `aria-current`), so it is marked by
  // shape as well as colour.
  return (
    <Link to={item.to} aria-current={isCurrent ? 'page' : undefined} className="nav-pill">
      {copy[item.labelKey]}
    </Link>
  );
}

// The portal is behind a sign-in guard, so these only show for the moment between logging out and
// leaving the portal.
function LogInLink(): React.ReactElement {
  const copy = usePortalCopy(NAVBAR_COPY);
  return (
    <Link
      to="/login"
      className="type-button inline-flex min-h-11 items-center text-notice-primary transition-colors hover:text-accent-foreground-hover"
    >
      {copy.logIn}
    </Link>
  );
}

function SignUpLink(): React.ReactElement {
  const copy = usePortalCopy(NAVBAR_COPY);
  return (
    <Link
      to="/signup"
      className="type-button inline-flex min-h-11 items-center rounded-full bg-action-dark theme-gradient-action px-6 text-on-action-dark shadow-card transition-colors hover:bg-action-dark-hover"
    >
      {copy.signUp}
    </Link>
  );
}

function PhoneTabBar({ pathname }: { pathname: string }): React.ReactElement {
  const copy = usePortalCopy(NAVBAR_COPY);
  return (
    <nav
      aria-label={copy.tabsNav}
      className="nav-tabbar fixed inset-x-0 bottom-0 z-50 border-t border-border-soft bg-surface-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex h-14">
        {PHONE_TAB_ITEMS.map((item) => {
          const isCurrent = isNavItemCurrent(pathname, item);
          return (
            <li key={item.to} className="flex-1">
              <Link
                to={item.to}
                aria-current={isCurrent ? 'page' : undefined}
                className="nav-tab h-full gap-0.5"
              >
                {/* The pill behind the current tab's icon marks it by shape as well as colour. */}
                <span aria-hidden="true" className="nav-tab-indicator">
                  <HomeIcon name={item.icon} className="h-5 w-5" />
                </span>
                <span className="type-eyebrow normal-case leading-none tracking-normal">
                  {copy[item.labelKey]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export const PetParentNavbar: React.FC = () => {
  const { pathname } = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  useProfileSync();
  const profile = useProfileState();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const copy = usePortalCopy(NAVBAR_COPY);
  // CSS hides the desktop header on phones but React still mounts it, and the bell loads the
  // parent's notices when it mounts. So the bell is only rendered where the header shows. Where
  // the size cannot be read, the bell is kept.
  const showsDesktopHeader = useMediaQuery(DESKTOP_HEADER_QUERY, true);

  // The uploaded picture wins over the initials, and it updates the moment the profile saves
  // because both read the same store.
  const account: ParentAccount = {
    name: profile?.owner.fullName || user?.name || user?.email || copy.accountFallbackName,
    email: user?.email ?? null,
    avatarUrl: profile?.owner.avatarUrl ?? null,
  };
  const openSettings = (): void => setIsSettingsOpen(true);

  return (
    <>
      {/* Desktop and tablet header */}
      <header className="sticky top-0 z-40 hidden h-20 border-b border-border-soft bg-surface-deep theme-gradient-shell shadow-card md:block">
        <div className="mx-auto flex h-full max-w-[1240px] items-center justify-between gap-6 px-6 lg:px-8">
          <BrandLink markClassName="h-10 w-10" />

          <nav aria-label={copy.mainNav}>
            <ul className="nav-pills nav-pills--shell">
              {DESKTOP_NAV_ITEMS.map((item) => (
                <li key={item.to}>
                  <DesktopNavLink item={item} pathname={pathname} />
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1">
            {isAuthenticated ? (
              <>
                <AiChatIconButton />
                {showsDesktopHeader && <PetParentNotificationPopover />}
                {/* Some themes paint `border-soft` strongly, so the bar's divider is a lighter step
                    of it, as tall as the icons. */}
                <span aria-hidden="true" className="mx-2 h-5 w-px bg-border-soft/50" />
                <ParentAccountMenu account={account} onOpenSettings={openSettings} />
              </>
            ) : (
              <>
                <LogInLink />
                <SignUpLink />
              </>
            )}
          </div>
        </div>
      </header>

      {/* Phone header: the brand, the bell (daily updates and decisions arrive here too) and the
          same account menu as the desktop header. The bell mounts in one header only. */}
      <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-3 border-b border-border-soft bg-surface-deep theme-gradient-shell px-4 shadow-card md:hidden">
        <BrandLink markClassName="h-8 w-8" />
        <div className="flex items-center gap-1">
          {isAuthenticated ? (
            <>
              {!showsDesktopHeader && <PetParentNotificationPopover />}
              <ParentAccountMenu account={account} onOpenSettings={openSettings} />
            </>
          ) : (
            <LogInLink />
          )}
        </div>
      </header>

      <PhoneTabBar pathname={pathname} />

      <PetParentSettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
};
