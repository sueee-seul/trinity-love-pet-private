import { AppError } from '../common/middlewares/error.middleware.js';
import type {
  AccountContact,
  ContactInput,
  ContactUpdate,
} from '../contracts/account-contacts.contract.js';
import {
  deleteContact,
  insertContact,
  listContacts,
  updateContact,
} from '../repositories/account-contacts.repository.js';

/**
 * The emergency contact a parent names: someone we can reach when the parent cannot be (Code of
 * Welfare MS 4(g)). It is personal information about someone other than the parent, so the page
 * asks the parent to tell that person we hold it (Privacy Act 2020 IPP 3A) and records the moment
 * they confirm.
 */

export const contactsForOwner = (ownerId: string): Promise<AccountContact[]> =>
  listContacts(ownerId);

export const addContactForOwner = (
  ownerId: string,
  input: ContactInput,
  now: Date = new Date(),
): Promise<AccountContact> => insertContact(ownerId, input, input.informed ? now : null);

export const updateContactForOwner = async (
  ownerId: string,
  contactId: string,
  update: ContactUpdate,
  now: Date = new Date(),
): Promise<AccountContact> => {
  const informedAt = update.informed === undefined ? undefined : update.informed ? now : null;
  const contact = await updateContact(ownerId, contactId, update, informedAt);
  if (!contact) throw new AppError('Contact not found', 'NOT_FOUND', 404);
  return contact;
};

export const removeContactForOwner = async (ownerId: string, contactId: string): Promise<void> => {
  if (!(await deleteContact(ownerId, contactId))) {
    throw new AppError('Contact not found', 'NOT_FOUND', 404);
  }
};
