import React from 'react';
import { useSiteCopy } from '../../i18n/siteLanguage';
import { ACCESSIBILITY_COPY } from '../accessibilityCopy';
import { AccessibilityIcon } from './AccessibilityIcon';

interface AccessibilityLauncherProps {
  onOpen: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}

/**
 * The floating launcher sits bottom-left rather than bottom-right: the AI chat panel already owns
 * the right corner, and on mobile the bottom offset clears the 48px tab bar.
 */
export const AccessibilityLauncher: React.FC<AccessibilityLauncherProps> = ({
  onOpen,
  buttonRef,
}) => {
  const copy = useSiteCopy(ACCESSIBILITY_COPY);

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onOpen}
      data-testid="accessibility-launcher"
      aria-label={copy.launcher}
      /*
       * Three layers make the edge. The sun fill clears 5:1 against every theme's page colour, and
       * the earth border does the same for the default page, where the fill alone is about 2:1. The
       * outer ring in the card colour separates the button from whatever the palette did not plan
       * for, such as Royal's dark shell or a photograph.
       *
       * The shadow is written out rather than taken from `shadow-card`: a theme replaces that
       * utility's whole box shadow, which also removed the ring. Focus uses an outline for the same
       * reason, and an outline also survives forced colours mode.
       */
      className="fixed bottom-[64px] left-4 z-[55] flex h-14 w-14 items-center justify-center rounded-full border-2 border-accent-foreground bg-theme-sun text-on-sun shadow-[0_4px_24px_color-mix(in_srgb,var(--color-shadow-tint)_6%,transparent)] ring-2 ring-surface-card transition-transform hover:scale-105 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none md:bottom-6 md:left-6"
    >
      <AccessibilityIcon className="h-7 w-7" />
    </button>
  );
};
