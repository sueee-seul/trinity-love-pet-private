import { API_BASE_URL } from '../api';

export const TASK_UPDATED_EVENT = 'task-updated';

export const buildLiveCareEventsUrl = (bookingPetId: string): string =>
  `${API_BASE_URL}/petparent/live-care/${encodeURIComponent(bookingPetId)}/stream`;

/**
 * Subscribes to the live "something changed" signal for one stay's tasks -
 * no task/photo content travels over this stream. A matching event (or a
 * reconnect) just asks the caller to re-fetch over the normal REST endpoint,
 * mirroring `subscribeToConversationServerEvents`.
 */
export const subscribeToLiveCareServerEvents = (
  url: string,
  onRefresh: () => void,
): (() => void) => {
  if (typeof window === 'undefined' || typeof window.EventSource !== 'function') {
    return (): void => undefined;
  }

  const eventSource = new window.EventSource(url, { withCredentials: true });
  let hasOpened = false;

  const handleOpen = (): void => {
    if (hasOpened) {
      onRefresh();
    }
    hasOpened = true;
  };

  const handleEvent = (): void => {
    onRefresh();
  };

  eventSource.addEventListener('open', handleOpen);
  eventSource.addEventListener(TASK_UPDATED_EVENT, handleEvent);

  return (): void => {
    eventSource.removeEventListener('open', handleOpen);
    eventSource.removeEventListener(TASK_UPDATED_EVENT, handleEvent);
    eventSource.close();
  };
};
