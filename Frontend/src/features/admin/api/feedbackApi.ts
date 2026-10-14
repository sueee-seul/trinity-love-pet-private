import { API_BASE_URL } from '../../../shared/api';
import { FEEDBACK_TYPES } from '../../../shared/types/feedback';
import {
  isFeedbackProgressStep,
  isSuggestionDecision,
  isSuggestionWorkflowStatus,
  type AdminFeedback,
  type FeedbackListItem,
  type FeedbackProgressStep,
  type FeedbackRatingFilter,
  type FeedbackSortOption,
  type FeedbackStatusFilter,
  type FeedbackTimeFilter,
  type FeedbackTypeFilter,
  type SuggestionDecision,
  type SuggestionWorkflow,
  type SuggestionWorkflowStatus,
  type StaffOption,
} from '../types/feedback';

export interface FeedbackListQuery {
  search: string;
  status: FeedbackStatusFilter;
  category: FeedbackTypeFilter;
  sort: FeedbackSortOption;
  timeRange?: FeedbackTimeFilter;
  rating?: FeedbackRatingFilter;
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface MarkAsReadResponse {
  updatedUuids: string[];
}

export interface UpdateSuggestionWorkflowInput {
  status: SuggestionWorkflowStatus;
  decision?: SuggestionDecision;
  evidenceSummary?: string;
  decisionReason?: string;
  nextReviewAt?: string;
}

export class FeedbackApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'FeedbackApiError';
    this.status = status;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isFeedbackType = (value: unknown): boolean => {
  return typeof value === 'string' && FEEDBACK_TYPES.some((type) => type === value);
};

const isSuggestionWorkflowSummary = (value: unknown): boolean => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.status === 'string' &&
    isSuggestionWorkflowStatus(value.status) &&
    (value.decision === null ||
      (typeof value.decision === 'string' && isSuggestionDecision(value.decision)))
  );
};

const isSuggestionWorkflowEvent = (value: unknown): boolean => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.status === 'string' &&
    isSuggestionWorkflowStatus(value.status) &&
    typeof value.timestamp === 'string' &&
    typeof value.actor === 'string'
  );
};

const isSuggestionWorkflow = (value: unknown): value is SuggestionWorkflow => {
  if (!isRecord(value) || !isSuggestionWorkflowSummary(value)) {
    return false;
  }

  return (
    typeof value.ownerId === 'string' &&
    (value.evidenceSummary === null || typeof value.evidenceSummary === 'string') &&
    (value.decisionReason === null || typeof value.decisionReason === 'string') &&
    (value.nextReviewAt === null || typeof value.nextReviewAt === 'string') &&
    Array.isArray(value.events) &&
    value.events.every(isSuggestionWorkflowEvent)
  );
};

const isFeedbackListItem = (value: unknown): value is FeedbackListItem => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.uuid === 'string' &&
    typeof value.initials === 'string' &&
    typeof value.parentName === 'string' &&
    typeof value.petName === 'string' &&
    typeof value.date === 'string' &&
    typeof value.timestamp === 'number' &&
    typeof value.serviceType === 'string' &&
    typeof value.rating === 'number' &&
    typeof value.aiSummary === 'string' &&
    isFeedbackType(value.category) &&
    typeof value.is_read === 'boolean' &&
    (value.assigneeId === null || typeof value.assigneeId === 'string') &&
    typeof value.current_status === 'string' &&
    isFeedbackProgressStep(value.current_status) &&
    (value.suggestionWorkflow === undefined ||
      isSuggestionWorkflowSummary(value.suggestionWorkflow))
  );
};

const isFeedbackListResponse = (value: unknown): value is FeedbackListItem[] => {
  return Array.isArray(value) && value.every(isFeedbackListItem);
};

const isFeedbackDetailResponse = (value: unknown): value is AdminFeedback => {
  if (!isFeedbackListItem(value) || !isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.timeline) &&
    value.timeline.every(
      (event) =>
        isRecord(event) &&
        typeof event.step === 'string' &&
        isFeedbackProgressStep(event.step) &&
        typeof event.timestamp === 'string' &&
        typeof event.actor === 'string',
    ) &&
    (value.suggestionWorkflow === undefined || isSuggestionWorkflow(value.suggestionWorkflow))
  );
};

const isFeedbackSnapshotResponse = (value: unknown): value is AdminFeedback[] => {
  return Array.isArray(value) && value.every(isFeedbackDetailResponse);
};

const isStaffOptionsResponse = (value: unknown): value is StaffOption[] => {
  return (
    Array.isArray(value) &&
    value.every(
      (staff) => isRecord(staff) && typeof staff.id === 'string' && typeof staff.name === 'string',
    )
  );
};

const isUpdatedIdsResponse = (value: unknown): value is MarkAsReadResponse => {
  return (
    isRecord(value) &&
    Array.isArray(value.updatedUuids) &&
    value.updatedUuids.every((uuid) => typeof uuid === 'string')
  );
};

const requestJson = async (path: string, init?: RequestInit): Promise<unknown> => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
  });
  if (!response.ok) {
    throw new FeedbackApiError('Feedback request failed', response.status);
  }
  return response.json();
};

const sendJson = (body: unknown): RequestInit => ({
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const fetchFeedbackList = async (query: FeedbackListQuery): Promise<FeedbackListItem[]> => {
  const params = new URLSearchParams();
  const timeRange = query.timeRange ?? 'all';
  const rating = query.rating ?? 'all';
  const ratingMin = query.ratingMin ?? 1;
  const ratingMax = query.ratingMax ?? 5;
  if (query.search) params.set('search', query.search);
  if (query.category !== 'All') params.set('category', query.category);
  if (query.status !== 'all') params.set('status', query.status);
  params.set('sort', query.sort);
  if (timeRange !== 'all') params.set('timeRange', timeRange);
  if (rating !== 'all') params.set('rating', rating);
  if (ratingMin > 1 || ratingMax < 5) {
    params.set('ratingMin', ratingMin.toFixed(1));
    params.set('ratingMax', ratingMax.toFixed(1));
  }
  if (timeRange === 'custom') {
    if (query.dateFrom) params.set('dateFrom', query.dateFrom);
    if (query.dateTo) params.set('dateTo', query.dateTo);
  }

  const payload = await requestJson(`/admin/feedback?${params.toString()}`);
  if (!isFeedbackListResponse(payload)) {
    throw new Error('Invalid feedback list response');
  }
  return payload;
};

export const fetchFeedbackSnapshot = async (): Promise<AdminFeedback[]> => {
  const payload = await requestJson('/admin/feedback/snapshot');
  if (!isFeedbackSnapshotResponse(payload)) {
    throw new Error('Invalid feedback snapshot response');
  }
  return payload;
};

export const fetchStaffOptions = async (): Promise<StaffOption[]> => {
  const payload = await requestJson('/admin/feedback/assignees');
  if (!isStaffOptionsResponse(payload)) {
    throw new Error('Invalid staff options response');
  }
  return payload;
};

export const markFeedbacksAsRead = async (feedbackUuids: string[]): Promise<MarkAsReadResponse> => {
  const payload = await requestJson('/admin/feedback/read', sendJson({ feedbackUuids }));
  if (!isUpdatedIdsResponse(payload)) {
    throw new Error('Invalid mark-as-read response');
  }
  return payload;
};

export const deleteFeedback = async (feedbackUuid: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/admin/feedback/${feedbackUuid}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    throw new FeedbackApiError('Feedback deletion failed', response.status);
  }
};

export const fetchFeedbackDetail = async (uuid: string): Promise<AdminFeedback> => {
  const payload = await requestJson(`/admin/feedback/${uuid}`);
  if (!isFeedbackDetailResponse(payload)) {
    throw new Error('Invalid feedback detail response');
  }
  return payload;
};

export const updateFeedbackStatus = async (
  feedbackUuid: string,
  status: FeedbackProgressStep,
): Promise<AdminFeedback> => {
  const payload = await requestJson(`/admin/feedback/${feedbackUuid}/status`, sendJson({ status }));
  if (!isFeedbackDetailResponse(payload)) {
    throw new Error('Invalid feedback status response');
  }
  return payload;
};

export const updateSuggestionWorkflow = async (
  feedbackUuid: string,
  input: UpdateSuggestionWorkflowInput,
): Promise<AdminFeedback> => {
  const payload = await requestJson(`/admin/feedback/${feedbackUuid}/suggestion-workflow`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!isFeedbackDetailResponse(payload)) {
    throw new Error('Invalid suggestion workflow response');
  }
  return payload;
};

export const replyToFeedback = async (
  feedbackUuid: string,
  emailBody: string,
): Promise<AdminFeedback> => {
  const payload = await requestJson(`/admin/feedback/${feedbackUuid}/reply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailBody }),
  });
  if (!isFeedbackDetailResponse(payload)) {
    throw new Error('Invalid feedback reply response');
  }
  return payload;
};
