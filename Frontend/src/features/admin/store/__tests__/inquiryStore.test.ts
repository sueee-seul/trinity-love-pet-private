import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMockInquiries } from '../../__tests__/inquiryFixtures';
import * as inquiryApi from '../../api/inquiryApi';
import { useInquiryStore } from '../inquiryStore';

vi.mock('../../api/inquiryApi', () => ({
  fetchInquiries: vi.fn(),
  fetchInquiry: vi.fn(),
  assignStaffOnServer: vi.fn().mockResolvedValue(undefined),
  resolveInquiryOnServer: vi.fn().mockResolvedValue(undefined),
  saveNotesOnServer: vi.fn().mockResolvedValue(undefined),
  sendStaffMessageOnServer: vi.fn().mockResolvedValue(undefined),
}));

const ME = { id: 'staff-me', name: 'Me' };

function resetStore(): void {
  useInquiryStore.setState({
    inquiryByUuid: {},
    inquiryUuids: [],
    snapshotStatus: 'idle',
    snapshotError: null,
    openConversationUuid: null,
    isPanelMinimized: false,
  });
}

function seedStore(): void {
  const inquiries = createMockInquiries(ME);
  useInquiryStore.getState().hydrateInquirySnapshot(inquiries, new Map());
}

beforeEach(() => {
  resetStore();
  seedStore();
});

const FIRST_UUID = 'inq-bella-care';

describe('hydrateInquirySnapshot', () => {
  it('populates inquiryByUuid and inquiryUuids and marks ready', () => {
    resetStore();
    const inquiries = createMockInquiries(ME);

    useInquiryStore.getState().hydrateInquirySnapshot(inquiries, new Map());

    const state = useInquiryStore.getState();
    expect(state.snapshotStatus).toBe('ready');
    expect(state.inquiryUuids).toHaveLength(inquiries.length);
    expect(state.inquiryByUuid[inquiries[0].uuid]).toEqual(inquiries[0]);
  });
});

describe('addInquiry', () => {
  it('prepends a new inquiry without disturbing existing ones', () => {
    const before = useInquiryStore.getState().inquiryByUuid[FIRST_UUID];
    const newInquiry = { ...before, uuid: 'inq-new' };

    useInquiryStore.getState().addInquiry(newInquiry);

    const state = useInquiryStore.getState();
    expect(state.inquiryUuids[0]).toBe('inq-new');
    expect(state.inquiryByUuid['inq-new']).toEqual(newInquiry);
    expect(state.inquiryByUuid[FIRST_UUID]).toBe(before);
  });

  it('does not duplicate or overwrite an inquiry that is already tracked', () => {
    const before = useInquiryStore.getState().inquiryByUuid[FIRST_UUID];
    const countBefore = useInquiryStore.getState().inquiryUuids.length;

    useInquiryStore.getState().addInquiry({ ...before, notes: 'a different copy' });

    const state = useInquiryStore.getState();
    expect(state.inquiryUuids.length).toBe(countBefore);
    expect(state.inquiryByUuid[FIRST_UUID]).toBe(before);
  });
});

describe('per-conversation mutations', () => {
  it('setAssignee updates only the targeted conversation', () => {
    const otherUuid = 'inq-luna-booking';
    const otherBefore = useInquiryStore.getState().inquiryByUuid[otherUuid];

    useInquiryStore.getState().setAssignee(FIRST_UUID, { id: 'staff-x', name: 'X' });

    expect(useInquiryStore.getState().inquiryByUuid[FIRST_UUID].assignee).toEqual({
      id: 'staff-x',
      name: 'X',
    });
    expect(useInquiryStore.getState().inquiryByUuid[otherUuid]).toBe(otherBefore);
  });

  it('setAssignee updates supportStatus immediately, without waiting for a refetch', () => {
    // Matches the backend's `assignStaff` repository behaviour exactly, so the
    // badge is correct right away instead of only after the next page load.
    useInquiryStore.getState().setAssignee(FIRST_UUID, { id: 'staff-x', name: 'X' });
    expect(useInquiryStore.getState().inquiryByUuid[FIRST_UUID].supportStatus).toBe(
      'Support Assigned',
    );

    useInquiryStore.getState().setAssignee(FIRST_UUID, null);
    expect(useInquiryStore.getState().inquiryByUuid[FIRST_UUID].supportStatus).toBe(
      'Support Requested',
    );
  });

  it('setSupportStatus updates only the targeted conversation', () => {
    useInquiryStore.getState().setSupportStatus(FIRST_UUID, 'Support Handling');
    expect(useInquiryStore.getState().inquiryByUuid[FIRST_UUID].supportStatus).toBe(
      'Support Handling',
    );
  });

  it('setNote updates only the targeted conversation', () => {
    useInquiryStore.getState().setNote(FIRST_UUID, 'A new note');
    expect(useInquiryStore.getState().inquiryByUuid[FIRST_UUID].notes).toBe('A new note');
  });

  it('appendReply trims and ignores whitespace-only replies', () => {
    const before = useInquiryStore.getState().inquiryByUuid[FIRST_UUID].messages.length;
    useInquiryStore.getState().appendReply(FIRST_UUID, '   ', 'John');
    expect(useInquiryStore.getState().inquiryByUuid[FIRST_UUID].messages.length).toBe(before);
  });

  it('appendReply appends a staff-role message with the given authorName', () => {
    useInquiryStore.getState().appendReply(FIRST_UUID, 'On it', 'John');
    const messages = useInquiryStore.getState().inquiryByUuid[FIRST_UUID].messages;
    const last = messages[messages.length - 1];
    expect(last).toMatchObject({ senderRole: 'staff', body: 'On it', authorName: 'John' });
  });
});

describe('closeConversation', () => {
  it('sets status Closed and forces supportStatus to Resolved regardless of the prior value', () => {
    useInquiryStore.getState().setSupportStatus(FIRST_UUID, 'Support Handling');

    useInquiryStore.getState().closeConversation(FIRST_UUID);

    const inquiry = useInquiryStore.getState().inquiryByUuid[FIRST_UUID];
    expect(inquiry.status).toBe('Closed');
    expect(inquiry.supportStatus).toBe('Resolved');
  });
});

describe('refreshInquiry', () => {
  it('replaces the targeted inquiry with a fresh server read, using the stored staff directory', async () => {
    const staffDirectoryByUuid = new Map([['staff-x', { name: 'X', role: 'staff' as const }]]);
    useInquiryStore.setState({ staffDirectoryByUuid });
    const fresh = {
      ...useInquiryStore.getState().inquiryByUuid[FIRST_UUID],
      notes: 'updated remotely',
    };
    vi.mocked(inquiryApi.fetchInquiry).mockResolvedValueOnce(fresh);

    await useInquiryStore.getState().refreshInquiry(FIRST_UUID);

    expect(inquiryApi.fetchInquiry).toHaveBeenCalledWith(FIRST_UUID, staffDirectoryByUuid);
    expect(useInquiryStore.getState().inquiryByUuid[FIRST_UUID].notes).toBe('updated remotely');
  });

  it('does nothing if the inquiry is no longer tracked locally by the time the fetch resolves', async () => {
    vi.mocked(inquiryApi.fetchInquiry).mockResolvedValueOnce(
      useInquiryStore.getState().inquiryByUuid[FIRST_UUID],
    );
    resetStore();

    await useInquiryStore.getState().refreshInquiry(FIRST_UUID);

    expect(useInquiryStore.getState().inquiryByUuid[FIRST_UUID]).toBeUndefined();
  });
});

describe('panel state', () => {
  it('openConversation sets the uuid and forces isPanelMinimized to false', () => {
    useInquiryStore.setState({ isPanelMinimized: true });

    useInquiryStore.getState().openConversation(FIRST_UUID);

    expect(useInquiryStore.getState().openConversationUuid).toBe(FIRST_UUID);
    expect(useInquiryStore.getState().isPanelMinimized).toBe(false);
  });

  it('closeConversationPanel clears both openConversationUuid and isPanelMinimized', () => {
    useInquiryStore.getState().openConversation(FIRST_UUID);
    useInquiryStore.getState().minimizePanel();

    useInquiryStore.getState().closeConversationPanel();

    expect(useInquiryStore.getState().openConversationUuid).toBeNull();
    expect(useInquiryStore.getState().isPanelMinimized).toBe(false);
  });

  it('minimizePanel and expandPanel toggle isPanelMinimized without touching openConversationUuid', () => {
    useInquiryStore.getState().openConversation(FIRST_UUID);

    useInquiryStore.getState().minimizePanel();
    expect(useInquiryStore.getState().isPanelMinimized).toBe(true);
    expect(useInquiryStore.getState().openConversationUuid).toBe(FIRST_UUID);

    useInquiryStore.getState().expandPanel();
    expect(useInquiryStore.getState().isPanelMinimized).toBe(false);
    expect(useInquiryStore.getState().openConversationUuid).toBe(FIRST_UUID);
  });
});
