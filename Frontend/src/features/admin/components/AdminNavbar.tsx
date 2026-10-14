import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';

import { authApi } from '../../../shared/auth/api/authApi';
import { useAuthStore } from '../../../shared/auth/store/authStore';
import { BrandMark } from '../../../shared/brand/BrandMark';
import { resetProfileState } from '../../pet-parent/profile/repository';
import { useCurrentStaffStore } from '../store/currentStaffStore';
import { resetGoogleReviewStore } from '../store/googleReviewStore';
import { resetGoogleReviewNotificationStore } from '../store/googleReviewNotificationStore';
import { AdminNotificationPopover } from './AdminNotificationPopover';

const ADMIN_NAV_ITEMS = [
  { label: 'Petlist', to: '/admin/pets' },
  { label: 'Inquiries', to: '/admin/inquiries' },
  { label: 'Tasks', to: '/admin/tasks' },
  { label: 'Bookings', to: '/admin/bookings' },
  { label: 'Operation', to: '/admin/operation' },
  { label: 'Feedback', to: '/admin/feedback' },
] as const;

const ADMIN_MOBILE_MENU_ID = 'admin-mobile-menu';

export const AdminNavbar: React.FC = () => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const staff = useCurrentStaffStore((state) => state.staff);
  const clearCurrentStaff = useCurrentStaffStore((state) => state.clear);
  const resolvedRole = staff?.employee_role ?? user?.employee_role ?? null;
  const baseItems =
    resolvedRole === 'manager'
      ? [...ADMIN_NAV_ITEMS, { label: 'Shift', to: '/admin/shifts' }]
      : ADMIN_NAV_ITEMS;

  // Hides Feedback and Operation from staff; Bookings opens read-only for them
  const visibleNavItems = baseItems.filter(
    (item) => (item.label !== 'Feedback' && item.label !== 'Operation') || resolvedRole !== 'staff',
  );
  const profileLabel =
    resolvedRole === 'manager'
      ? 'Manager Profile'
      : resolvedRole === 'staff'
        ? 'Staff Profile'
        : 'Profile';
  const avatarSrc =
    staff?.avatarUrl ??
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      staff?.name || user?.name || 'Staff',
    )}&background=eb9c14&color=fff&bold=true`;
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent): void => {
      const target = event.target;
      if (userMenuRef.current && target instanceof Node && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsUserMenuOpen(false);
        userMenuButtonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return (): void => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isUserMenuOpen]);

  const handleLogout = (): void => {
    void authApi.logout().catch(() => undefined);
    clearCurrentStaff();
    resetGoogleReviewStore();
    resetGoogleReviewNotificationStore();
    logout();
    resetProfileState();
    setIsUserMenuOpen(false);
    navigate('/', { replace: true });
  };

  return (
    <>
      <header className="theme-gradient-shell sticky top-0 z-40 border-b border-border-soft bg-surface-card shadow-sm">
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* The brand and the account controls keep their size; only the links' track gives. */}
            <div className="flex shrink-0 items-center">
              {/* Mobile Menu Button */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden -ml-2 mr-2 p-2 rounded-md text-notice-secondary hover:text-notice-primary hover:bg-surface-cream focus:outline-none transition-colors"
                aria-label="Toggle mobile menu"
                aria-expanded={isMobileMenuOpen}
                aria-controls={isMobileMenuOpen ? ADMIN_MOBILE_MENU_ID : undefined}
              >
                {isMobileMenuOpen ? (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                )}
              </button>

              <Link to="/admin" className="group flex cursor-pointer items-center">
                <BrandMark className="mr-3 h-9 w-9" />
                <span className="flex items-center type-title font-logo type-card-title tracking-tight text-notice-primary transition-colors group-hover:text-accent-foreground-hover">
                  Wagstay
                  {/* Folded away on a tablet, where the seven links need the room. */}
                  <span className="ml-2 rounded-md bg-surface-bubbles px-2 py-0.5 type-eyebrow text-theme-earth hidden sm:inline-block md:hidden lg:inline-block">
                    Admin
                  </span>
                </span>
              </Link>
            </div>

            {/*
             * The current page is the solid pill; NavLink marks it with aria-current="page", and
             * keeps it on nested pages such as one pet under /admin/pets.
             */}
            <nav aria-label="Admin" className="hidden min-w-0 items-center px-2 md:flex">
              <ul className="nav-pills nav-pills--shell nav-pills--compact overflow-x-auto">
                {visibleNavItems.map((item) => (
                  <li key={item.label}>
                    <NavLink to={item.to} className="nav-pill">
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="flex shrink-0 items-center space-x-2 sm:space-x-4">
              {resolvedRole === 'manager' && (
                <>
                  <AdminNotificationPopover />
                  <div className="mx-1 sm:mx-2 hidden h-6 w-px bg-theme-apricot sm:block" />
                </>
              )}
              <div ref={userMenuRef} className="relative sm:ml-2">
                <button
                  ref={userMenuButtonRef}
                  type="button"
                  onClick={() => setIsUserMenuOpen((isOpen) => !isOpen)}
                  aria-label="Open admin account menu"
                  aria-haspopup="menu"
                  aria-expanded={isUserMenuOpen}
                  aria-controls="admin-account-menu"
                  className="group flex cursor-pointer rounded-full border-2 border-transparent type-button transition-colors focus:border-focus focus:outline-none"
                >
                  <img
                    className="h-8 w-8 sm:h-9 sm:w-9 rounded-full object-cover shadow-sm transition-all group-hover:ring-2 group-hover:ring-focus group-hover:ring-offset-2"
                    src={avatarSrc}
                    alt="Admin Avatar"
                    loading="lazy"
                    decoding="async"
                  />
                </button>

                {isUserMenuOpen && (
                  <div
                    id="admin-account-menu"
                    role="menu"
                    aria-label="Admin account menu"
                    className="absolute right-0 top-full z-50 mt-2 min-w-48 overflow-hidden rounded-2xl border border-border-soft bg-surface-card p-1 shadow-xl"
                  >
                    <Link
                      to="/admin/profile"
                      role="menuitem"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="block w-full rounded-xl px-3 py-2 text-left type-button text-notice-secondary transition-colors hover:bg-surface-cream hover:text-accent-foreground-hover focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                      {profileLabel}
                    </Link>

                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="block w-full rounded-xl px-3 py-2 text-left type-button text-notice-secondary transition-colors hover:bg-surface-cream hover:text-accent-foreground-hover focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                      Change account
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="block w-full rounded-xl px-3 py-2 text-left type-button text-notice-secondary transition-colors hover:bg-surface-cream hover:text-accent-foreground-hover focus:outline-none focus:ring-2 focus:ring-focus"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div
            id={ADMIN_MOBILE_MENU_ID}
            className="md:hidden border-t border-border-soft bg-surface-card px-4 py-3 shadow-inner max-h-[calc(100vh-4rem)] overflow-y-auto"
          >
            <ul className="nav-pills nav-pills--stacked">
              {visibleNavItems.map((item) => (
                <li key={item.label}>
                  <NavLink
                    to={item.to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="nav-pill w-full"
                  >
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        )}
      </header>
    </>
  );
};
