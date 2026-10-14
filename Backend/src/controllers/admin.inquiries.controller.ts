import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../common/middlewares/error.middleware.js';
import * as adminInquiryService from '../services/admin.inquiry.service.js';
import {
  streamConversationEvents,
  streamInquiryCreatedEvents,
} from '../services/conversation.events.js';

const requireUser = (req: Request): NonNullable<Request['user']> => {
  if (!req.user) {
    throw new AppError('Authentication required', 'UNAUTHENTICATED', 401);
  }
  return req.user;
};

export const listInquiries = async (
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const inquiries = await adminInquiryService.listInquiriesForStaff();
    res.status(200).json({ inquiries });
  } catch (error) {
    next(error);
  }
};

export const getInquiry = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const conversationId = z.string().min(1).parse(req.params.conversationId);
    const inquiry = await adminInquiryService.getInquiry(conversationId);
    res.status(200).json({ inquiry });
  } catch (error) {
    next(error);
  }
};

export const streamInquiry = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const conversationId = z.string().min(1).parse(req.params.conversationId);
    streamConversationEvents(req, res, conversationId);
  } catch (error) {
    next(error);
  }
};

/** Streams "a new inquiry was created" to whichever employee has the Inquiries list open. */
export const streamInquiryList = (req: Request, res: Response): void => {
  streamInquiryCreatedEvents(req, res);
};

const assignStaffSchema = z.object({
  assigned_staff_uuid: z.string().min(1).nullable(),
});

export const assignStaff = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const conversationId = z.string().min(1).parse(req.params.conversationId);
    const { assigned_staff_uuid } = assignStaffSchema.parse(req.body);
    const inquiry = await adminInquiryService.assignInquiryStaff(
      conversationId,
      assigned_staff_uuid,
    );
    res.status(200).json({ inquiry });
  } catch (error) {
    next(error);
  }
};

export const resolveInquiry = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const conversationId = z.string().min(1).parse(req.params.conversationId);
    const inquiry = await adminInquiryService.resolveInquiry(conversationId);
    res.status(200).json({ inquiry });
  } catch (error) {
    next(error);
  }
};

const updateNotesSchema = z.object({
  notes: z.string().max(5000),
});

export const updateInquiryNotes = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const conversationId = z.string().min(1).parse(req.params.conversationId);
    const { notes } = updateNotesSchema.parse(req.body);
    const inquiry = await adminInquiryService.updateInquiryNotes(conversationId, notes);
    res.status(200).json({ inquiry });
  } catch (error) {
    next(error);
  }
};

const postStaffMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});

export const createInquiryMessage = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = requireUser(req);
    const conversationId = z.string().min(1).parse(req.params.conversationId);
    const { body } = postStaffMessageSchema.parse(req.body);
    const message = await adminInquiryService.postStaffMessage(
      conversationId,
      user.id,
      user.employee_role,
      body,
    );
    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
};
