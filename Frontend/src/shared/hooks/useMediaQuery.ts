import { useCallback, useSyncExternalStore } from 'react';

const matchQuery = (query: string): MediaQueryList | null =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query)
    : null;

/**
 * Whether a CSS media query matches, kept up to date as the window changes. Use it only when
 * something must not run at all at a size (such as a request); hiding alone belongs in CSS.
 * `fallback` is the answer where the browser cannot tell (no `matchMedia`, or server rendering).
 */
export function useMediaQuery(query: string, fallback: boolean): boolean {
  const subscribe = useCallback(
    (onChange: () => void): (() => void) => {
      const list = matchQuery(query);
      if (!list) return () => undefined;
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = (): boolean => matchQuery(query)?.matches ?? fallback;
  return useSyncExternalStore(subscribe, getSnapshot, () => fallback);
}
