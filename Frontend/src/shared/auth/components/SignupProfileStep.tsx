import React from 'react';
import { toIsoDate } from '../../components/ui/date';
import { SignupDateField, SignupTextField } from './SignupTextField';
import { useSiteCopy } from '../../i18n/siteLanguage';
import { AUTH_COPY, localizeFieldErrors } from '../authCopy';
import type { SignupDraft, SignupErrors } from './signupTypes';

interface SignupProfileStepProps {
  draft: SignupDraft;
  errors: SignupErrors;
  onEmergencyContactNumberChange: (value: string) => void;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onDateOfBirthChange: (value: string) => void;
}

export const SignupProfileStep: React.FC<SignupProfileStepProps> = ({
  draft,
  errors,
  onEmergencyContactNumberChange,
  onFirstNameChange,
  onLastNameChange,
  onAddressChange,
  onDateOfBirthChange,
}) => {
  const copy = useSiteCopy(AUTH_COPY);

  // Only the name is required. The rest is optional: the Privacy Act (IPP 1) asks us to collect
  // only what a booking needs, and the booking page asks the same three as optional.
  return (
    <div className="flex flex-col space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <SignupTextField
          id="signup-first-name"
          label={copy.signup.labels.firstName}
          type="text"
          value={draft.firstName}
          errors={localizeFieldErrors('firstName', errors.firstName, copy)}
          autoComplete="given-name"
          onChange={onFirstNameChange}
        />
        <SignupTextField
          id="signup-last-name"
          label={copy.signup.labels.lastName}
          type="text"
          value={draft.lastName}
          errors={localizeFieldErrors('lastName', errors.lastName, copy)}
          autoComplete="family-name"
          onChange={onLastNameChange}
        />
      </div>
      <SignupTextField
        id="signup-emergency-contact-number"
        label={copy.signup.labels.emergencyContactNumber}
        type="text"
        value={draft.emergencyContactNumber}
        errors={localizeFieldErrors('emergencyContactNumber', errors.emergencyContactNumber, copy)}
        autoComplete="tel"
        prefix="+64 "
        onChange={onEmergencyContactNumberChange}
      />
      <SignupTextField
        id="signup-address"
        label={copy.signup.labels.address}
        type="text"
        value={draft.address}
        errors={localizeFieldErrors('address', errors.address, copy)}
        autoComplete="street-address"
        onChange={onAddressChange}
      />
      <SignupDateField
        id="signup-date-of-birth"
        label={copy.signup.labels.dateOfBirth}
        value={draft.dateOfBirth}
        errors={localizeFieldErrors('dateOfBirth', errors.dateOfBirth, copy)}
        // Today in local time; nobody signing up can be born later than that.
        max={toIsoDate(new Date())}
        onChange={onDateOfBirthChange}
      />
    </div>
  );
};
