import { useState, type FormEvent, type ReactElement } from 'react';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import { requestErrorText } from '../../i18n/requestErrorText';
import type { AccountContact, ContactInput } from '../../types/contacts';
import { CONTACTS_COPY } from '../copy/contactsCopy';
import { useAccountContacts } from '../useAccountContacts';
import { Button, Field, SectionCard, inputClass } from './ProfileUi';

const CHECKBOX_ROW = 'flex min-h-11 items-start gap-2 type-body';

/** A blank field is not sent as an empty string, which the server would refuse as too short. */
const orNull = (value: string): string | null => value.trim() || null;

/** One person on the list: who they are, whether they were told we hold their details, and Remove. */
function ContactRow({
  contact,
  onInformedChange,
  onRemove,
}: {
  contact: AccountContact;
  onInformedChange: (informed: boolean) => void;
  onRemove: () => void;
}): ReactElement {
  const copy = usePortalCopy(CONTACTS_COPY);
  const details = [contact.relationship, contact.phone].filter(Boolean).join(' · ');
  return (
    <li className="flex flex-col gap-1 border-t border-border-soft py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="type-body m-0 font-semibold text-notice-primary">{contact.name}</p>
          {details && <p className="type-meta m-0">{details}</p>}
        </div>
        {/* The name is in the label, because several rows carry the same button. */}
        <Button variant="ghost" aria-label={`${copy.remove} ${contact.name}`} onClick={onRemove}>
          {copy.remove}
        </Button>
      </div>
      <label className={CHECKBOX_ROW}>
        <input
          type="checkbox"
          className="mt-1"
          checked={contact.informedAt !== null}
          aria-label={`${copy.informed} (${contact.name})`}
          onChange={(event) => onInformedChange(event.target.checked)}
        />
        <span>{copy.informed}</span>
      </label>
    </li>
  );
}

/** Adds one emergency contact. A phone is required, which is checked here first. */
function AddContactForm({
  onAdd,
}: {
  onAdd: (input: ContactInput) => Promise<boolean>;
}): ReactElement {
  const copy = usePortalCopy(CONTACTS_COPY);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relationship, setRelationship] = useState('');
  const [informed, setInformed] = useState(false);
  const [phoneMissing, setPhoneMissing] = useState(false);
  const [sending, setSending] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const missing = orNull(phone) === null;
    setPhoneMissing(missing);
    if (missing || sending) return;
    setSending(true);
    void onAdd({
      role: 'emergency',
      name: name.trim(),
      phone: orNull(phone),
      relationship: orNull(relationship),
      informed,
    })
      .then((added) => {
        if (!added) return;
        setName('');
        setPhone('');
        setRelationship('');
        setInformed(false);
      })
      .finally(() => setSending(false));
  };

  return (
    <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label={copy.name}>
          <input
            className={inputClass}
            value={name}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field label={copy.phone}>
          <input
            className={inputClass}
            type="tel"
            value={phone}
            autoComplete="off"
            aria-invalid={phoneMissing || undefined}
            onChange={(event) => setPhone(event.target.value)}
          />
        </Field>
        <Field label={copy.relationship}>
          <input
            className={inputClass}
            value={relationship}
            autoComplete="off"
            onChange={(event) => setRelationship(event.target.value)}
          />
        </Field>
      </div>
      {phoneMissing && (
        <p role="alert" className="type-meta m-0 font-bold text-status-danger">
          {copy.phoneRequired}
        </p>
      )}
      <label className={CHECKBOX_ROW}>
        <input
          type="checkbox"
          className="mt-1"
          checked={informed}
          onChange={(event) => setInformed(event.target.checked)}
        />
        <span>{copy.informed}</span>
      </label>
      <div>
        <Button type="submit" variant="outline" disabled={name.trim() === '' || sending}>
          {copy.add}
        </Button>
      </div>
    </form>
  );
}

/**
 * The emergency contacts card: the people we call if something happens and the parent cannot be
 * reached. Each person's tick box records that the parent told them we hold their details, the
 * lightest notice the Privacy Act 2020 (IPP 3A) asks for.
 */
export function ContactsCard(): ReactElement {
  const copy = usePortalCopy(CONTACTS_COPY);
  const locale = usePortalLocale();
  const state = useAccountContacts();
  return (
    <SectionCard title={copy.title}>
      {state.status === 'loading' && <p className="type-meta m-0">{copy.loading}</p>}
      {state.status === 'failed' && (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="type-body m-0 font-bold text-status-danger">
            {copy.loadFailed}
          </p>
          <Button variant="outline" onClick={state.retry}>
            {copy.tryAgain}
          </Button>
        </div>
      )}
      {state.status === 'ready' && (
        <div className="flex flex-col gap-5">
          {state.problem !== null && (
            <p role="alert" className="type-meta m-0 font-bold text-status-danger">
              {requestErrorText(state.problem, locale, copy.saveFailed)}
            </p>
          )}
          {state.contacts.length === 0 ? (
            <p className="type-meta m-0">{copy.empty}</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {state.contacts.map((contact) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  onInformedChange={(informed) => state.setInformed(contact, informed)}
                  onRemove={() => state.remove(contact.id)}
                />
              ))}
            </ul>
          )}
          <AddContactForm onAdd={state.add} />
          <p className="type-meta m-0 text-notice-muted">{copy.privacy}</p>
        </div>
      )}
    </SectionCard>
  );
}
