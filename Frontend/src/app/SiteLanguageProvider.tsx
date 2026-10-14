import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useConciergeLocale } from '../features/concierge';
import {
  SiteLanguageContext,
  SiteLanguageSwitchContext,
  siteLangAttribute,
  type SiteLanguage,
} from '../shared/i18n/siteLanguage';
import { isStaffPath } from '../shared/theme/themeDefaults';

interface SiteLanguageProviderProps {
  children: React.ReactNode;
}

/**
 * Hands the visitor's language to the shared tools and to `<html lang>`.
 *
 * The choice lives in the concierge store, which reads `?lang=` and the saved choice, so the
 * landing page, /book and the pet parent pages all follow one switch. Staff pages are English
 * only, so under /admin everything stays English whatever the visitor picked elsewhere.
 *
 * `<html lang>` is set here and nowhere else, because the speech reader and the browser read the
 * language there. One owner means no page can leave a stale value behind when it closes.
 */
export const SiteLanguageProvider: React.FC<SiteLanguageProviderProps> = ({ children }) => {
  const { pathname } = useLocation();
  const { locale, setLocale } = useConciergeLocale();
  const language: SiteLanguage = isStaffPath(pathname) ? 'en' : locale;

  useEffect(() => {
    document.documentElement.lang = siteLangAttribute(language);
  }, [language]);

  return (
    <SiteLanguageSwitchContext.Provider value={setLocale}>
      <SiteLanguageContext.Provider value={language}>{children}</SiteLanguageContext.Provider>
    </SiteLanguageSwitchContext.Provider>
  );
};
