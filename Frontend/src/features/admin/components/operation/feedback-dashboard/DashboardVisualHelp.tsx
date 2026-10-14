import React, { useId } from 'react';

interface DashboardVisualHelpProps {
  visualName: string;
  note: string;
}

/**
 * Provides concise context for a manager-facing dashboard visual.
 * The native title preserves the existing KPI hover behavior while the
 * described hidden text makes the same note available on keyboard focus.
 */
export const DashboardVisualHelp: React.FC<DashboardVisualHelpProps> = ({ visualName, note }) => {
  const descriptionId = useId();

  return (
    <>
      <button
        type="button"
        aria-label={`Help for ${visualName}`}
        aria-describedby={descriptionId}
        title={note}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-border-soft text-notice-muted hover:bg-surface-deep hover:text-notice-primary focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <span aria-hidden="true" className="type-meta">
          ?
        </span>
      </button>
      <span id={descriptionId} className="sr-only">
        {note}
      </span>
    </>
  );
};
