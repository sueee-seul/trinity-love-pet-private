/**
 * What one page hands the sign-in pages through router state: the address the visitor already
 * typed, and the page to come back to. Both are read defensively, because `location.state` is
 * whatever the previous page put there, or nothing after a reload.
 */

/** The email a page already knows, so the visitor does not type it twice. */
export const emailFromRouteState = (state: unknown): string => {
  if (typeof state !== 'object' || state === null || !('email' in state)) return '';
  return typeof state.email === 'string' ? state.email : '';
};

/**
 * Where to go after signing in: a path on this site only (a leading slash, never a second one
 * that would form a different origin), so a crafted link can never send someone elsewhere.
 */
export const returnToFromRouteState = (state: unknown): string | null => {
  if (typeof state !== 'object' || state === null || !('returnTo' in state)) return null;
  const target = state.returnTo;
  if (typeof target !== 'string' || !target.startsWith('/') || target.startsWith('//')) {
    return null;
  }
  return target;
};
