import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../common/middlewares/error.middleware.js';
import * as conversationService from '../services/conversation.service.js';
import { streamConversationEvents } from '../services/conversation.events.js';

const requireUser = (req: Request): NonNullable<Request['user']> => {
  if (!req.user) {
    throw new AppError('Authentication required', 'UNAUTHENTICATED', 401);
  }
  return req.user;
};

const postMessageSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  /** The language the parent reads the chat in; the AI replies in it. */
  locale: z.enum(['en', 'zh']).default('en'),
});

export const listConversations = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = requireUser(req);
    const conversations = await conversationService.listConversationsForOwner(user.id);
    res.status(200).json({ conversations });
  } catch (error) {
    next(error);
  }
};

export const createConversation = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = requireUser(req);
    const conversation = await conversationService.startConversation(user.id);
    res.status(201).json({ conversation });
  } catch (error) {
    next(error);
  }
};

export const getConversation = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = requireUser(req);
    const conversationId = z.string().min(1).parse(req.params.conversationId);
    const conversation = await conversationService.getConversationForOwner(conversationId, user.id);
    res.status(200).json({ conversation });
  } catch (error) {
    next(error);
  }
};

export const streamConversation = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = requireUser(req);
    const conversationId = z.string().min(1).parse(req.params.conversationId);
    await conversationService.assertOwnedConversation(conversationId, user.id);
    streamConversationEvents(req, res, conversationId);
  } catch (error) {
    next(error);
  }
};

export const createMessage = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = requireUser(req);
    const { body, locale } = postMessageSchema.parse(req.body);
    const conversationId = z.string().min(1).parse(req.params.conversationId);
    const message = await conversationService.postPetOwnerMessage(
      conversationId,
      user.id,
      body,
      locale,
    );
    res.status(201).json({ message });
  } catch (error) {
    next(error);
  }
};

export const closeConversation = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = requireUser(req);
    const conversationId = z.string().min(1).parse(req.params.conversationId);
    const conversation = await conversationService.closeConversation(conversationId, user.id);
    res.status(200).json({ conversation });
  } catch (error) {
    next(error);
  }
};

export const requestSupport = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const user = requireUser(req);
    const conversationId = z.string().min(1).parse(req.params.conversationId);
    const conversation = await conversationService.requestSupport(conversationId, user.id);
    res.status(200).json({ conversation });
  } catch (error) {
    next(error);
  }
};
