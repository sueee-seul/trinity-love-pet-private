import React from 'react';
import { useSiteCopy } from '../../i18n/siteLanguage';
import { ACCESSIBILITY_COPY } from '../accessibilityCopy';
import { AppearanceSettings } from './AppearanceSettings';

interface AppearancePanelProps {
  panelId: string;
  onClose: () => void;
}

/**
 * Every theme and every reading colour mode, full screen under the toolbar.
 *
 * Who sees this: a visitor with no settings page of their own. A pet parent is sent to Account
 * Settings and a staff member to their profile's Settings tab, so in practice this is the
 * signed-out login page, plus the moment before the session has hydrated.
 *
 * That makes it their only route to a theme or to high contrast, which is why it takes the whole
 * screen rather than dropping a capped sheet out of the bar. The controls are the task here, not
 * something offered beside a page they were already reading.
 *
 * Both sections are the same components Account Settings renders, reading and writing the same
 * stores. There is no second copy of this UI to keep in step.
 */
export const AppearancePanel: React.FC<AppearancePanelProps> = ({ panelId, onClose }) => {
  const copy = useSiteCopy(ACCESSIBILITY_COPY);

  return (
    <div
      id={panelId}
      role="group"
      aria-label={copy.toolbar.appearanceLabel}
      data-a11y-ui="toolbar"
      data-testid="accessibility-appearance-panel"
      /*
       * Full screen, below the bar.
       *
       * This is the only route to a theme and to the reading colours for a signed-out visitor -
       * everyone else is sent to their own settings page - so it is the whole task, not a detail
       * beside one. A dropping sheet had to cap itself at 70vh and scroll inside a scrolling page,
       * which put the reading colours below a fold nobody could see.
       *
       * `fixed`, and offset by the bar's measured height rather than `top-full`: the widget sizes
       * the page offset from the bar's `offsetHeight`, so a panel in the flow would shove the page
       * down on open and yank it back on close.
       */
      className="fixed inset-x-0 bottom-0 z-10 overflow-y-auto px-3 pb-6 shadow-card"
      style={{
        top: 'var(--a11y-bar-height, 0px)',
        backgroundColor: 'var(--brand-shell, var(--color-surface-deep))',
        color: 'var(--brand-shell-ink, var(--color-notice-primary))',
      }}
    >
      <div className="mx-auto max-w-[1240px] space-y-3 pt-4">
        <AppearanceSettings />

        <div className="flex justify-end">
          {/*
           * The button brings its own card ground and ink, the same pair the bar's buttons use, so
           * it reads on any shell. Text inherited from the shell is unsafe here: Royal's shell ink
           * is cream, and any light fill behind the button put cream text on cream.
           */}
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-control-border bg-surface-card px-4 type-button text-notice-primary transition-colors hover:bg-surface-cream focus:outline-none focus:ring-2 focus:ring-focus"
          >
            {copy.panelDone}
          </button>
        </div>
      </div>
    </div>
  );
};
