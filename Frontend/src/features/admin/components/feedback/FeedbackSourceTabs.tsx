import React from 'react';
import type { FeedbackSource } from '../../types/feedback';

interface FeedbackSourceTabsProps {
  /** Current source selected by the parent feedback page. */
  activeSource: FeedbackSource;
  /** Parent-owned source transition; this component does not load either source. */
  onChange: (source: FeedbackSource) => void;
}

const SOURCE_TABS: readonly { value: FeedbackSource; label: string }[] = [
  { value: 'google-reviews', label: 'Google Reviews' },
  { value: 'internal', label: 'Internal Feedback' },
];

const getNextSource = (
  currentSource: FeedbackSource,
  direction: 'next' | 'previous',
): FeedbackSource => {
  const currentIndex = SOURCE_TABS.findIndex((tab) => tab.value === currentSource);
  const offset = direction === 'next' ? 1 : -1;
  const nextIndex = (currentIndex + offset + SOURCE_TABS.length) % SOURCE_TABS.length;
  return SOURCE_TABS[nextIndex]?.value ?? 'google-reviews';
};

/**
 * Renders the shared source selector for Internal Feedback and Google Reviews.
 *
 * @remarks
 * The tabs share visual and keyboard behavior but do not merge the two data sources or own their
 * loading/mutation state. Arrow keys cycle between the two source values and delegate the change
 * to the parent page.
 */
export const FeedbackSourceTabs: React.FC<FeedbackSourceTabsProps> = ({
  activeSource,
  onChange,
}) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      onChange(getNextSource(activeSource, 'next'));
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      onChange(getNextSource(activeSource, 'previous'));
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Feedback source"
      className="mb-6 flex items-center gap-6 border-b border-border-soft"
    >
      {SOURCE_TABS.map((tab) => {
        const isActive = activeSource === tab.value;
        return (
          <button
            key={tab.value}
            id={`feedback-source-tab-${tab.value}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`feedback-source-panel-${tab.value}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={handleKeyDown}
            className={`relative -mb-px px-1 pb-3 pt-1 type-button transition-colors focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 ${
              isActive
                ? 'border-b-2 border-accent-foreground text-accent-foreground'
                : 'text-notice-secondary hover:text-accent-foreground-hover'
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};
