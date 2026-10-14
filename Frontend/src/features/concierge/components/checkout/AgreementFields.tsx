import React, { useId } from 'react';
import type { ConciergeCopy } from '../../copy';
import { CHECKBOX, CHECK_ROW, ERROR_TEXT, GROUP_LEGEND } from '../conciergeStyles';
import { FullTermsDisclosure } from './FullTermsDisclosure';

interface AgreementFieldsProps {
  copy: ConciergeCopy;
  termsAccepted: boolean;
  vetConsent: boolean;
  visibleError: (key: string) => string | null;
  touch: (key: string) => () => void;
  onTermsChange: (accepted: boolean) => void;
  onVetConsentChange: (given: boolean) => void;
}

interface ConsentBoxProps {
  /** The form key, also the data-field the error summary jumps to. */
  field: 'termsAccepted' | 'vetConsent';
  label: string;
  checked: boolean;
  error: string | null;
  onChange: (checked: boolean) => void;
}

/** One agreement box, never ticked for the parent, with its error read out with it. */
const ConsentBox: React.FC<ConsentBoxProps> = ({ field, label, checked, error, onChange }) => {
  const errorId = useId();
  return (
    <div>
      <label className={CHECK_ROW}>
        <input
          type="checkbox"
          data-field={field}
          className={CHECKBOX}
          checked={checked}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => onChange(event.target.checked)}
        />
        {label}
      </label>
      {error && (
        <p id={errorId} className={`${ERROR_TEXT} ml-9`}>
          {error}
        </p>
      )}
    </div>
  );
};

/**
 * The only place the booking is agreed to: the plain-words summary, every clause on demand, and two
 * boxes that are never ticked for the parent. The first agrees to the terms, including the card
 * rules shown above; the second gives emergency vet consent on its own, which is clearer evidence
 * of it (Code of Welfare, temporary housing, MS 4(g)). The server refuses a request without
 * either. The agreement is recorded under the parent's own name, so nothing has to be typed.
 * Continuing with a stay earlier did not agree to anything but its price.
 */
export const AgreementFields: React.FC<AgreementFieldsProps> = ({
  copy,
  termsAccepted,
  vetConsent,
  visibleError,
  touch,
  onTermsChange,
  onVetConsentChange,
}) => {
  const { details } = copy;
  return (
    <fieldset className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
      <legend className={GROUP_LEGEND}>{details.termsTitle}</legend>
      <p className="m-0 type-body font-semibold">{details.requestNotice}</p>
      <ul className="m-0 list-disc space-y-1.5 pl-5 type-meta text-notice-secondary">
        {details.termsSummary.map((term) => (
          <li key={term}>{term}</li>
        ))}
      </ul>
      <FullTermsDisclosure copy={details.fullTerms} />
      <ConsentBox
        field="termsAccepted"
        label={details.agreeCheckbox}
        checked={termsAccepted}
        error={visibleError('termsAccepted')}
        onChange={(checked) => {
          onTermsChange(checked);
          touch('termsAccepted')();
        }}
      />
      <ConsentBox
        field="vetConsent"
        label={details.vetConsentCheckbox}
        checked={vetConsent}
        error={visibleError('vetConsent')}
        onChange={(checked) => {
          onVetConsentChange(checked);
          touch('vetConsent')();
        }}
      />
    </fieldset>
  );
};
