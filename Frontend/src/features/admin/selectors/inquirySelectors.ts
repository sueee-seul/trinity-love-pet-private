import type {
  InquiryConversation,
  InquiryNotesFilter,
  InquirySort,
  InquirySupportStatusFilter,
  InquiryTab,
} from '../types/inquiry';
import { toInquiryCalendarDate } from '../utils/inquiryTime';

export interface InquiryListSelectorOptions {
  tab: InquiryTab;
  searchQuery: string;
  supportStatusFilter: InquirySupportStatusFilter;
  /** Calendar dates (YYYY-MM-DD) from the rail's date pickers; empty string = no bound. */
  dateFrom: string;
  dateTo: string;
  assigneeId: 'All' | 'Unassigned' | string;
  /** Dedicated pet-parent-name and topic filters, separate from the general `searchQuery` box. */
  parentNameQuery: string;
  topicQuery: string;
  /** Conversation duration bounds in minutes; `null` = no bound. */
  durationMin: number | null;
  durationMax: number | null;
  notesFilter: InquiryNotesFilter;
  sort: InquirySort;
}

const matchesDateRange = (
  inquiry: InquiryConversation,
  dateFrom: string,
  dateTo: string,
): boolean => {
  if (!dateFrom && !dateTo) return true;

  const startedAtDate = toInquiryCalendarDate(inquiry.startedAt);
  return (!dateFrom || startedAtDate >= dateFrom) && (!dateTo || startedAtDate <= dateTo);
};

const matchesNotesFilter = (
  inquiry: InquiryConversation,
  notesFilter: InquiryNotesFilter,
): boolean => {
  if (notesFilter === 'All') return true;
  const hasNotes = inquiry.notes.trim().length > 0;
  return notesFilter === 'With notes' ? hasNotes : !hasNotes;
};

const compareInquiries = (
  left: InquiryConversation,
  right: InquiryConversation,
  sort: InquirySort,
): number => {
  const rawDiff =
    sort.field === 'durationMinutes'
      ? left.durationMinutes - right.durationMinutes
      : new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime();

  return sort.direction === 'asc' ? rawDiff : -rawDiff;
};

export const selectInquiryList = (
  inquiries: InquiryConversation[],
  options: InquiryListSelectorOptions,
): InquiryConversation[] => {
  const searchTerm = options.searchQuery.trim().toLowerCase();
  const parentNameTerm = options.parentNameQuery.trim().toLowerCase();
  const topicTerm = options.topicQuery.trim().toLowerCase();

  return inquiries
    .filter((inquiry) => {
      const searchableText = [
        inquiry.parentName,
        inquiry.petName ?? '',
        inquiry.topic,
        inquiry.aiSummary,
      ]
        .join(' ')
        .toLowerCase();

      return (
        inquiry.status === options.tab &&
        (!searchTerm || searchableText.includes(searchTerm)) &&
        (!parentNameTerm || inquiry.parentName.toLowerCase().includes(parentNameTerm)) &&
        (!topicTerm || inquiry.topic.toLowerCase().includes(topicTerm)) &&
        (options.supportStatusFilter === 'All' ||
          inquiry.supportStatus === options.supportStatusFilter) &&
        (options.assigneeId === 'All' ||
          (options.assigneeId === 'Unassigned'
            ? !inquiry.assignee
            : inquiry.assignee?.id === options.assigneeId)) &&
        matchesDateRange(inquiry, options.dateFrom, options.dateTo) &&
        (options.durationMin === null || inquiry.durationMinutes >= options.durationMin) &&
        (options.durationMax === null || inquiry.durationMinutes <= options.durationMax) &&
        matchesNotesFilter(inquiry, options.notesFilter)
      );
    })
    .sort((left, right) => compareInquiries(left, right, options.sort));
};

export const selectInquiryCounts = (
  inquiries: InquiryConversation[],
): { active: number; closed: number } => ({
  active: inquiries.filter((inquiry) => inquiry.status === 'Active').length,
  closed: inquiries.filter((inquiry) => inquiry.status === 'Closed').length,
});
