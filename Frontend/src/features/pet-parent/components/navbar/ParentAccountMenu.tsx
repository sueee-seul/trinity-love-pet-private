import { useEffect, useId, useRef, useState, type ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../../../shared/auth/api/authApi';
import { useAuthStore } from '../../../../shared/auth/store/authStore';
import { usePortalCopy } from '../../i18n/portalLocale';
import { resetProfileState } from '../../profile/repository';
import { ACCOUNT_MENU_COPY } from './accountMenuCopy';

export interface ParentAccount {
  /** The profile's full name, or the email when no name is known yet. */
  name: string;
  email: string | null;
  avatarUrl: string | null;
}

const AVATAR_RING =
  'h-9 w-9 rounded-full transition-shadow group-hover:ring-2 group-hover:ring-focus group-hover:ring-offset-2';

/*
 * A filled circle rather than the pages' soft `AVATAR` tile. Under a brand theme the header paints
 * every span in it with the bar's own ink, except inside a filled `bg-action-dark` control, so only
 * this pair keeps the initials readable on every theme.
 */
const INITIALS_AVATAR = `${AVATAR_RING} flex shrink-0 items-center justify-center bg-action-dark type-meta font-bold text-on-action-dark`;

const MENU_ITEM =
  'flex min-h-11 w-full items-center rounded-xl px-3 text-left type-button text-notice-secondary transition-colors hover:bg-surface-cream hover:text-accent-foreground-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus';

/** "Phuong Nguyen" becomes "PN", "max@example.com" becomes "M". */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.charAt(0) ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.charAt(0) ?? '') : '';
  return `${first}${last}`.toUpperCase() || '?';
}

// Initials are drawn here rather than fetched from an avatar service, so the parent's name never
// leaves the site just to paint a circle.
function AccountAvatar({ account }: { account: ParentAccount }): ReactElement {
  if (account.avatarUrl) {
    return (
      <img
        src={account.avatarUrl}
        alt=""
        decoding="async"
        className={`${AVATAR_RING} object-cover`}
      />
    );
  }
  return (
    <span aria-hidden="true" className={INITIALS_AVATAR}>
      {initialsOf(account.name)}
    </span>
  );
}

/**
 * The account button and its menu. The desktop and phone headers each render one, so a phone can
 * reach feedback, settings and log out as well.
 *
 * A disclosure (a button that shows a list of links) rather than an ARIA menu: a menu promises
 * arrow-key navigation, and Tab through four items is what a pointer or keyboard user expects here.
 */
export function ParentAccountMenu({
  account,
  onOpenSettings,
}: {
  account: ParentAccount;
  onOpenSettings: () => void;
}): ReactElement {
  const copy = usePortalCopy(ACCOUNT_MENU_COPY);
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const [isOpen, setIsOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent): void => {
      const target = event.target;
      if (
        containerRef.current &&
        target instanceof Node &&
        !containerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return (): void => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const close = (): void => setIsOpen(false);

  const handleLogout = (): void => {
    // The local sign-out must not wait on the server: the parent asked to leave, so they leave
    // even when the logout call fails.
    void authApi.logout().catch(() => undefined);
    logout();
    // The profile cache is a page-lifetime singleton, not scoped to whoever is signed in. Without
    // this, the next account to sign in in this tab would see (and could overwrite) this profile.
    resetProfileState();
    close();
    navigate('/', { replace: true });
  };

  const showEmail = account.email !== null && account.email !== account.name;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label={copy.menuButton}
        aria-expanded={isOpen}
        aria-controls={menuId}
        className="group flex h-11 w-11 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      >
        <AccountAvatar account={account} />
      </button>

      {isOpen && (
        <div
          id={menuId}
          className="absolute right-0 top-full z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-border-soft bg-surface-card p-1 shadow-card"
        >
          <div className="border-b border-border-soft px-3 pb-2 pt-1.5">
            <p className="type-body m-0 truncate font-bold">{account.name}</p>
            {showEmail && <p className="type-meta m-0 truncate">{account.email}</p>}
          </div>
          <ul className="pt-1">
            <li>
              <Link to="/parent/profile" onClick={close} className={MENU_ITEM}>
                {copy.profile}
              </Link>
            </li>
            <li>
              <Link to="/parent/feedback" onClick={close} className={MENU_ITEM}>
                {copy.leaveFeedback}
              </Link>
            </li>
            <li>
              <button
                type="button"
                onClick={() => {
                  close();
                  onOpenSettings();
                }}
                className={MENU_ITEM}
              >
                {copy.accountSettings}
              </button>
            </li>
            <li>
              <button type="button" onClick={handleLogout} className={MENU_ITEM}>
                {copy.logOut}
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
