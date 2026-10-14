import { useEffect, useRef } from 'react';

/**
 * Sets the tab title while the page is shown, and hands it back on leaving. The /book page does
 * the same, so moving between the two never leaves a stale title behind. `<html lang>` is set
 * once for the whole app, by SiteLanguageProvider.
 */
export const useDocumentTitle = (title: string): void => {
  // Captured on the first render, before the effect writes.
  const originalTitle = useRef(document.title);

  useEffect(() => {
    document.title = title;
  }, [title]);

  useEffect(() => {
    const titleToRestore = originalTitle;
    return (): void => {
      document.title = titleToRestore.current;
    };
  }, []);
};
