import React from 'react';
import { useSiteCopy } from '../../i18n/siteLanguage';
import { ACCESSIBILITY_COPY } from '../accessibilityCopy';
import { SELECTABLE_CONTRAST_THEMES } from '../constants';
import { useAccessibilityStore } from '../store/accessibilityStore';

const SECTION_DESCRIPTION_ID = 'contrast-settings-description';

/**
 * Every reading colour mode. None of them are in the toolbar.
 *
 * They are reading aids rather than themes, so they sit in their own section and each one
 * overrides whatever brand theme is chosen above: one button, one appearance.
 *
 * Toggles rather than a radio group, because nothing is selected until a visitor asks for it and
 * they need a way back. Pressing the active mode clears it and the brand theme returns, which a
 * radio group cannot express: a radio can be changed but not unset.
 */
export const ContrastSettingsSection: React.FC = () => {
  const contrastTheme = useAccessibilityStore((state) => state.contrastTheme);
  const setContrastTheme = useAccessibilityStore((state) => state.setContrastTheme);
  const { contrast } = useSiteCopy(ACCESSIBILITY_COPY);

  return (
    <div className="rounded-2xl border border-border-soft bg-surface-cream/40 p-4">
      <p className="type-body font-semibold">{contrast.title}</p>
      <p id={SECTION_DESCRIPTION_ID} className="mt-1 mb-0 type-meta">
        {contrast.description}
      </p>

      <div
        role="group"
        aria-label={contrast.groupLabel}
        aria-describedby={SECTION_DESCRIPTION_ID}
        className="mt-3 flex flex-wrap gap-2"
      >
        {SELECTABLE_CONTRAST_THEMES.map((theme) => {
          const isSelected = theme === contrastTheme;

          return (
            <button
              key={theme}
              type="button"
              aria-pressed={isSelected}
              onClick={() => setContrastTheme(isSelected ? 'default' : theme)}
              className={`rounded-xl border px-3 py-2 type-button transition-colors focus:outline-none focus:ring-2 focus:ring-focus ${
                isSelected
                  ? 'border-accent-foreground bg-surface-card text-accent-foreground'
                  : 'border-border-soft text-notice-secondary hover:bg-surface-card'
              }`}
            >
              {contrast.shortLabels[theme]}
              <span className="sr-only">
                {', '}
                {contrast.labels[theme]}
                {isSelected ? contrast.pressAgain : ''}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
