import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as inquiryApi from '../../api/inquiryApi';
import { useInquiryStore } from '../../store/inquiryStore';
import type { InquiryConversation } from '../../types/inquiry';
import { useInquiryListLiveUpdates } from '../useInquiryListLiveUpdates';

const { subscribeToInquiryCreatedEvents } = vi.hoisted(() => ({
  subscribeToInquiryCreatedEvents: vi.fn(),
}));

vi.mock('../../../../shared/events/conversationServerEvents', () => ({
  subscribeToInquiryCreatedEvents,
}));

vi.mock('../../api/inquiryApi', () => ({
  fetchInquiry: vi.fn(),
}));

const NEW_INQUIRY: InquiryConversation = {
  uuid: 'inq-new',
  parentName: 'New Parent',
  parentInitials: 'NP',
  petName: 'Rex',
  topic: 'General enquiry',
  topicCategory: 'General',
  startedAt: new Date().toISOString(),
  durationMinutes: 0,
  status: 'Active',
  supportStatus: 'AI Handling',
  supportRequestedAt: null,
  assignee: null,
  notes: '',
  aiSummary: '',
  aiDetectedTopic: '',
  aiEscalationReason: null,
  aiRelevantInfo: '',
  messages: [],
};

function resetStore(): void {
  useInquiryStore.setState({
    inquiryByUuid: {},
    inquiryUuids: [],
    staffDirectoryByUuid: new Map(),
    snapshotStatus: 'idle',
    snapshotError: null,
  });
}

beforeEach(() => {
  subscribeToInquiryCreatedEvents.mockReset().mockReturnValue(vi.fn());
  vi.mocked(inquiryApi.fetchInquiry).mockReset().mockResolvedValue(NEW_INQUIRY);
  resetStore();
});

describe('useInquiryListLiveUpdates', () => {
  it('does not subscribe until the initial snapshot is ready', () => {
    renderHook(() => useInquiryListLiveUpdates());
    expect(subscribeToInquiryCreatedEvents).not.toHaveBeenCalled();
  });

  it('adds the newly created inquiry to the store once subscribed', async () => {
    useInquiryStore.setState({ snapshotStatus: 'ready' });
    renderHook(() => useInquiryListLiveUpdates());

    const onCreated = subscribeToInquiryCreatedEvents.mock.calls[0][0] as (id: string) => void;
    onCreated('inq-new');

    await waitFor(() =>
      expect(useInquiryStore.getState().inquiryByUuid['inq-new']).toEqual(NEW_INQUIRY),
    );
    expect(inquiryApi.fetchInquiry).toHaveBeenCalledWith(
      'inq-new',
      useInquiryStore.getState().staffDirectoryByUuid,
    );
  });

  it('unsubscribes on unmount', () => {
    const unsubscribe = vi.fn();
    subscribeToInquiryCreatedEvents.mockReturnValue(unsubscribe);
    useInquiryStore.setState({ snapshotStatus: 'ready' });

    const { unmount } = renderHook(() => useInquiryListLiveUpdates());
    unmount();

    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('logs rather than throws if fetching the new inquiry fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(inquiryApi.fetchInquiry).mockRejectedValueOnce(new Error('network down'));
    useInquiryStore.setState({ snapshotStatus: 'ready' });
    renderHook(() => useInquiryListLiveUpdates());

    const onCreated = subscribeToInquiryCreatedEvents.mock.calls[0][0] as (id: string) => void;
    onCreated('inq-new');

    await waitFor(() => expect(consoleError).toHaveBeenCalled());
    expect(useInquiryStore.getState().inquiryByUuid['inq-new']).toBeUndefined();
    consoleError.mockRestore();
  });
});
