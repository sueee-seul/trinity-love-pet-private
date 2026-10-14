import React, { useEffect, useRef, useState } from 'react';
import type { ReviewSortOption } from '../selectors/reviewSelectors';
import type { ReviewTopic } from '../types/reviewTypes';
import { ReviewIcon } from './ReviewIcon';

interface ReviewControlsProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  sortOption: ReviewSortOption;
  onSortChange: (value: ReviewSortOption) => void;
  topics?: readonly ReviewTopic[];
}

const SORT_OPTIONS: readonly { value: ReviewSortOption; label: string }[] = [
  { value: 'relevance', label: 'Most relevant' },
  { value: 'newest', label: 'Newest' },
  { value: 'highest', label: 'Highest rating' },
  { value: 'lowest', label: 'Lowest rating' },
];

export const ReviewControls: React.FC<ReviewControlsProps> = ({
  searchQuery,
  onSearchChange,
  sortOption,
  onSortChange,
  topics = [],
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const controlsRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);
  const shouldRestoreSearchFocusRef = useRef(false);

  useEffect(() => {
    if (!isSearchOpen && !isSortOpen) {
      return;
    }

    const handleOutsideMouseDown = (event: MouseEvent): void => {
      const target = event.target;
      if (controlsRef.current && target instanceof Node && !controlsRef.current.contains(target)) {
        setIsSearchOpen(false);
        setIsSortOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }

      if (isSortOpen) {
        setIsSortOpen(false);
        return;
      }

      shouldRestoreSearchFocusRef.current = true;
      setIsSearchOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return (): void => {
      document.removeEventListener('mousedown', handleOutsideMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSearchOpen, isSortOpen]);

  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
      return;
    }

    if (shouldRestoreSearchFocusRef.current) {
      searchButtonRef.current?.focus();
      shouldRestoreSearchFocusRef.current = false;
    }
  }, [isSearchOpen]);

  const openSearch = (): void => {
    setIsSearchOpen(true);
    setIsSortOpen(false);
  };

  const toggleSort = (): void => {
    setIsSortOpen((open) => !open);
  };

  return (
    <section ref={controlsRef} className="maps-review-controls" aria-label="Review controls">
      <div className="maps-review-controls__toolbar">
        {isSearchOpen ? (
          <div className="maps-review-search-input">
            <input
              ref={searchInputRef}
              id="maps-review-search-input"
              type="text"
              aria-label="Search reviews"
              placeholder="Search reviews"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
            />
            <button
              type="button"
              className="maps-review-search-input__clear"
              aria-label="Clear"
              onClick={() => onSearchChange('')}
            >
              <ReviewIcon name="close" />
            </button>
          </div>
        ) : (
          <button
            ref={searchButtonRef}
            type="button"
            className="maps-review-icon-button"
            aria-label="Search reviews"
            aria-expanded={isSearchOpen}
            aria-controls="maps-review-search-input"
            onClick={openSearch}
          >
            <ReviewIcon name="search" />
          </button>
        )}

        <div className="maps-review-sort-control">
          <button
            type="button"
            className={`maps-review-sort-button ${isSearchOpen || isSortOpen ? 'maps-review-sort-button--active' : ''}`}
            aria-label="Sort reviews"
            aria-expanded={isSortOpen}
            aria-haspopup="menu"
            aria-controls="maps-review-sort-menu"
            onClick={toggleSort}
          >
            <ReviewIcon name="sort" />
            <span>Sort</span>
          </button>

          {isSortOpen && (
            <div
              id="maps-review-sort-menu"
              className="maps-review-sort-menu"
              role="menu"
              aria-label="Review sort options"
            >
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className="maps-review-sort-menu__item"
                  role="menuitemradio"
                  aria-checked={sortOption === option.value}
                  onClick={() => {
                    onSortChange(option.value);
                    setIsSortOpen(false);
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="maps-review-topics" aria-label="Review topics">
        {topics.map((topic, index) => (
          <button
            type="button"
            className={`maps-review-topic ${index === 0 ? 'maps-review-topic--active' : ''}`}
            key={topic.label}
            aria-pressed={index === 0}
            aria-disabled="true"
          >
            <ReviewIcon name={topic.icon} />
            <span>{topic.label}</span>
            {topic.count !== undefined && (
              <span className="maps-review-topic__count">{topic.count}</span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
};
