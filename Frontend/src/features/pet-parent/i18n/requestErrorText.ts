import { ApiError } from '../api/apiError';
import type { PortalLocale } from './portalLocale';

/** The `error.code` the server put on a refused request, such as `BOOKING_STARTED`. */
export const errorCodeOf = (error: unknown): string | null => {
  if (!(error instanceof ApiError) || typeof error.body !== 'object' || error.body === null) {
    return null;
  }
  const code = (error.body as { error?: { code?: unknown } }).error?.code;
  return typeof code === 'string' ? code : null;
};

/**
 * An error carrying the server's own words. Every API client here throws one with the response
 * status; a network failure or a bug throws a plain error, whose message is not for parents.
 */
const isServerRefusal = (error: unknown): error is Error & { status: number } =>
  error instanceof Error &&
  typeof (error as { status?: unknown }).status === 'number' &&
  error.message.length > 0;

/**
 * What to tell a parent when a request fails, in the site language.
 *
 * The server writes its refusals in English for parents, so English shows them as sent. Chinese
 * cannot, so a refusal the page knows by its code gets the page's own words (`wordsByCode`), and
 * anything else gets the page's general message (`fallback`). Codes, not messages, are matched:
 * the same code can mean different things on different pages, which is why each page brings its
 * own words.
 */
export const requestErrorText = (
  error: unknown,
  locale: PortalLocale,
  fallback: string,
  wordsByCode: Readonly<Partial<Record<string, string>>> = {},
): string => {
  const code = errorCodeOf(error);
  const known = code === null ? undefined : wordsByCode[code];
  if (known !== undefined) return known;
  if (locale === 'en' && isServerRefusal(error)) return error.message;
  return fallback;
};
