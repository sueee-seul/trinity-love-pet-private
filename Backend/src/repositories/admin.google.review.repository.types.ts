import type { GoogleBusinessReviewRecord } from './review.repository.js';

export interface AdminGoogleBusinessReviewRecord extends GoogleBusinessReviewRecord {
  reviewer_email: string | null;
  manager_correction: unknown;
  is_read: boolean | null;
  current_status: string | null;
  assigned_employee_uuid: string | null;
}

export type AdminGoogleReviewRole = 'manager' | 'staff';

export interface AdminGoogleReviewActor {
  id: string;
  role: AdminGoogleReviewRole;
}

export type UpdateMockGoogleBusinessReviewReplyResult =
  | { outcome: 'updated'; review: AdminGoogleBusinessReviewRecord }
  | { outcome: 'not_found' | 'not_mock' | 'recipient_unavailable' };

export type UpdateGoogleReviewTriageResult =
  | {
      outcome: 'updated';
      review: AdminGoogleBusinessReviewRecord;
    }
  | { outcome: 'not_found' | 'invalid_data' };

export interface AssignGoogleReviewRecordsResult {
  updatedUuids: string[];
  missingUuids: string[];
  invalidAssignee: boolean;
  undecidedUuids?: string[];
}
