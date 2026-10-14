import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAccessibilityDocument } from '../hooks/useAccessibilityDocument';
import { useAccessibilityStore } from '../store/accessibilityStore';
import { AccessibilityLauncher } from './AccessibilityLauncher';
import { AccessibilityToolbar } from './AccessibilityToolbar';
import { ReadingRuler } from './ReadingRuler';

/**
 * Single mount point for the accessibility feature.
 *
 * Everything renders through a portal onto `document.body` so it sits outside `#root`. That
 * separation is what lets the text-size control zoom `#root` without also zooming the toolbar the
 * visitor is using to change it.
 */
export const AccessibilityWidget: React.FC = () => {
  const isLauncherEnabled = useAccessibilityStore((state) => state.isLauncherEnabled);
  const isToolbarOpen = useAccessibilityStore((state) => state.isToolbarOpen);
  const isRulerVisible = useAccessibilityStore((state) => state.isRulerVisible);
  const openToolbar = useAccessibilityStore((state) => state.openToolbar);
  const closeToolbar = useAccessibilityStore((state) => state.closeToolbar);

  const [toolbarHeight, setToolbarHeight] = useState(0);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);

  useAccessibilityDocument(toolbarHeight);

  /**
   * The bar wraps to two or three rows on narrow screens, so the page offset below it has to be
   * measured rather than assumed. Three triggers cover the ways that height can change, because no
   * single one is reliable on its own: a layout effect catches re-renders that change the buttons,
   * the resize listener catches viewport changes, and ResizeObserver catches reflows neither of
   * those sees (web fonts finishing, zoom changes). React bails out when the measured value is
   * unchanged, so the repeated calls settle immediately.
   */
  const measureToolbar = useCallback(() => {
    setToolbarHeight(toolbarRef.current?.offsetHeight ?? 0);
  }, []);

  useLayoutEffect(measureToolbar);

  useEffect(() => {
    window.addEventListener('resize', measureToolbar);
    return (): void => window.removeEventListener('resize', measureToolbar);
  }, [measureToolbar]);

  useEffect(() => {
    const element = toolbarRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const observer = new ResizeObserver(measureToolbar);
    observer.observe(element);

    return (): void => observer.disconnect();
  }, [isToolbarOpen, measureToolbar]);

  // The launcher is unmounted while the bar is open, so focus cannot be restored inside the close
  // handler: the button does not exist yet at that point. The flag defers it to the render after.
  const shouldRestoreLauncherFocusRef = useRef(false);

  const handleClose = useCallback(() => {
    shouldRestoreLauncherFocusRef.current = true;
    closeToolbar();
  }, [closeToolbar]);

  useEffect(() => {
    if (!isToolbarOpen && shouldRestoreLauncherFocusRef.current) {
      shouldRestoreLauncherFocusRef.current = false;
      launcherRef.current?.focus();
    }
  }, [isToolbarOpen]);

  if (!isLauncherEnabled || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <>
      {isToolbarOpen ? (
        <AccessibilityToolbar onClose={handleClose} toolbarRef={toolbarRef} />
      ) : (
        <AccessibilityLauncher onOpen={openToolbar} buttonRef={launcherRef} />
      )}
      {isRulerVisible && <ReadingRuler />}
    </>,
    document.body,
  );
};
