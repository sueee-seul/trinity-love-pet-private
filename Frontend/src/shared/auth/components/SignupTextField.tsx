import React from 'react';
import { DateField } from '../../components/ui/date';
import { useSiteCopy } from '../../i18n/siteLanguage';
import { AUTH_COPY } from '../authCopy';
import { AuthFieldError } from './AuthFieldError';
import type { SignupFieldError } from './signupTypes';

interface SignupTextFieldProps {
  id: string;
  label: string;
  type: 'email' | 'text';
  value: string;
  errors?: SignupFieldError[];
  autoComplete?: string;
  autoFocus?: boolean;
  prefix?: string;
  onChange: (value: string) => void;
}

interface SignupDateFieldProps {
  id: string;
  label: string;
  /** "YYYY-MM-DD", or "" for no date. */
  value: string;
  errors?: SignupFieldError[];
  /** Latest day that can be picked, "YYYY-MM-DD". */
  max?: string;
  onChange: (value: string) => void;
}

interface SignupTextAreaFieldProps {
  id: string;
  label: string;
  value: string;
  errors?: SignupFieldError[];
  onChange: (value: string) => void;
}

interface SignupPasswordFieldProps {
  id: string;
  label: string;
  value: string;
  errors?: SignupFieldError[];
  autoComplete?: string;
  showPassword: boolean;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
}

const getInputClassName = (hasError: boolean): string => {
  return `peer type-body h-[56px] w-full rounded border bg-transparent px-4 pb-1 pt-5 transition-colors focus:outline-none ${hasError ? 'border-status-danger focus:border-2 focus:border-status-danger' : 'border-control-border focus:border-2 focus:border-focus'}`;
};

const getLabelClassName = (hasValue: boolean, isDate: boolean, hasError: boolean): string => {
  const positionClass =
    hasValue || isDate
      ? 'top-[-10px] font-bold text-meta'
      : 'top-4 peer-placeholder-shown:top-4 peer-placeholder-shown:text-body';

  return `absolute left-4 bg-surface-card px-1 type-body text-notice-muted transition-all peer-focus:top-[-10px] peer-focus:font-bold peer-focus:text-meta peer-focus:text-accent-foreground ${positionClass} ${hasError ? 'text-status-danger peer-focus:text-status-danger' : ''}`;
};

const renderErrors = (id: string, errors?: SignupFieldError[]): React.ReactNode => {
  return errors?.map((error) => (
    <AuthFieldError key={`${id}-${error.code}`} message={error.message} />
  ));
};

export const SignupTextField: React.FC<SignupTextFieldProps> = ({
  id,
  label,
  type,
  value,
  errors,
  autoComplete,
  autoFocus,
  prefix,
  onChange,
}) => {
  const hasError = Boolean(errors?.length);

  return (
    <div>
      <div className="relative flex items-center">
        {prefix && (
          <span className="pointer-events-none absolute left-4 top-5 z-10 type-body text-body">
            {prefix}
          </span>
        )}
        <input
          type={type}
          id={id}
          value={value}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value)}
          className={`${getInputClassName(hasError)} ${prefix ? 'pl-12' : ''}`}
          placeholder=" "
          aria-invalid={hasError}
        />
        <label
          htmlFor={id}
          className={getLabelClassName(Boolean(value) || Boolean(prefix), false, hasError)}
        >
          {label}
        </label>
      </div>
      {renderErrors(id, errors)}
    </div>
  );
};

/**
 * The date twin of SignupTextField. It uses our DateField rather than a native date input, which
 * the browser draws in its own language, so an English page in a Chinese Chrome showed Chinese.
 * The trigger keeps the text field look and the `peer` class, so the floating label still reacts
 * to focus.
 */
export const SignupDateField: React.FC<SignupDateFieldProps> = ({
  id,
  label,
  value,
  errors,
  max,
  onChange,
}) => {
  const hasError = Boolean(errors?.length);

  return (
    <div>
      <div className="relative flex items-center">
        <DateField
          id={id}
          value={value}
          max={max}
          yearPicker
          invalid={hasError}
          onChange={onChange}
          className={getInputClassName(hasError)}
        />
        {/* Always raised: the trigger shows a placeholder, so a lowered label would cover it. */}
        <label htmlFor={id} className={getLabelClassName(Boolean(value), true, hasError)}>
          {label}
        </label>
      </div>
      {renderErrors(id, errors)}
    </div>
  );
};

export const SignupTextAreaField: React.FC<SignupTextAreaFieldProps> = ({
  id,
  label,
  value,
  errors,
  onChange,
}) => {
  const hasError = Boolean(errors?.length);

  return (
    <div>
      <div className="relative">
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={`peer type-body min-h-[96px] w-full resize-none rounded border bg-transparent px-4 pb-3 pt-6 transition-colors focus:outline-none ${hasError ? 'border-status-danger focus:border-2 focus:border-status-danger' : 'border-control-border focus:border-2 focus:border-focus'}`}
          placeholder=" "
          aria-invalid={hasError}
        />
        <label htmlFor={id} className={getLabelClassName(Boolean(value), false, hasError)}>
          {label}
        </label>
      </div>
      {renderErrors(id, errors)}
    </div>
  );
};

export const SignupPasswordField: React.FC<SignupPasswordFieldProps> = ({
  id,
  label,
  value,
  errors,
  autoComplete,
  showPassword,
  onChange,
  onToggleVisibility,
}) => {
  const hasError = Boolean(errors?.length);
  const copy = useSiteCopy(AUTH_COPY).signup;

  return (
    <div>
      <div className="relative flex items-center">
        <input
          type={showPassword ? 'text' : 'password'}
          id={id}
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          className={`${getInputClassName(hasError)} pr-12`}
          placeholder=" "
          aria-invalid={hasError}
        />
        <label htmlFor={id} className={getLabelClassName(Boolean(value), false, hasError)}>
          {label}
        </label>
        <button
          type="button"
          onClick={onToggleVisibility}
          className="absolute right-3 rounded-full p-1.5 text-notice-muted transition-colors hover:bg-surface-deep hover:text-notice-primary focus:outline-none focus:ring-2 focus:ring-focus/20"
          aria-label={showPassword ? copy.hideField(label) : copy.showField(label)}
        >
          {showPassword ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
              <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
              <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
              <line x1="2" y1="2" x2="22" y2="22" />
            </svg>
          )}
        </button>
      </div>
      {renderErrors(id, errors)}
    </div>
  );
};
