import type { FeedbackProgressStep, FeedbackType } from '../contracts/feedback.contract.js';

export type AdminFeedbackListStatus = 'all' | 'unread' | 'read';
export type AdminFeedbackListSort = 'newest' | 'oldest' | 'highest' | 'lowest';
export type AdminFeedbackTimeRange = 'all' | 'last_7_days' | 'last_30_days' | 'custom';
export type AdminFeedbackRatingFilter = 'all' | 'low' | 'medium' | 'high';

export interface AdminFeedbackListQuery {
  search?: string;
  category?: FeedbackType;
  status: AdminFeedbackListStatus;
  sort: AdminFeedbackListSort;
  timeRange: AdminFeedbackTimeRange;
  rating: AdminFeedbackRatingFilter;
  ratingMin?: number;
  ratingMax?: number;
  dateFrom?: string;
  dateTo?: string;
}

export interface AdminFeedbackListRecord {
  uuid: string;
  parent_name: string;
  pet_name: string;
  created_at: Date;
  category: FeedbackType;
  is_read: boolean;
  current_status: FeedbackProgressStep | null;
  rating: number;
  ai_summary: string;
  assignee_uuid: string | null;
  suggestion_workflow?: {
    status: string;
    decision: string | null;
  } | null;
}

export interface EmployeeStaffOptionRecord {
  id: string;
  name: string;
}

export interface AdminFeedbackTimelineRecord {
  step: string;
  created_at: string;
  actor: string;
  event_payload: Record<string, unknown>;
}

export interface AdminFeedbackDetailRecord extends Omit<AdminFeedbackListRecord, 'ai_summary'> {
  rating_details: Record<string, number>;
  raw_answer: string | null;
  transcript: string | null;
  audio_url: string | null;
  ai_insights: {
    summary?: string;
    insights?: string[];
  } | null;
  timeline: AdminFeedbackTimelineRecord[];
}

export interface AdminFeedbackWorkflowRecord {
  category: FeedbackType;
  current_status: FeedbackProgressStep | null;
  timeline: AdminFeedbackTimelineRecord[];
}

export interface ReplyFeedbackRecordResult {
  repliedUuid: string | null;
}

export type WorkflowMutationResult =
  | { outcome: 'updated' }
  | { outcome: 'not_found' }
  | { outcome: 'invalid_category' }
  | { outcome: 'invalid_transition'; currentStatus: string | null };

export interface AssignFeedbackRecordsResult {
  updatedUuids: string[];
  missingUuids: string[];
  invalidAssignee: boolean;
}

export interface MarkFeedbackRecordsAsReadResult {
  updatedUuids: string[];
  missingUuids: string[];
}

export interface DeleteFeedbackRecordResult {
  deletedUuid: string | null;
}
