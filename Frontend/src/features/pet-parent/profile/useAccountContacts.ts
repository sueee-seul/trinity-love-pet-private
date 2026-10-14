import { useCallback, useEffect, useState } from 'react';
import type { AccountContact, ContactInput } from '../types/contacts';
import { addContact, fetchContacts, removeContact, updateContact } from './contactsApi';

export type AccountContactsState =
  | { status: 'loading' }
  | { status: 'failed'; retry: () => void }
  | {
      status: 'ready';
      contacts: AccountContact[];
      /** The error of the last write that failed, kept as thrown so the card words it in its language. */
      problem: unknown;
      /** Resolves true once the server kept the contact, so the form can clear itself. */
      add: (input: ContactInput) => Promise<boolean>;
      /** Records whether the parent told this person we hold their details. */
      setInformed: (contact: AccountContact, informed: boolean) => void;
      remove: (contactId: string) => void;
    };

/** The server's answer to one load attempt; the hook is loading until the answer is for the current one. */
type Answer =
  | { attempt: number; status: 'failed' }
  | { attempt: number; status: 'ready'; contacts: AccountContact[] };

type ContactsChange = (contacts: AccountContact[]) => AccountContact[];

const withInformedAt =
  (contactId: string, informedAt: string | null): ContactsChange =>
  (contacts) =>
    contacts.map((contact) => (contact.id === contactId ? { ...contact, informedAt } : contact));

/**
 * Loads the parent's contacts and writes each change as it is made. The list shows the change at
 * once and keeps the server's record when it answers; a refused change is put back and named in
 * `problem`, so the card never shows a contact the server does not hold.
 */
export function useAccountContacts(): AccountContactsState {
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [problem, setProblem] = useState<unknown>(null);

  useEffect((): (() => void) => {
    let current = true;
    fetchContacts()
      .then((contacts) => {
        if (current) setAnswer({ attempt, status: 'ready', contacts });
      })
      .catch(() => {
        // The card says the contacts did not load and offers Try again; nothing else to tell.
        if (current) setAnswer({ attempt, status: 'failed' });
      });
    return (): void => {
      current = false;
    };
  }, [attempt]);

  const changeContacts = useCallback(
    (change: ContactsChange): void =>
      setAnswer((state) =>
        state?.status === 'ready' ? { ...state, contacts: change(state.contacts) } : state,
      ),
    [],
  );

  const add = useCallback(
    async (input: ContactInput): Promise<boolean> => {
      setProblem(null);
      try {
        const contact = await addContact(input);
        changeContacts((contacts) => [...contacts, contact]);
        return true;
      } catch (error: unknown) {
        setProblem(error);
        return false;
      }
    },
    [changeContacts],
  );

  const setInformed = useCallback(
    (contact: AccountContact, informed: boolean): void => {
      setProblem(null);
      // Ticked at once; the server's record, with the time it kept, replaces it on answer.
      changeContacts(withInformedAt(contact.id, informed ? new Date().toISOString() : null));
      updateContact(contact.id, { informed })
        .then((saved) =>
          changeContacts((contacts) =>
            contacts.map((candidate) => (candidate.id === contact.id ? saved : candidate)),
          ),
        )
        .catch((error: unknown) => {
          changeContacts(withInformedAt(contact.id, contact.informedAt));
          setProblem(error);
        });
    },
    [changeContacts],
  );

  const remove = useCallback(
    (contactId: string): void => {
      setProblem(null);
      removeContact(contactId)
        .then(() =>
          changeContacts((contacts) => contacts.filter((contact) => contact.id !== contactId)),
        )
        .catch((error: unknown) => setProblem(error));
    },
    [changeContacts],
  );

  if (answer === null || answer.attempt !== attempt) return { status: 'loading' };
  if (answer.status === 'failed') {
    return { status: 'failed', retry: (): void => setAttempt((count) => count + 1) };
  }
  return { status: 'ready', contacts: answer.contacts, problem, add, setInformed, remove };
}
