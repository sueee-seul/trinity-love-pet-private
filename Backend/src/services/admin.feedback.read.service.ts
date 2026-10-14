import {
  FEEDBACK_PROGRESS_STEPS,
  type AdminFeedback,
  type FeedbackProgressStep,
  type FeedbackRatings,
  type FeedbackType,
  type SuggestionWorkflow,
  type SuggestionWorkflowStatus,
} from '../contracts/feedback.contract.js';
import {
  isSuggestionDecision,
  isSuggestionWorkflowStatus,
  type SuggestionWorkflowSummary,
} from './suggestion.workflow.js';
import { AppError } from '../common/middlewares/error.middleware.js';
import { removeDashes } from '../common/utils/plain-punctuation.js';
import type { StaffOption } from '../contracts/staff.contract.js';
import {
  assignFeedbackRecords,
  getAdminFeedbackRecord,
  listEmployeeStaffOptions,
  listAdminFeedbackDetailRecords,
  listAdminFeedbackRecords,
  markFeedbackRecordsAsRead,
  type AdminFeedbackDetailRecord,
  type AdminFeedbackRatingFilter,
  type AdminFeedbackListQuery,
  type AdminFeedbackListSort,
  type AdminFeedbackTimeRange,
} from '../repositories/admin.feedback.repository.js';

export interface GetFeedbackQuery {
  search?: string;
  category?: FeedbackType;
  status?: 'all' | 'unread' | 'read';
  sort?: AdminFeedbackListSort;
  timeRange?: AdminFeedbackTimeRange;
  rating?: AdminFeedbackRatingFilter;
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface MarkAsReadResult {
  updatedUuids: string[];
}

export interface AssignFeedbackResult {
  updatedUuids: string[];
  assigneeId: string;
}

export type AdminFeedbackListItem = Omit<
  Pick<
    AdminFeedback,
    | 'uuid'
    | 'initials'
    | 'parentName'
    | 'petName'
    | 'date'
    | 'timestamp'
    | 'serviceType'
    | 'rating'
    | 'aiSummary'
    | 'category'
    | 'is_read'
    | 'assigneeId'
    | 'current_status'
    | 'suggestionWorkflow'
  >,
  'suggestionWorkflow'
> & {
  suggestionWorkflow?: SuggestionWorkflowSummary;
};

const AUCKLAND_TIME_ZONE = 'Pacific/Auckland';

interface ParentDisplayValues {
  parentName: string;
  initials: string;
}

const mapParentDisplayValues = (parentNameValue: string): ParentDisplayValues => {
  const parentName = parentNameValue.trim();
  const initials = parentName
    .split(/\s+/)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return { parentName, initials };
};

const formatFeedbackDate = (createdAt: Date): string =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: AUCKLAND_TIME_ZONE,
  }).format(createdAt);

const validateCurrentStatus = (
  persistedStatus: FeedbackProgressStep | null,
): FeedbackProgressStep => {
  const currentStatus = persistedStatus ?? 'submitted';
  if (!FEEDBACK_PROGRESS_STEPS.includes(currentStatus)) {
    throw new AppError(
      'Feedback contains an invalid progress state',
      'INVALID_FEEDBACK_STATE',
      500,
    );
  }
  return currentStatus;
};

export const getAssignees = async (): Promise<StaffOption[]> => {
  return listEmployeeStaffOptions();
};

export const markAsRead = async (feedbackUuids: string[]): Promise<MarkAsReadResult> => {
  const uniqueUuids = [...new Set(feedbackUuids)];
  try {
    const result = await markFeedbackRecordsAsRead(uniqueUuids);
    if (result.missingUuids.length > 0) {
      throw new AppError('Feedback not found', 'NOT_FOUND', 404);
    }
    return { updatedUuids: result.updatedUuids };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error(
      'Failed to update feedback read state',
      error instanceof Error ? error.message : 'Unknown database error',
    );
    throw new AppError(
      'Feedback read state could not be updated',
      'FEEDBACK_PERSISTENCE_UNAVAILABLE',
      503,
    );
  }
};

export const assignFeedbacks = async (
  feedbackUuids: string[],
  assigneeId: string,
): Promise<AssignFeedbackResult> => {
  try {
    const result = await assignFeedbackRecords(feedbackUuids, assigneeId);
    if (result.invalidAssignee) {
      throw new AppError('Assignee not found', 'INVALID_ASSIGNEE', 400);
    }
    if (result.missingUuids.length > 0) {
      throw new AppError('Feedback not found', 'NOT_FOUND', 404);
    }
    return { updatedUuids: result.updatedUuids, assigneeId };
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error(
      'Failed to assign feedbacks',
      error instanceof Error ? error.message : 'Unknown database error',
    );
    throw new AppError(
      'Feedback assignment could not be updated',
      'FEEDBACK_ASSIGNMENT_UNAVAILABLE',
      503,
    );
  }
};

export const getList = async (query: GetFeedbackQuery): Promise<AdminFeedbackListItem[]> => {
  const repositoryQuery: AdminFeedbackListQuery = {
    status: query.status ?? 'all',
    sort: query.sort ?? 'newest',
    timeRange: query.timeRange ?? 'all',
    rating: query.rating ?? 'all',
    ...(query.ratingMin !== undefined ? { ratingMin: query.ratingMin } : {}),
    ...(query.ratingMax !== undefined ? { ratingMax: query.ratingMax } : {}),
    ...(query.search ? { search: query.search } : {}),
    ...(query.category ? { category: query.category } : {}),
    ...(query.dateFrom ? { dateFrom: query.dateFrom } : {}),
    ...(query.dateTo ? { dateTo: query.dateTo } : {}),
  };

  try {
    const records = await listAdminFeedbackRecords(repositoryQuery);
    return records.map((record) => {
      const { parentName, initials } = mapParentDisplayValues(record.parent_name);
      const currentStatus = validateCurrentStatus(record.current_status);

      const suggestionWorkflow =
        record.category === 'Suggestion' &&
        record.suggestion_workflow &&
        isSuggestionWorkflowStatus(record.suggestion_workflow.status)
          ? {
              status: record.suggestion_workflow.status,
              decision:
                record.suggestion_workflow.decision === null ||
                isSuggestionDecision(record.suggestion_workflow.decision)
                  ? record.suggestion_workflow.decision
                  : null,
            }
          : undefined;

      if (
        record.category === 'Suggestion' &&
        record.suggestion_workflow &&
        !isSuggestionWorkflowStatus(record.suggestion_workflow.status)
      ) {
        throw new AppError(
          'Feedback contains an invalid Suggestion workflow state',
          'INVALID_FEEDBACK_STATE',
          500,
        );
      }

      return {
        uuid: record.uuid,
        initials,
        parentName,
        petName: record.pet_name,
        date: formatFeedbackDate(record.created_at),
        timestamp: record.created_at.getTime(),
        serviceType: '',
        rating: Number(record.rating),
        // Rows saved before feedback.service cleaned model text still carry its dashes.
        aiSummary: removeDashes(record.ai_summary),
        category: record.category,
        is_read: record.is_read,
        assigneeId: record.assignee_uuid ?? null,
        current_status: currentStatus,
        ...(suggestionWorkflow ? { suggestionWorkflow } : {}),
      };
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error(
      'Failed to load feedback list',
      error instanceof Error ? error.message : 'Unknown database error',
    );
    throw new AppError(
      'Feedback list is temporarily unavailable',
      'FEEDBACK_LIST_UNAVAILABLE',
      503,
    );
  }
};

export const getSnapshot = async (): Promise<AdminFeedback[]> => {
  try {
    const records = await listAdminFeedbackDetailRecords();
    return records.map(mapAdminFeedbackDetail);
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error(
      'Failed to load feedback snapshot',
      error instanceof Error ? error.message : 'Unknown database error',
    );
    throw new AppError(
      'Feedback snapshot is temporarily unavailable',
      'FEEDBACK_SNAPSHOT_UNAVAILABLE',
      503,
    );
  }
};

const RATING_KEYS: Array<keyof FeedbackRatings> = [
  'Professional',
  'Service',
  'Communication',
  'Safety',
  'Cost',
];

const mapRatingDetails = (ratingDetails: Record<string, number>): FeedbackRatings => {
  return RATING_KEYS.reduce<FeedbackRatings>(
    (result, key) => ({ ...result, [key]: Number(ratingDetails[key] ?? 0) }),
    {
      Professional: 0,
      Service: 0,
      Communication: 0,
      Safety: 0,
      Cost: 0,
    },
  );
};

const formatTimelineTimestamp = (createdAt: string): string => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: AUCKLAND_TIME_ZONE,
  }).format(new Date(createdAt));
};

const getPayloadString = (payload: Record<string, unknown>, key: string): string | null => {
  const value = payload[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
};

export const mapSuggestionWorkflowFromTimeline = (
  events: AdminFeedbackDetailRecord['timeline'],
): SuggestionWorkflow | undefined => {
  const suggestionEvents = events.filter((event) => isSuggestionWorkflowStatus(event.step));
  const latestEvent = suggestionEvents.at(-1);
  if (!latestEvent) {
    return undefined;
  }

  let ownerId = '';
  let decision: SuggestionWorkflow['decision'] = null;
  let evidenceSummary: string | null = null;
  let decisionReason: string | null = null;
  let nextReviewAt: string | null = null;

  for (const event of suggestionEvents) {
    const payload = event.event_payload ?? {};
    ownerId = getPayloadString(payload, 'ownerId') ?? ownerId;

    if (Object.prototype.hasOwnProperty.call(payload, 'decision')) {
      const payloadDecision = payload.decision;
      decision =
        typeof payloadDecision === 'string' && isSuggestionDecision(payloadDecision)
          ? payloadDecision
          : null;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'evidenceSummary')) {
      evidenceSummary = getPayloadString(payload, 'evidenceSummary');
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'decisionReason')) {
      decisionReason = getPayloadString(payload, 'decisionReason');
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'nextReviewAt')) {
      nextReviewAt = getPayloadString(payload, 'nextReviewAt');
    }
  }

  return {
    status: latestEvent.step as SuggestionWorkflowStatus,
    decision,
    ownerId,
    evidenceSummary,
    decisionReason,
    nextReviewAt,
    events: suggestionEvents.map((event) => ({
      status: event.step as SuggestionWorkflowStatus,
      timestamp: formatTimelineTimestamp(event.created_at),
      actor: event.actor,
    })),
  };
};

const mapAdminFeedbackDetail = (record: AdminFeedbackDetailRecord): AdminFeedback => {
  const { parentName, initials } = mapParentDisplayValues(record.parent_name);
  const currentStatus = validateCurrentStatus(record.current_status);

  const timeline = record.timeline
    .filter((event) => FEEDBACK_PROGRESS_STEPS.includes(event.step as FeedbackProgressStep))
    .map((event) => ({
      step: event.step as FeedbackProgressStep,
      timestamp: formatTimelineTimestamp(event.created_at),
      actor: event.actor,
    }));
  const suggestionWorkflow =
    record.category === 'Suggestion'
      ? mapSuggestionWorkflowFromTimeline(record.timeline)
      : undefined;
  const rawAnswer = record.raw_answer ?? '';
  const aiInsights = record.ai_insights ?? {};

  return {
    uuid: record.uuid,
    initials,
    parentName,
    petName: record.pet_name,
    date: formatFeedbackDate(record.created_at),
    timestamp: record.created_at.getTime(),
    serviceType: '',
    rating: Number(record.rating),
    // Rows saved before feedback.service cleaned model text still carry its dashes.
    aiSummary: removeDashes(aiInsights.summary ?? ''),
    category: record.category,
    is_read: record.is_read,
    assigneeId: record.assignee_uuid ?? null,
    current_status: currentStatus,
    ai_insights: (aiInsights.insights ?? []).map(removeDashes),
    detailedRatings: mapRatingDetails(record.rating_details),
    questions: rawAnswer ? ['Parent feedback'] : [],
    answers: rawAnswer ? [rawAnswer] : [],
    ...(record.transcript ? { transcript: record.transcript } : {}),
    ...(record.audio_url ? { audio_url: record.audio_url } : {}),
    walkId: '',
    timeline,
    ...(suggestionWorkflow ? { suggestionWorkflow } : {}),
  };
};

export const getDetail = async (uuid: string): Promise<AdminFeedback> => {
  try {
    const record = await getAdminFeedbackRecord(uuid);
    if (!record) {
      throw new AppError('Feedback not found', 'NOT_FOUND', 404);
    }

    const detail = mapAdminFeedbackDetail(record);
    if (!record.is_read) {
      const readResult = await markFeedbackRecordsAsRead([uuid]);
      if (readResult.missingUuids.length > 0) {
        throw new AppError('Feedback not found', 'NOT_FOUND', 404);
      }
      detail.is_read = true;
    }
    return detail;
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error(
      'Failed to load feedback detail',
      error instanceof Error ? error.message : 'Unknown database error',
    );
    throw new AppError(
      'Feedback detail is temporarily unavailable',
      'FEEDBACK_DETAIL_UNAVAILABLE',
      503,
    );
  }
};
