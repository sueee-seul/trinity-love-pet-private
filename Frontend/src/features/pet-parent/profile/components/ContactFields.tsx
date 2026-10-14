import { useId, type ReactElement } from 'react';
import { Field, inputClass } from './ProfileUi';
import { usePortalCopy } from '../../i18n/portalLocale';
import { EMERGENCY_NUMBER_COPY } from '../copy/ownerFormCopy';
import { PET_CONTACTS_COPY } from '../copy/petFormCopy';

/*
 * Fields where a parent tells us about another person: an emergency contact, or their vet.
 * Privacy Act 2020 IPP 3A (from 1 May 2026) asks us to make sure that person knows we hold their
 * details. The concierge and profile forms provide a collection notice next to the fields, where the details are
 * collected, and each field is described by it. The notices' words live in the form copy.
 */

function ContactNotice({ id, text }: { id: string; text: string }): ReactElement {
  return (
    <p id={id} className="type-meta m-0 text-notice-secondary">
      {text}
    </p>
  );
}

/** The owner's emergency contact number, its error, and the notice for the person it belongs to. */
export function EmergencyNumberField({
  value,
  error,
  onChange,
}: {
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}): ReactElement {
  const noticeId = useId();
  const copy = usePortalCopy(EMERGENCY_NUMBER_COPY);
  return (
    <div className="space-y-1">
      <Field label={copy.label}>
        <input
          className={inputClass}
          value={value}
          placeholder="+64 21 123 4567"
          aria-invalid={error !== null}
          aria-describedby={noticeId}
          onChange={(e) => onChange(e.target.value)}
        />
        {error && (
          <span role="alert" className="mt-1 block type-meta text-status-danger">
            {error}
          </span>
        )}
      </Field>
      <ContactNotice id={noticeId} text={copy.notice} />
    </div>
  );
}

interface PetContactFieldsProps {
  vetName: string;
  vetPhone: string;
  emergencyContact: string;
  onVetName: (value: string) => void;
  onVetPhone: (value: string) => void;
  onEmergencyContact: (value: string) => void;
}

/**
 * The pet's vet and emergency contact, as cells of the pet form's two column grid, then the notice
 * across the whole row.
 */
export function PetContactFields({
  vetName,
  vetPhone,
  emergencyContact,
  onVetName,
  onVetPhone,
  onEmergencyContact,
}: PetContactFieldsProps): ReactElement {
  const noticeId = useId();
  const copy = usePortalCopy(PET_CONTACTS_COPY);
  const fields = [
    { key: 'vetName', label: copy.vetName, value: vetName, onChange: onVetName },
    { key: 'vetPhone', label: copy.vetPhone, value: vetPhone, onChange: onVetPhone },
    {
      key: 'emergencyContact',
      label: copy.emergencyContact,
      value: emergencyContact,
      onChange: onEmergencyContact,
    },
  ];
  return (
    <>
      {fields.map((field) => (
        <Field key={field.key} label={field.label}>
          <input
            className={inputClass}
            value={field.value}
            aria-describedby={noticeId}
            onChange={(e) => field.onChange(e.target.value)}
          />
        </Field>
      ))}
      <div className="sm:col-span-2">
        <ContactNotice id={noticeId} text={copy.notice} />
      </div>
    </>
  );
}
