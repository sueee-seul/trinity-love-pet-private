import { create } from 'zustand';
import {
  assignStaffOnServer,
  fetchInquiry,
  resolveInquiryOnServer,
  saveNotesOnServer,
  sendStaffMessageOnServer,
  type StaffDirectoryEntry,
} from '../api/inquiryApi';
import type { InquiryAssignee, InquiryConversation, SupportStatus } from '../types/inquiry';
import type { StaffRole } from '../types/staff';

export type InquirySnapshotStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface InquiryStoreState {
  inquiryByUuid: Record<string, InquiryConversation>;
  inquiryUuids: string[];
  /** Kept for `refreshInquiry`, which resolves assignee/author names and roles on its own, independent of whichever component last called `hydrateInquirySnapshot`. */
  staffDirectoryByUuid: Map<string, StaffDirectoryEntry>;
  snapshotStatus: InquirySnapshotStatus;
  snapshotError: string | null;
  /** The conversation shown in the floating detail panel - persists across admin page navigation. */
  openConversationUuid: string | null;
  isPanelMinimized: boolean;
  setSnapshotLoading: () => void;
  hydrateInquirySnapshot: (
    inquiries: InquiryConversation[],
    staffDirectoryByUuid: Map<string, StaffDirectoryEntry>,
  ) => void;
  setSnapshotError: (message: string) => void;
  addInquiry: (inquiry: InquiryConversation) => void;
  setAssignee: (uuid: string, assignee: InquiryAssignee | null) => void;
  setSupportStatus: (uuid: string, supportStatus: SupportStatus) => void;
  setNote: (uuid: string, notes: string) => void;
  appendReply: (uuid: string, body: string, authorName: string, authorRole?: StaffRole) => void;
  closeConversation: (uuid: string) => void;
  refreshInquiry: (uuid: string) => Promise<void>;
  resetInquirySnapshot: () => void;
  openConversation: (uuid: string) => void;
  closeConversationPanel: () => void;
  minimizePanel: () => void;
  expandPanel: () => void;
}

export const useInquiryStore = create<InquiryStoreState>((set, get) => ({
  inquiryByUuid: {},
  inquiryUuids: [],
  staffDirectoryByUuid: new Map(),
  snapshotStatus: 'idle',
  snapshotError: null,
  openConversationUuid: null,
  isPanelMinimized: false,

  setSnapshotLoading: (): void => {
    set({ snapshotStatus: 'loading', snapshotError: null });
  },
  hydrateInquirySnapshot: (inquiries, staffDirectoryByUuid): void => {
    set({
      inquiryByUuid: Object.fromEntries(inquiries.map((inquiry) => [inquiry.uuid, inquiry])),
      inquiryUuids: inquiries.map((inquiry) => inquiry.uuid),
      staffDirectoryByUuid,
      snapshotStatus: 'ready',
      snapshotError: null,
    });
  },
  setSnapshotError: (message): void => {
    set({ snapshotStatus: 'error', snapshotError: message });
  },
  addInquiry: (inquiry): void => {
    set((state) => {
      // A stray duplicate signal (e.g. two admins' streams racing) shouldn't
      // clobber whatever's already there, including any local edits made
      // since the snapshot this new fetch didn't know about.
      if (state.inquiryByUuid[inquiry.uuid]) {
        return state;
      }
      return {
        inquiryByUuid: { ...state.inquiryByUuid, [inquiry.uuid]: inquiry },
        inquiryUuids: [inquiry.uuid, ...state.inquiryUuids],
      };
    });
  },
  setAssignee: (uuid, assignee): void => {
    set((state) => {
      const inquiry = state.inquiryByUuid[uuid];
      if (!inquiry) return state;
      // Mirrors what `assignStaff` in the backend repository does unconditionally,
      // so the badge updates immediately instead of waiting for the next fetch.
      const supportStatus: SupportStatus = assignee ? 'Support Assigned' : 'Support Requested';
      return {
        inquiryByUuid: { ...state.inquiryByUuid, [uuid]: { ...inquiry, assignee, supportStatus } },
      };
    });
    assignStaffOnServer(uuid, assignee?.id ?? null).catch((error: unknown) =>
      console.error('Failed to persist the assignee change', error),
    );
  },
  setSupportStatus: (uuid, supportStatus): void => {
    set((state) => {
      const inquiry = state.inquiryByUuid[uuid];
      if (!inquiry) return state;
      return {
        inquiryByUuid: { ...state.inquiryByUuid, [uuid]: { ...inquiry, supportStatus } },
      };
    });
  },
  setNote: (uuid, notes): void => {
    set((state) => {
      const inquiry = state.inquiryByUuid[uuid];
      if (!inquiry) return state;
      return {
        inquiryByUuid: { ...state.inquiryByUuid, [uuid]: { ...inquiry, notes } },
      };
    });
    saveNotesOnServer(uuid, notes).catch((error: unknown) =>
      console.error('Failed to persist the employee notes', error),
    );
  },
  appendReply: (uuid, body, authorName, authorRole): void => {
    const trimmed = body.trim();
    if (!trimmed) return;
    set((state) => {
      const inquiry = state.inquiryByUuid[uuid];
      if (!inquiry) return state;
      const message = {
        id: `msg-${Date.now()}`,
        senderRole: 'staff' as const,
        body: trimmed,
        timestamp: new Date().toISOString(),
        authorName,
        ...(authorRole ? { authorRole } : {}),
      };
      // The first staff reply moves the conversation from merely "assigned" to
      // actively being handled - unless it's already wrapped up.
      const isFirstStaffMessage = !inquiry.messages.some(
        (existing) => existing.senderRole === 'staff',
      );
      const supportStatus =
        isFirstStaffMessage && inquiry.supportStatus !== 'Resolved'
          ? 'Support Handling'
          : inquiry.supportStatus;
      return {
        inquiryByUuid: {
          ...state.inquiryByUuid,
          [uuid]: { ...inquiry, messages: [...inquiry.messages, message], supportStatus },
        },
      };
    });
    sendStaffMessageOnServer(uuid, trimmed).catch((error: unknown) =>
      console.error('Failed to persist the staff reply', error),
    );
  },
  closeConversation: (uuid): void => {
    set((state) => {
      const inquiry = state.inquiryByUuid[uuid];
      if (!inquiry) return state;
      return {
        inquiryByUuid: {
          ...state.inquiryByUuid,
          [uuid]: { ...inquiry, status: 'Closed', supportStatus: 'Resolved' },
        },
      };
    });
    // Recorded as `resolved`, distinct from the pet owner's own `ended`.
    resolveInquiryOnServer(uuid).catch((error: unknown) =>
      console.error('Failed to persist the conversation resolution', error),
    );
  },
  refreshInquiry: async (uuid): Promise<void> => {
    try {
      const fresh = await fetchInquiry(uuid, get().staffDirectoryByUuid);
      set((state) => {
        if (!state.inquiryByUuid[uuid]) {
          return state;
        }
        return { inquiryByUuid: { ...state.inquiryByUuid, [uuid]: fresh } };
      });
    } catch (error) {
      console.error('Failed to refresh the inquiry', error);
    }
  },
  resetInquirySnapshot: (): void => {
    set({ inquiryByUuid: {}, inquiryUuids: [], snapshotStatus: 'idle', snapshotError: null });
  },
  openConversation: (uuid): void => {
    set({ openConversationUuid: uuid, isPanelMinimized: false });
  },
  closeConversationPanel: (): void => {
    set({ openConversationUuid: null, isPanelMinimized: false });
  },
  minimizePanel: (): void => {
    set({ isPanelMinimized: true });
  },
  expandPanel: (): void => {
    set({ isPanelMinimized: false });
  },
}));
