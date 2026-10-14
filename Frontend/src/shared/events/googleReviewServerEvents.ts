import { API_BASE_URL } from '../api';

export const GOOGLE_REVIEWS_SERVER_EVENT = 'google-reviews-updated';

/** Differentiates between the unauthenticated public stream and the employee-only admin stream. */
export type GoogleReviewEventScope = 'public' | 'admin';

/** Supported mutations that can trigger a client refresh. */
export type GoogleReviewChangeType =
  'created' | 'assigned' | 'replied' | 'triage_updated' | 'deleted';

/**
 * The validated Server-Sent Event payload that triggers a UI refresh.
 */
export interface GoogleReviewServerEvent {
  type: typeof GOOGLE_REVIEWS_SERVER_EVENT;
  placeSlug: string;
  changeType: GoogleReviewChangeType;
}

export interface GoogleReviewServerEventCallbacks<Payload = GoogleReviewServerEvent> {
  /** Preserves the existing refresh behavior for mutations and reconnects. */
  onRefresh?: () => void;
  /** Receives a validated, place-matched mutation event only. */
  onChange?: (event: Payload) => void;
  /** Receives reconnects after the initial stream open, never a mutation event. */
  onReconnect?: () => void;
}

const GOOGLE_REVIEW_EVENT_PATHS: Record<GoogleReviewEventScope, string> = {
  public: '/google-reviews/events',
  admin: '/admin/google-reviews/events',
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isChangeType = (value: unknown): value is GoogleReviewChangeType => {
  return (
    value === 'created' ||
    value === 'assigned' ||
    value === 'replied' ||
    value === 'triage_updated' ||
    value === 'deleted'
  );
};

const isGoogleReviewServerEvent = (value: unknown): value is GoogleReviewServerEvent => {
  return (
    isRecord(value) &&
    value.type === GOOGLE_REVIEWS_SERVER_EVENT &&
    typeof value.placeSlug === 'string' &&
    isChangeType(value.changeType)
  );
};

export const buildGoogleReviewEventsUrl = (
  scope: GoogleReviewEventScope,
  placeSlug: string,
): string => {
  return `${API_BASE_URL}${GOOGLE_REVIEW_EVENT_PATHS[scope]}?placeSlug=${encodeURIComponent(placeSlug)}`;
};

const parseEventData = (event: Event): unknown | null => {
  if (!('data' in event) || typeof event.data !== 'string') {
    return null;
  }

  try {
    return JSON.parse(event.data) as unknown;
  } catch {
    return null;
  }
};

const subscribeToGoogleReviewEventStream = <Payload>(
  url: string,
  eventType: string,
  isPayload: (value: unknown) => value is Payload,
  callbacks: GoogleReviewServerEventCallbacks<Payload>,
): (() => void) => {
  if (typeof window === 'undefined' || typeof window.EventSource !== 'function') {
    return (): void => undefined;
  }

  const eventSource = new window.EventSource(url, { withCredentials: true });
  let hasOpened = false;

  const handleOpen = (): void => {
    if (hasOpened) {
      callbacks.onReconnect?.();
      callbacks.onRefresh?.();
    }
    hasOpened = true;
  };

  const handleEvent = (event: Event): void => {
    const parsedPayload = parseEventData(event);
    if (parsedPayload !== null && isPayload(parsedPayload)) {
      callbacks.onChange?.(parsedPayload);
      callbacks.onRefresh?.();
    }
  };

  eventSource.addEventListener('open', handleOpen);
  eventSource.addEventListener(eventType, handleEvent);

  return (): void => {
    eventSource.removeEventListener('open', handleOpen);
    eventSource.removeEventListener(eventType, handleEvent);
    eventSource.close();
  };
};

/**
 * Subscribes to real-time Google Review updates via Server-Sent Events.
 *
 * @remarks
 * Uses `withCredentials: true` to support the employee admin scope.
 * The connection will trigger `onRefresh` immediately if it reconnects
 * after a disconnection. A valid review event payload must match the
 * expected shape and `placeSlug` to trigger a refresh.
 *
 * @param scope - Specifies which stream boundary to use.
 * @param placeSlug - The location identifier to listen for.
 * @param onRefresh - Callback invoked when a relevant mutation occurs or the connection recovers.
 * @returns A cleanup function that removes listeners and closes the connection.
 */
export const subscribeToGoogleReviewServerEvents = (
  scope: GoogleReviewEventScope,
  placeSlug: string,
  onRefreshOrCallbacks: (() => void) | GoogleReviewServerEventCallbacks,
): (() => void) => {
  const callbacks: GoogleReviewServerEventCallbacks =
    typeof onRefreshOrCallbacks === 'function'
      ? { onRefresh: onRefreshOrCallbacks }
      : onRefreshOrCallbacks;
  return subscribeToGoogleReviewEventStream(
    buildGoogleReviewEventsUrl(scope, placeSlug),
    GOOGLE_REVIEWS_SERVER_EVENT,
    (value): value is GoogleReviewServerEvent =>
      isGoogleReviewServerEvent(value) && value.placeSlug === placeSlug,
    callbacks,
  );
};
