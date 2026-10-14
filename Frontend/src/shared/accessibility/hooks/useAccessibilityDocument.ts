import { useEffect } from 'react';
import { useAccessibilityStore } from '../store/accessibilityStore';

/**
 * Pushes accessibility state onto `<html>` as data attributes and custom properties.
 *
 * Everything the toolbar changes is applied from here rather than from component styles, because
 * the overrides have to reach the whole application, including the 170-odd hard-coded `text-[Npx]`
 * sizes and 380-odd literal hex colours that a Tailwind theme token cannot reach. `accessibility.css`
 * holds the matching selectors.
 */
export const useAccessibilityDocument = (toolbarHeight: number): void => {
  const isToolbarOpen = useAccessibilityStore((state) => state.isToolbarOpen);
  const fontScale = useAccessibilityStore((state) => state.fontScale);
  const contrastTheme = useAccessibilityStore((state) => state.contrastTheme);
  const isSpacingRelaxed = useAccessibilityStore((state) => state.isSpacingRelaxed);

  useEffect(() => {
    const root = document.documentElement;

    root.dataset.a11yTheme = contrastTheme;
    root.dataset.a11ySpacing = isSpacingRelaxed ? 'relaxed' : 'default';
    // Zoom is only switched on when it is actually needed; applying `zoom: 1` unconditionally
    // creates a containing block that shifts fixed-position panels for no benefit.
    root.dataset.a11yScaled = fontScale === 100 ? 'false' : 'true';
    root.style.setProperty('--a11y-font-scale', String(fontScale / 100));
  }, [contrastTheme, fontScale, isSpacingRelaxed]);

  useEffect(() => {
    const root = document.documentElement;

    root.dataset.a11yBar = isToolbarOpen ? 'open' : 'closed';
    root.style.setProperty('--a11y-bar-height', `${isToolbarOpen ? toolbarHeight : 0}px`);
  }, [isToolbarOpen, toolbarHeight]);
};
