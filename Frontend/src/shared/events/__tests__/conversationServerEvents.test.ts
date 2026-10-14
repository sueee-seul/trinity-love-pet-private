// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeEventSource } from './fakeEventSource';
import {
  INQUIRY_CREATED_EVENT,
  buildAdminInquiryListEventsUrl,
  subscribeToInquiryCreatedEvents,
} from '../conversationServerEvents';

describe('subscribeToInquiryCreatedEvents', () => {
  beforeEach(() => {
    FakeEventSource.reset();
    vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens a credentialed stream at the admin inquiries list URL', () => {
    subscribeToInquiryCreatedEvents(vi.fn());

    const eventSource = FakeEventSource.instances[0];
    expect(eventSource?.url).toBe(buildAdminInquiryListEventsUrl());
    expect(eventSource?.withCredentials).toBe(true);
  });

  it('calls back with the conversation id for a valid event', () => {
    const onCreated = vi.fn();
    subscribeToInquiryCreatedEvents(onCreated);

    FakeEventSource.instances[0]?.emit(INQUIRY_CREATED_EVENT, {
      type: INQUIRY_CREATED_EVENT,
      conversationId: 'conv-1',
    });

    expect(onCreated).toHaveBeenCalledWith('conv-1');
  });

  it('ignores mistyped or incomplete payloads', () => {
    const onCreated = vi.fn();
    subscribeToInquiryCreatedEvents(onCreated);
    const eventSource = FakeEventSource.instances[0];

    eventSource?.emit(INQUIRY_CREATED_EVENT, { type: 'something-else', conversationId: 'conv-1' });
    eventSource?.emit(INQUIRY_CREATED_EVENT, { type: INQUIRY_CREATED_EVENT });

    expect(onCreated).not.toHaveBeenCalled();
  });

  it('the returned cleanup closes the stream and stops delivering events', () => {
    const onCreated = vi.fn();
    const unsubscribe = subscribeToInquiryCreatedEvents(onCreated);
    const eventSource = FakeEventSource.instances[0];

    unsubscribe();
    eventSource?.emit(INQUIRY_CREATED_EVENT, {
      type: INQUIRY_CREATED_EVENT,
      conversationId: 'conv-1',
    });

    expect(eventSource?.closed).toBe(true);
    expect(onCreated).not.toHaveBeenCalled();
  });
});
