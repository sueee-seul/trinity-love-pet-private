import type { NextFunction, Request, Response } from 'express';
import {
  adminGoogleReviewAssigneeSchema,
  adminGoogleReviewQuerySchema,
  adminGoogleReviewReplySchema,
  adminGoogleReviewTriageSchema,
} from '../contracts/google.review.admin.contract.js';
import {
  assignGoogleReviews,
  type AdminGoogleReviewActor,
  getAdminGoogleReviews,
  replyToGoogleReview,
  updateGoogleReviewTriage,
} from '../services/admin.google.review.service.js';
import { getAdminGoogleReviewDashboard as getDashboard } from '../services/admin.google.review.dashboard.service.js';
import { adminGoogleReviewDashboardQuerySchema } from '../contracts/google.review.dashboard.contract.js';
import { AppError } from '../common/middlewares/error.middleware.js';
import { z } from 'zod';

const googleReviewUuidSchema = z.string().uuid('Google review UUID must be a valid UUID');

/**
 * Validates the employee boundary and role for Google Review operations.
 *
 * @param req - The inbound HTTP request.
 * @returns The authenticated actor restricted to manager or staff roles.
 */
const getAdminGoogleReviewActor = (req: Request): AdminGoogleReviewActor => {
  const user = req.user;
  if (!user || (user.employee_role !== 'manager' && user.employee_role !== 'staff')) {
    throw new AppError('You do not have permission to access this resource', 'FORBIDDEN', 403);
  }

  return { id: user.id, role: user.employee_role };
};

/**
 * Assigns one or more Google reviews to a specific employee.
 *
 * @remarks
 * Uses a transactional boundary to update the assigned employee.
 * Does not interact with external Google APIs.
 */
export const assignGoogleReviewsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { reviewUuids, assigneeId } = adminGoogleReviewAssigneeSchema.parse(req.body);
    const data = await assignGoogleReviews(reviewUuids, assigneeId);
    res.status(200).json({ code: 200, msg: 'Google reviews assigned', data });
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Loads the list of Google reviews for a specific facility.
 *
 * @remarks
 * Restricts the query to a single Facility scope based on placeSlug to prevent cross-facility unauthorized reads.
 */
export const getAdminGoogleReviewList = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const parsed = adminGoogleReviewQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }

  try {
    const data = await getAdminGoogleReviews(parsed.data.placeSlug, getAdminGoogleReviewActor(req));
    res.status(200).json({ code: 200, msg: 'Google reviews loaded', data });
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Loads the dashboard metrics for Google reviews.
 *
 * @remarks
 * Applies role-based constraints to ensure metrics are scoped appropriately for the manager.
 */
export const getAdminGoogleReviewDashboard = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const parsed = adminGoogleReviewDashboardQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    next(parsed.error);
    return;
  }

  try {
    const data = await getDashboard(parsed.data);
    res.status(200).json({ code: 200, msg: 'Google review dashboard loaded', data });
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Processes a reply to a Google review.
 *
 * @remarks
 * Authorizes the action against the employee's allowed scope and records the operation.
 */
export const replyToGoogleReviewHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const reviewId = googleReviewUuidSchema.parse(req.params.id);
    const { replyBody } = adminGoogleReviewReplySchema.parse(req.body);
    const data = await replyToGoogleReview(reviewId, replyBody, getAdminGoogleReviewActor(req));
    res.status(200).json({ code: 200, msg: 'Google review reply saved', data });
  } catch (error: unknown) {
    next(error);
  }
};

/**
 * Updates the triage status of a Google review.
 *
 * @remarks
 * Validates the ID format and permissions before allowing the type update, ensuring data integrity.
 */
export const updateGoogleReviewTriageHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const reviewId = googleReviewUuidSchema.parse(req.params.id);
    const { triageType } = adminGoogleReviewTriageSchema.parse(req.body);
    const data = await updateGoogleReviewTriage(
      reviewId,
      triageType,
      getAdminGoogleReviewActor(req),
    );
    res.status(200).json({ code: 200, msg: 'Google review type updated', data });
  } catch (error: unknown) {
    next(error);
  }
};
