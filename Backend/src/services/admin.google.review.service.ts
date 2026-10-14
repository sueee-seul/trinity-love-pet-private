import { AppError } from '../common/middlewares/error.middleware.js';
import { type GoogleReviewTriageType } from '../contracts/google.review.ai.contract.js';
import type {
  AdminGoogleReview,
  AdminGoogleReviewPage,
} from '../contracts/google.review.admin.contract.js';
import {
  assignGoogleReviewRecords,
  findAdminGoogleBusinessReviews,
  updateMockGoogleBusinessReviewReply,
  updateGoogleReviewTriage as updateGoogleReviewTriageRecord,
  type AdminGoogleReviewActor,
  type AdminGoogleBusinessReviewRecord,
} from '../repositories/admin.google.review.repository.js';
import { publishGoogleReviewEvent } from './google.review.events.js';
import { resolveReviewPhotoUrls } from './review.photo.storage.js';
import { managerCorrectionSchema } from '../contracts/google.review.manager.correction.contract.js';

const DEFAULT_GOOGLE_REVIEW_STATUS = 'received';
const PETHOUSE_REVIEW_PLACE_SLUG = 'PetHouse';

export type { AdminGoogleReviewActor } from '../repositories/admin.google.review.repository.js';

export interface AssignGoogleReviewsResult {
  updatedUuids: string[];
  assigneeId: string;
}

/**
 * Updates the triage status of a Google review.
 *
 * @remarks
 * Validates the ID format and permissions before allowing the type update, ensuring data integrity.
 */
export const updateGoogleReviewTriage = async (
  reviewId: string,
  triageType: GoogleReviewTriageType,
  actor: AdminGoogleReviewActor,
): Promise<AdminGoogleReview> => {
  if (actor.role !== 'manager') {
    throw new AppError('Only managers can correct Google review types', 'FORBIDDEN', 403);
  }

  try {
    const result = await updateGoogleReviewTriageRecord(reviewId, triageType, actor.id);
    if (result.outcome === 'not_found') {
      throw new AppError('Google review not found', 'GOOGLE_REVIEW_NOT_FOUND', 404);
    }
    if (result.outcome === 'invalid_data') {
      throw new AppError(
        'Google review is missing its feedback record',
        'INVALID_GOOGLE_REVIEW_DATA',
        409,
      );
    }

    if (result.outcome !== 'updated') {
      throw new AppError('Google review data is unavailable', 'INVALID_GOOGLE_REVIEW_DATA', 409);
    }

    publishGoogleReviewEvent({
      target: 'admin',
      placeSlug: PETHOUSE_REVIEW_PLACE_SLUG,
      changeType: 'triage_updated',
    });
    return await mapAdminGoogleReview(result.review);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error(
      'Failed to update Google review type',
      error instanceof Error ? error.message : 'Unknown database error',
    );
    throw new AppError(
      'Google review type could not be updated',
      'GOOGLE_REVIEW_TRIAGE_UNAVAILABLE',
      503,
    );
  }
};

const mapReviewerName = (
  reviewerIsAnonymous: boolean | null,
  reviewerName: string | null,
): string => {
  if (reviewerIsAnonymous === true) {
    return 'Anonymous reviewer';
  }

  return reviewerName ?? 'Google reviewer';
};

const mapAdminGoogleReview = async (
  review: AdminGoogleBusinessReviewRecord,
): Promise<AdminGoogleReview> => {
  const correction = managerCorrectionSchema.safeParse(review.manager_correction);
  const triageType =
    correction.success && correction.data.reviewUuid === review.id
      ? correction.data.correctedType
      : null;

  return {
    id: review.id,
    reviewerName: mapReviewerName(review.reviewer_is_anonymous, review.reviewer_display_name),
    reviewerEmail: review.reviewer_email,
    reviewerAvatarUrl:
      review.reviewer_is_anonymous === true ? null : review.reviewer_profile_photo_url,
    reviewerIsAnonymous: review.reviewer_is_anonymous,
    rating: review.rating,
    reviewText: review.comment,
    photoUrls: await resolveReviewPhotoUrls(review.photo_urls ?? []),
    createdAt: review.google_created_at.toISOString(),
    updatedAt: review.google_updated_at.toISOString(),
    ownerReply: review.owner_reply,
    ownerReplyUpdatedAt: review.owner_reply_updated_at?.toISOString() ?? null,
    triageType,
    isRead: review.is_read ?? false,
    currentStatus: review.current_status ?? DEFAULT_GOOGLE_REVIEW_STATUS,
    assignedEmployeeUuid: review.assigned_employee_uuid ?? null,
  };
};

/**
 * Assigns one or more Google reviews to a specific employee.
 *
 * @remarks
 * Uses a transactional boundary to update the assigned employee.
 */
export const assignGoogleReviews = async (
  reviewUuids: string[],
  assigneeId: string,
): Promise<AssignGoogleReviewsResult> => {
  const uniqueUuids = [...new Set(reviewUuids)];

  try {
    const result = await assignGoogleReviewRecords(uniqueUuids, assigneeId);
    if (result.invalidAssignee) {
      throw new AppError('Assignee not found', 'INVALID_ASSIGNEE', 400);
    }
    if (result.missingUuids.length > 0) {
      throw new AppError('Google review not found', 'GOOGLE_REVIEW_NOT_FOUND', 404);
    }
    if ((result.undecidedUuids?.length ?? 0) > 0) {
      throw new AppError(
        'A valid Google review type is required before assignment',
        'GOOGLE_REVIEW_TRIAGE_REQUIRED',
        409,
      );
    }

    publishGoogleReviewEvent({
      target: 'admin',
      placeSlug: PETHOUSE_REVIEW_PLACE_SLUG,
      changeType: 'assigned',
    });
    return { updatedUuids: result.updatedUuids, assigneeId };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error(
      'Failed to assign Google reviews',
      error instanceof Error ? error.message : 'Unknown database error',
    );
    throw new AppError(
      'Google review assignment could not be updated',
      'GOOGLE_REVIEW_ASSIGNMENT_UNAVAILABLE',
      503,
    );
  }
};

/**
 * Loads the list of Google reviews for a specific facility.
 *
 * @remarks
 * Restricts the query to a single Facility scope based on placeSlug to prevent cross-facility unauthorized reads.
 */
export const getAdminGoogleReviews = async (
  placeSlug: string,
  actor: AdminGoogleReviewActor,
): Promise<AdminGoogleReviewPage> => {
  try {
    const reviews = await findAdminGoogleBusinessReviews(placeSlug, actor);
    if (!reviews) {
      throw new AppError('Review location not found', 'GOOGLE_REVIEW_LOCATION_NOT_FOUND', 404);
    }

    return { reviews: await Promise.all(reviews.map(mapAdminGoogleReview)) };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error(
      'Failed to load admin Google reviews',
      error instanceof Error ? error.message : 'Unknown database error',
    );
    throw new AppError(
      'Google reviews are temporarily unavailable',
      'GOOGLE_REVIEWS_UNAVAILABLE',
      503,
    );
  }
};

/**
 * Processes a reply to a Google review.
 *
 * @remarks
 * Authorizes the action against the employee's allowed scope and records the operation.
 */
export const replyToGoogleReview = async (
  reviewId: string,
  replyBody: string,
  actor: AdminGoogleReviewActor,
): Promise<AdminGoogleReview> => {
  try {
    const result = await updateMockGoogleBusinessReviewReply(reviewId, replyBody, actor);
    if (result.outcome !== 'updated') {
      if (result.outcome === 'not_found') {
        throw new AppError('Google review not found', 'GOOGLE_REVIEW_NOT_FOUND', 404);
      }
      if (result.outcome === 'not_mock') {
        throw new AppError(
          'Replies are only supported for mock Google reviews',
          'GOOGLE_REVIEW_REPLY_NOT_SUPPORTED',
          409,
        );
      }
      throw new AppError(
        'The Google reviewer email is unavailable',
        'GOOGLE_REVIEW_RECIPIENT_UNAVAILABLE',
        422,
      );
    }

    publishGoogleReviewEvent({
      target: 'both',
      placeSlug: PETHOUSE_REVIEW_PLACE_SLUG,
      changeType: 'replied',
    });
    return await mapAdminGoogleReview(result.review);
  } catch (error: unknown) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error(
      'Failed to persist Google review reply',
      error instanceof Error ? error.message : 'Unknown database error',
    );
    throw new AppError(
      'Google review reply could not be saved',
      'GOOGLE_REVIEW_REPLY_UNAVAILABLE',
      503,
    );
  }
};
