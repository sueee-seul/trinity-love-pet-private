import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { ReviewerProfile } from '../api/reviewerAuthApi';
import { ReviewIcon } from './ReviewIcon';
import { ReviewerAvatar } from './ReviewerAvatar';

interface ReviewPageHeaderProps {
  reviewer: ReviewerProfile | null;
  onSignOut: () => Promise<void>;
}

export const ReviewPageHeader: React.FC<ReviewPageHeaderProps> = ({ reviewer, onSignOut }) => {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent): void => {
      const target = event.target;
      if (
        accountMenuRef.current &&
        target instanceof Node &&
        !accountMenuRef.current.contains(target)
      ) {
        setIsAccountMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsAccountMenuOpen(false);
        accountButtonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return (): void => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isAccountMenuOpen]);

  const handleSignOut = useCallback((): void => {
    setIsAccountMenuOpen(false);
    void onSignOut().catch(() => undefined);
  }, [onSignOut]);

  return (
    <header className="maps-review-header">
      <div className="maps-review-header__inner">
        <a className="maps-review-brand" href="/maps/place/PetHouse/" aria-label="Wagstay Reviews">
          <div className="maps-review-brand-logo">
            <svg className="maps-review-brand-icon" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm4 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zM8 4c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-3.5 3.5c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm13 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6.5 2.5c-3.31 0-6 2.69-6 6v4h12v-4c0-3.31-2.69-6-6-6z" />
            </svg>
          </div>
          <span className="maps-review-brand-text">Wagstay Reviews</span>
        </a>

        <div className="maps-review-search" role="search" aria-label="Search Reviews">
          <ReviewIcon name="search" />
          <span>Search Reviews</span>
        </div>

        <nav className="maps-review-header__actions" aria-label="Page utilities">
          <button type="button" aria-label="Open help" aria-disabled="true">
            <ReviewIcon name="help_outline" />
          </button>
          <div ref={accountMenuRef} className="maps-review-account">
            <button
              ref={accountButtonRef}
              type="button"
              aria-label="Open account menu"
              aria-haspopup={reviewer ? 'menu' : undefined}
              aria-expanded={reviewer ? isAccountMenuOpen : undefined}
              aria-controls={reviewer ? 'maps-review-account-menu' : undefined}
              disabled={!reviewer}
              onClick={() => setIsAccountMenuOpen((isOpen) => !isOpen)}
            >
              {reviewer ? (
                <ReviewerAvatar
                  reviewer={reviewer}
                  className="maps-review-header-avatar"
                  imageClassName="maps-review-header-avatar__image"
                  testId="maps-review-header-avatar"
                />
              ) : (
                <ReviewIcon name="account_circle" />
              )}
            </button>

            {reviewer && isAccountMenuOpen && (
              <div
                id="maps-review-account-menu"
                role="menu"
                aria-label="Google Maps account menu"
                className="maps-review-account-menu"
              >
                <button
                  type="button"
                  role="menuitem"
                  className="maps-review-account-menu__item"
                  onClick={handleSignOut}
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
};
