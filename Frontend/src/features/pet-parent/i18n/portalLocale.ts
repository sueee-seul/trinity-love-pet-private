import { useConciergeLocale, type ConciergeLocale } from '../../concierge';
import { useConciergeStore } from '../../concierge/store/conciergeStore';
import { siteLangAttribute } from '../../../shared/i18n/siteLanguage';

/**
 * The pet parent portal speaks the same language the guest picked on the landing page or /book:
 * one site setting (see useConciergeLocale), so switching here switches there too.
 */
export type PortalLocale = ConciergeLocale;

/** A piece of portal copy in every language the site offers. */
export type PortalCopy<T> = Readonly<Record<PortalLocale, T>>;

/** The current site language. */
export const usePortalLocale = (): PortalLocale => useConciergeLocale().locale;

/** The site language outside React, for a request that tells the server how to answer. */
export const currentPortalLocale = (): PortalLocale => useConciergeStore.getState().locale;

/** The copy for the current site language. */
export const usePortalCopy = <T>(copy: PortalCopy<T>): T => copy[usePortalLocale()];

/** The `lang` value for text written in `locale`. */
export const portalLangAttribute = (locale: PortalLocale): string => siteLangAttribute(locale);
