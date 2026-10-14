import React from 'react';
import type { ConciergeCopy } from '../../copy';
import { MAX_LENGTHS, type DetailsContactDraft } from '../../utils/validateDetails';
import { GROUP_LEGEND, INLINE_TEXT_BUTTON } from '../conciergeStyles';
import { TextField } from './DetailsFields';
import { PasswordRuleList } from './PasswordRuleList';

interface ContactFieldsetProps {
  copy: ConciergeCopy;
  contact: DetailsContactDraft;
  /** The error to show for a field, once it was touched or a send was tried. */
  visibleError: (key: string) => string | null;
  touch: (key: string) => () => void;
  onChange: <K extends keyof DetailsContactDraft>(key: K, value: DetailsContactDraft[K]) => void;
  /** Opens the sign-in dialog over the form, for a guest who already has an account. */
  onSignIn: () => void;
}

/**
 * "About you", asked only of a guest without an account: the email and password their account is
 * made with when the booking is sent, names in the page language's order, a mobile and an optional
 * home address. An emergency contact is optional, with a notice beside the field.
 */
export const ContactFieldset: React.FC<ContactFieldsetProps> = ({
  copy,
  contact,
  visibleError,
  touch,
  onChange,
  onSignIn,
}) => {
  const { details } = copy;
  const familyFirst = details.namesFirst === 'family';

  const firstNameField = (
    <TextField
      fieldKey="firstName"
      label={details.firstName}
      autoComplete="given-name"
      maxLength={MAX_LENGTHS.name}
      value={contact.firstName}
      error={visibleError('firstName')}
      onBlur={touch('firstName')}
      onChange={(value) => onChange('firstName', value)}
    />
  );
  const lastNameField = (
    <TextField
      fieldKey="lastName"
      label={details.lastName}
      autoComplete="family-name"
      maxLength={MAX_LENGTHS.name}
      value={contact.lastName}
      error={visibleError('lastName')}
      onBlur={touch('lastName')}
      onChange={(value) => onChange('lastName', value)}
    />
  );
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
      <legend className={GROUP_LEGEND}>{details.account.title}</legend>
      <p className="m-0 -mt-2 type-body text-notice-secondary">
        {details.account.lead} {details.account.haveAccount}{' '}
        <button type="button" onClick={onSignIn} className={INLINE_TEXT_BUTTON}>
          {details.account.signIn}
        </button>
      </p>
      <TextField
        fieldKey="email"
        label={details.account.email}
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={254}
        value={contact.email}
        error={visibleError('email') ?? visibleError('accountExists')}
        onBlur={touch('email')}
        onChange={(value) => onChange('email', value)}
      />
      <TextField
        fieldKey="password"
        label={details.account.password}
        type="password"
        autoComplete="new-password"
        maxLength={32}
        value={contact.password}
        hint={details.account.passwordHint}
        error={visibleError('password')}
        onBlur={touch('password')}
        onChange={(value) => onChange('password', value)}
      />
      <PasswordRuleList password={contact.password} />
      <h3 className="m-0 mt-2 type-body font-semibold text-notice-primary">{details.you}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {familyFirst ? lastNameField : firstNameField}
        {familyFirst ? firstNameField : lastNameField}
      </div>
      <TextField
        fieldKey="phone"
        label={details.phone}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        maxLength={MAX_LENGTHS.phone}
        value={contact.phone}
        hint={details.phoneHint}
        error={visibleError('phone')}
        onBlur={touch('phone')}
        onChange={(value) => onChange('phone', value)}
      />
      <TextField
        fieldKey="address"
        label={details.address}
        autoComplete="street-address"
        required={false}
        maxLength={MAX_LENGTHS.address}
        value={contact.address}
        hint={details.addressHint}
        error={visibleError('address')}
        onBlur={touch('address')}
        onChange={(value) => onChange('address', value)}
      />
      <TextField
        fieldKey="emergencyContactNumber"
        label={details.emergencyContactNumber}
        type="tel"
        inputMode="tel"
        required={false}
        maxLength={MAX_LENGTHS.phone}
        value={contact.emergencyContactNumber ?? ''}
        hint={details.emergencyContactHint}
        error={visibleError('emergencyContactNumber')}
        onBlur={touch('emergencyContactNumber')}
        onChange={(value) => onChange('emergencyContactNumber', value)}
      />
    </fieldset>
  );
};
