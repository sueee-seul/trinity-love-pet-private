import { API_BASE_URL } from '../../../shared/api';
import type {
  AccountContact,
  ContactInput,
  ContactUpdate,
  ContactsResponse,
} from '../types/contacts';
import { ParentProfileApiError, isRecord, jsonInit, messageFrom } from './parentProfileApi';

/**
 * A pet parent's emergency contacts:
 *
 *   GET    /api/parent/profile/contacts          -> { contacts }
 *   POST   /api/parent/profile/contacts          -> 201 { contact }
 *   PATCH  /api/parent/profile/contacts/:id      -> { contact }
 *   DELETE /api/parent/profile/contacts/:id      -> 204
 *
 * Whose contacts they are comes from the session cookie; the client never names the parent.
 */

const CONTACTS_URL = `${API_BASE_URL}/parent/profile/contacts`;

const contactUrl = (contactId: string): string =>
  `${CONTACTS_URL}/${encodeURIComponent(contactId)}`;

const isContact = (value: unknown): value is AccountContact =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  value.role === 'emergency' &&
  typeof value.name === 'string';

const failed = async (response: Response, fallback: string): Promise<ParentProfileApiError> =>
  new ParentProfileApiError(await messageFrom(response, fallback), response.status);

const parseContact = async (response: Response, fallback: string): Promise<AccountContact> => {
  if (!response.ok) throw await failed(response, fallback);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || !isContact(payload.contact)) {
    throw new ParentProfileApiError('The server sent a contact it could not read', 500);
  }
  return payload.contact;
};

export const fetchContacts = async (): Promise<AccountContact[]> => {
  const response = await fetch(CONTACTS_URL, { credentials: 'include' });
  if (!response.ok) throw await failed(response, 'Could not load your contacts');
  const payload: unknown = await response.json();
  const contacts: unknown = isRecord(payload)
    ? (payload as Partial<ContactsResponse>).contacts
    : null;
  if (!Array.isArray(contacts)) {
    throw new ParentProfileApiError('The server sent contacts it could not read', 500);
  }
  const listed: unknown[] = contacts;
  if (!listed.every(isContact)) {
    throw new ParentProfileApiError('The server sent contacts it could not read', 500);
  }
  return listed;
};

export const addContact = async (input: ContactInput): Promise<AccountContact> => {
  const response = await fetch(CONTACTS_URL, jsonInit('POST', input));
  return parseContact(response, 'Could not add this person');
};

/** Changes the fields given and leaves the rest as they are. */
export const updateContact = async (
  contactId: string,
  update: ContactUpdate,
): Promise<AccountContact> => {
  const response = await fetch(contactUrl(contactId), jsonInit('PATCH', update));
  return parseContact(response, 'Could not save this change');
};

export const removeContact = async (contactId: string): Promise<void> => {
  const response = await fetch(contactUrl(contactId), jsonInit('DELETE'));
  if (!response.ok) throw await failed(response, 'Could not remove this person');
};
