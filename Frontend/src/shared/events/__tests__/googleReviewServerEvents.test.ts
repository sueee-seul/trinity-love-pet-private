// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeEventSource } from './fakeEventSource';
import {
  buildGoogleReviewEventsUrl,
  subscribeToGoogleReviewServerEvents,
} from '../googleReviewServerEvents';

const matchingEvent = {
  type: 'google-reviews-updated',
  placeSlug: 'Pet House / NZ',
  changeType: 'replied',
} as const;

describe('googleReviewServerEvents', () => {
  beforeEach(() => {
    FakeEventSource.reset();
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    ['public', '/api/google-reviews/events?placeSlug=Pet%20House%20%2F%20NZ'],
    ['admin', '/api/admin/google-reviews/events?placeSlug=Pet%20House%20%2F%20NZ'],
  ] as const)('builds the %s stream URL', (scope, path) => {
    expect(buildGoogleReviewEventsUrl(scope, 'Pet House / NZ')).toBe(
      `http://localhost:3000${path}`,
    );
  });

  it('opens a credentialed stream and refreshes only for valid matching events', () => {
    const onRefresh = vi.fn();
    subscribeToGoogleReviewServerEvents('public', matchingEvent.placeSlug, onRefresh);

    const eventSource = FakeEventSource.instances[0];
    expect(eventSource?.withCredentials).toBe(true);

    eventSource?.emitUpdate(matchingEvent);
    eventSource?.emitUpdate({ ...matchingEvent, placeSlug: 'Other Place' });
    eventSource?.emitUpdate({ ...matchingEvent, changeType: 'triage_updated' });
    eventSource?.emitUpdate({ ...matchingEvent, changeType: 'unknown' });
    eventSource?.emitRaw('{malformed');

    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it('refreshes after a reconnect but not after the first open', () => {
    const onRefresh = vi.fn();
    subscribeToGoogleReviewServerEvents('admin', 'PetHouse', onRefresh);
    const eventSource = FakeEventSource.instances[0];

    eventSource?.emitOpen();
    expect(onRefresh).not.toHaveBeenCalled();

    eventSource?.emitOpen();
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('exposes validated changes separately from reconnects', () => {
    const onRefresh = vi.fn();
    const onChange = vi.fn();
    const onReconnect = vi.fn();
    subscribeToGoogleReviewServerEvents('admin', 'PetHouse', {
      onRefresh,
      onChange,
      onReconnect,
    });
    const eventSource = FakeEventSource.instances[0];

    eventSource?.emitOpen();
    eventSource?.emitUpdate({
      ...matchingEvent,
      placeSlug: 'PetHouse',
      changeType: 'triage_updated',
    });
    eventSource?.emitUpdate({
      ...matchingEvent,
      placeSlug: 'PetHouse',
      changeType: 'not-a-change',
    });
    eventSource?.emitOpen();

    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith({
      type: 'google-reviews-updated',
      placeSlug: 'PetHouse',
      changeType: 'triage_updated',
    });
    expect(onReconnect).toHaveBeenCalledOnce();
    expect(onRefresh).toHaveBeenCalledTimes(2);
  });

  it('removes listeners and closes the stream on unsubscribe', () => {
    const onRefresh = vi.fn();
    const unsubscribe = subscribeToGoogleReviewServerEvents('public', 'PetHouse', onRefresh);
    const eventSource = FakeEventSource.instances[0];

    unsubscribe();
    eventSource?.emitUpdate({
      type: 'google-reviews-updated',
      placeSlug: 'PetHouse',
      changeType: 'created',
    });

    expect(eventSource?.closed).toBe(true);
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
