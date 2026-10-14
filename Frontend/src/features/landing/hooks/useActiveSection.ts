import { useEffect, useState } from 'react';

/**
 * The strip of the viewport a section has to cross to count as the one being read: from 20% to
 * 30% of the height, just under the sticky header. A section below it has not been reached yet, and
 * one above it has been scrolled past.
 */
const READING_STRIP = '-20% 0px -70% 0px';

/**
 * The id of the section being read, for the header's scroll-spy, or null when none of them is:
 * at the top of the page, or in a section the header does not link to.
 *
 * `sectionIds` must be in page order and keep its identity between renders (a module constant),
 * or the observer is rebuilt on every render. Without IntersectionObserver (old browsers, jsdom)
 * nothing is marked, which is the header as it was before the scroll-spy.
 */
export const useActiveSection = (sectionIds: readonly string[]): string | null => {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const inStrip = new Set<string>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) inStrip.add(entry.target.id);
          else inStrip.delete(entry.target.id);
        }
        setActiveId(sectionIds.find((id) => inStrip.has(id)) ?? null);
      },
      { rootMargin: READING_STRIP },
    );

    for (const id of sectionIds) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return (): void => observer.disconnect();
  }, [sectionIds]);

  return activeId;
};
