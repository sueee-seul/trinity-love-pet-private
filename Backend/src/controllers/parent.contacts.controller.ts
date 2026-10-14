import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../common/middlewares/error.middleware.js';
import {
  contactInputSchema,
  contactUpdateSchema,
  type ContactsResponse,
} from '../contracts/account-contacts.contract.js';
import {
  addContactForOwner,
  contactsForOwner,
  removeContactForOwner,
  updateContactForOwner,
} from '../services/account-contacts.service.js';

/** A parent's emergency contacts; the owner is the signed-in user. */

const ownerIdOf = (req: Request): string => {
  if (!req.user) throw new AppError('Authentication required', 'UNAUTHENTICATED', 401);
  return req.user.id;
};

const uuidParam = (value: unknown): string => z.string().uuid().parse(value);

type Handler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

const handle =
  (status: number, run: (req: Request) => Promise<unknown>): Handler =>
  async (req, res, next) => {
    try {
      res.status(status).json(await run(req));
    } catch (error) {
      next(error);
    }
  };

export const getContacts = handle(200, async (req): Promise<ContactsResponse> => ({
  contacts: await contactsForOwner(ownerIdOf(req)),
}));

export const postContact = handle(201, async (req) => ({
  contact: await addContactForOwner(ownerIdOf(req), contactInputSchema.parse(req.body)),
}));

export const patchContact = handle(200, async (req) => ({
  contact: await updateContactForOwner(
    ownerIdOf(req),
    uuidParam(req.params.contactId),
    contactUpdateSchema.parse(req.body),
  ),
}));

export const deleteContactHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    await removeContactForOwner(ownerIdOf(req), uuidParam(req.params.contactId));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
