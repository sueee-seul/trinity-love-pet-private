import React from 'react';
import { useSiteCopy } from '../../i18n/siteLanguage';
import { ACCESSIBILITY_COPY } from '../accessibilityCopy';
import { useAccessibilityStore } from '../store/accessibilityStore';

const TOGGLE_DESCRIPTION_ID = 'accessibility-launcher-toggle-description';

/**
 * Settings control for the floating accessibility button. Turning it off also restores the default
 * reading experience, so a visitor can never be left zoomed in with the control hidden.
 */
export const AccessibilitySettingsToggle: React.FC = () => {
  const isLauncherEnabled = useAccessibilityStore((state) => state.isLauncherEnabled);
  const setLauncherEnabled = useAccessibilityStore((state) => state.setLauncherEnabled);
  const { launcherToggle: copy } = useSiteCopy(ACCESSIBILITY_COPY);

  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-border-soft bg-surface-cream/40 p-4">
      <div>
        <p className="type-body font-semibold">{copy.title}</p>
        <p id={TOGGLE_DESCRIPTION_ID} className="mt-1 mb-0 type-meta">
          {copy.description}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={isLauncherEnabled}
        aria-label={copy.switchLabel}
        aria-describedby={TOGGLE_DESCRIPTION_ID}
        onClick={() => setLauncherEnabled(!isLauncherEnabled)}
        className={`mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full border p-0.5 transition-colors focus:outline-none focus:ring-2 focus:ring-focus ${
          isLauncherEnabled
            ? 'border-accent-foreground bg-theme-sun'
            : 'border-control-border/40 bg-surface-bubbles'
        }`}
      >
        {/*
         * The knob stays in flow inside a padded flex track rather than being positioned
         * absolutely. An absolute knob is offset from its static position, which depends on the
         * button's own box, so any padding or border change slid it outside the track.
         */}
        <span
          aria-hidden="true"
          className={`block h-5 w-5 rounded-full bg-surface-card shadow-sm transition-transform motion-reduce:transition-none ${
            isLauncherEnabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};
