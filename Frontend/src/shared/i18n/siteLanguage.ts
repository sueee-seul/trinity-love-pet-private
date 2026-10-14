import { createContext, useContext } from 'react';

/** The languages the site is written in. */
export type SiteLanguage = 'en' | 'zh';

/** A piece of copy in every language the site offers. */
export type SiteCopy<T> = Readonly<Record<SiteLanguage, T>>;

/**
 * The language the shared tools (accessibility bar, theme picker, notifications, photo viewer)
 * speak on the current page. The app provides it from the visitor's choice; staff pages are
 * English only. With no provider, as in a component test, it is English.
 */
export const SiteLanguageContext = createContext<SiteLanguage>('en');

export const useSiteLanguage = (): SiteLanguage => useContext(SiteLanguageContext);

/** Changes the visitor's language everywhere. With no provider it does nothing. */
export const SiteLanguageSwitchContext = createContext<(language: SiteLanguage) => void>(
  () => undefined,
);

export const useSwitchSiteLanguage = (): ((language: SiteLanguage) => void) =>
  useContext(SiteLanguageSwitchContext);

/** The copy for the current page's language. */
export const useSiteCopy = <T>(copy: SiteCopy<T>): T => copy[useSiteLanguage()];

/** The `lang` value for text written in `language`. */
export const siteLangAttribute = (language: SiteLanguage): string =>
  language === 'zh' ? 'zh-Hans' : 'en-NZ';
