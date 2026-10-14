import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { AiChatFloatingPanel } from '../ai-chat/components/AiChatFloatingPanel';
import { useAiChatStore } from '../ai-chat/store';
import { useAiChatLiveUpdates } from '../ai-chat/useAiChatLiveUpdates';
import { PetParentNavbar } from './PetParentNavbar';

/*
 * `--parent-page-chrome` is how much of the viewport the header, the phone tab bar and the padding
 * around the panel take. A page that must fill the screen exactly, such as Chat, sizes itself with
 * `calc(100dvh - var(--parent-page-chrome))`. The values follow the paddings on `main` and the
 * panel below, so change them together:
 * - phone: 4rem header, 0.5rem + 0.75rem + 0.75rem padding, 4rem tab bar and gap, plus the home
 *   indicator.
 * - sm: 4rem header, 1.5rem + 1.5rem + 1.5rem padding, 4rem tab bar and gap, plus the home indicator.
 * - md: 5rem header, 1.5rem + 1.5rem + 1.5rem padding, 2rem at the bottom.
 * - lg: 5rem header, 2rem + 2rem + 2rem padding, 2rem at the bottom.
 */
const PAGE_CHROME =
  '[--parent-page-chrome:calc(10rem_+_env(safe-area-inset-bottom))] sm:[--parent-page-chrome:calc(12.5rem_+_env(safe-area-inset-bottom))] md:[--parent-page-chrome:11.5rem] lg:[--parent-page-chrome:13rem]';

export const PetParentPortal: React.FC = () => {
  const loadConversations = useAiChatStore((state) => state.loadConversations);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useAiChatLiveUpdates();

  // `bg-theme-page` paints the theme's picture behind the homepage and the inner pages alike, one
  // screen in size whatever the page's length. `parent-type-scale` gives every pet parent page the
  // customer sizes.
  return (
    <div
      className={`parent-type-scale bg-theme-page flex min-h-dvh flex-col bg-surface-cream ${PAGE_CHROME}`}
    >
      <PetParentNavbar />

      {/*
       * Below `md` the bottom padding clears the fixed 3rem tab bar, a 1rem gap and the phone's
       * home indicator. It is set per axis: a shorthand `sm:p-6` used to reset it to 1.5rem
       * between 640px and 768px, where the tab bar still shows, and hid the end of every page.
       */}
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-2 pb-[calc(4rem_+_env(safe-area-inset-bottom))] pt-2 sm:px-6 sm:pt-6 md:pb-8 lg:p-8">
        {/*
         * Every page, the homepage included, sits on the same panel. `parent-content-panel` sets
         * its opacity in `index.css`, 94%, the measured floor for text over any picture, so no
         * heading or label is ever read straight off the photograph.
         */}
        {/*
         * No backdrop blur here. A backdrop filter makes the panel the containing block of every
         * `fixed` element inside it and gives it its own stacking layer, so a page's dialog was
         * placed inside the panel and slid under the sticky header. At 94% cover the blur was
         * barely visible anyway.
         */}
        {/* On a phone the panel keeps only a thin edge of the picture, so the page gets the width. */}
        <div className="parent-content-panel h-full rounded-2xl p-3 shadow-card sm:rounded-3xl sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>

      <AiChatFloatingPanel />
    </div>
  );
};
