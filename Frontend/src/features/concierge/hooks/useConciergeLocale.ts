import { useConciergeStore } from '../store/conciergeStore';
import type { ConciergeLocale } from '../types';

/**
 * The site language, shared by every public page. It lives in the concierge store, which reads
 * `?lang=` and the guest's saved choice (`trinity-concierge-locale`) when it starts and saves every
 * change, so a guest who picks Chinese on the landing page is still in Chinese on /book.
 */
export interface SiteLocale {
  locale: ConciergeLocale;
  setLocale: (locale: ConciergeLocale) => void;
}

export const useConciergeLocale = (): SiteLocale => {
  const locale = useConciergeStore((state) => state.locale);
  const setLocale = useConciergeStore((state) => state.setLocale);
  return { locale, setLocale };
};
