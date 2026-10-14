import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  FEEDBACK_PROGRESS_STEPS,
  FEEDBACK_TYPES,
  SUGGESTION_DECISIONS,
  SUGGESTION_WORKFLOW_STATUSES,
} from '../contracts/feedback.contract.js';
import * as adminFeedbackReadService from '../services/admin.feedback.read.service.js';
import * as adminFeedbackWorkflowService from '../services/admin.feedback.workflow.service.js';

const FEEDBACK_SORT_OPTIONS = ['newest', 'oldest', 'highest', 'lowest'] as const;
const FEEDBACK_TIME_RANGES = ['all', 'last_7_days', 'last_30_days', 'custom'] as const;
const FEEDBACK_RATING_FILTERS = ['all', 'low', 'medium', 'high'] as const;

const getListSchema = z
  .object({
    search: z.string().trim().min(1).optional(),
    category: z.enum(FEEDBACK_TYPES).optional(),
    status: z.enum(['all', 'unread', 'read']).optional(),
    sort: z.enum(FEEDBACK_SORT_OPTIONS).optional(),
    timeRange: z.enum(FEEDBACK_TIME_RANGES).optional(),
    rating: z.enum(FEEDBACK_RATING_FILTERS).optional(),
    ratingMin: z.coerce.number().min(1).max(5).optional(),
    ratingMax: z.coerce.number().min(1).max(5).optional(),
    dateFrom: z.string().date().optional(),
    dateTo: z.string().date().optional(),
  })
  .superRefine((value, context) => {
    if ((value.ratingMin === undefined) !== (value.ratingMax === undefined)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ratingMin'],
        message: 'ratingMin and ratingMax must be provided together',
      });
    }
    if (
      value.ratingMin !== undefined &&
      value.ratingMax !== undefined &&
      value.ratingMin > value.ratingMax
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['ratingMax'],
        message: 'Must be greater than or equal to ratingMin',
      });
    }

    if (value.timeRange === 'custom') {
      if (!value.dateFrom) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['dateFrom'], message: 'Required' });
      }
      if (!value.dateTo) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['dateTo'], message: 'Required' });
      }
      if (value.dateFrom && value.dateTo && value.dateFrom > value.dateTo) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dateTo'],
          message: 'Must be on or after dateFrom',
        });
      }
    } else if (value.dateFrom || value.dateTo) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['timeRange'],
        message: 'Custom timeRange is required for dateFrom/dateTo',
      });
    }
  });

export const getFeedbackList = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const parsed = getListSchema.parse(req.query);
    const query: adminFeedbackReadService.GetFeedbackQuery = {};
    if (parsed.search !== undefined) query.search = parsed.search;
    if (parsed.category !== undefined) query.category = parsed.category;
    if (parsed.status !== undefined) query.status = parsed.status;
    if (parsed.sort !== undefined) query.sort = parsed.sort;
    if (parsed.timeRange !== undefined) query.timeRange = parsed.timeRange;
    if (parsed.rating !== undefined) query.rating = parsed.rating;
    if (parsed.ratingMin !== undefined) query.ratingMin = parsed.ratingMin;
    if (parsed.ratingMax !== undefined) query.ratingMax = parsed.ratingMax;
    if (parsed.dateFrom !== undefined) query.dateFrom = parsed.dateFrom;
    if (parsed.dateTo !== undefined) query.dateTo = parsed.dateTo;
    const data = await adminFeedbackReadService.getList(query);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const getFeedbackAssignees = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await adminFeedbackReadService.getAssignees();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const getFeedbackSnapshot = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = await adminFeedbackReadService.getSnapshot();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

const markAsReadSchema = z.object({
  feedbackUuids: z.array(z.string().uuid('Feedback UUID must be a valid UUID')).min(1),
});

const assignFeedbackSchema = z.object({
  feedbackUuids: z.array(z.string().uuid('Feedback UUID must be a valid UUID')).min(1),
  assigneeId: z.string().uuid('Assignee UUID must be a valid employee UUID'),
});

export const assignFeedbacks = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { feedbackUuids, assigneeId } = assignFeedbackSchema.parse(req.body);
    const data = await adminFeedbackReadService.assignFeedbacks(feedbackUuids, assigneeId);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const markFeedbacksAsRead = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { feedbackUuids } = markAsReadSchema.parse(req.body);
    const data = await adminFeedbackReadService.markAsRead(feedbackUuids);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

const feedbackUuidSchema = z.string().uuid('Feedback UUID must be a valid UUID');

export const getFeedbackDetail = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const uuid = feedbackUuidSchema.parse(req.params.id);
    const data = await adminFeedbackReadService.getDetail(uuid);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const deleteFeedback = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const uuid = feedbackUuidSchema.parse(req.params.id);
    await adminFeedbackWorkflowService.deleteFeedback(uuid);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

const updateStatusSchema = z.object({
  status: z.enum(FEEDBACK_PROGRESS_STEPS),
});

const updateSuggestionWorkflowSchema = z.object({
  status: z.enum(SUGGESTION_WORKFLOW_STATUSES),
  decision: z.enum(SUGGESTION_DECISIONS).optional(),
  evidenceSummary: z.string().optional(),
  decisionReason: z.string().optional(),
  nextReviewAt: z.string().optional(),
});

export const updateFeedbackStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const uuid = feedbackUuidSchema.parse(req.params.id);
    if (!req.user) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      return;
    }
    const { status } = updateStatusSchema.parse(req.body);
    const data = await adminFeedbackWorkflowService.updateStatus(uuid, status, req.user.id);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

export const updateSuggestionWorkflow = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const uuid = feedbackUuidSchema.parse(req.params.id);
    if (!req.user) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      return;
    }
    const input = updateSuggestionWorkflowSchema.parse(req.body);
    const data = await adminFeedbackWorkflowService.updateSuggestionWorkflow(uuid, {
      ...input,
      actorId: req.user.id,
    });
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

const replySchema = z.object({
  emailBody: z.string().min(1, 'Email body is required'),
});

export const replyToFeedback = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const uuid = feedbackUuidSchema.parse(req.params.id);
    if (!req.user) {
      res
        .status(401)
        .json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication required' } });
      return;
    }
    const { emailBody } = replySchema.parse(req.body);
    const data = await adminFeedbackWorkflowService.replyToFeedback(uuid, req.user.id, emailBody);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};
