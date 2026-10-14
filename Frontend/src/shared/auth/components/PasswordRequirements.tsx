import React from 'react';
import { useSiteCopy } from '../../i18n/siteLanguage';
import { AUTH_COPY } from '../authCopy';
import { PASSWORD_RULES } from '../passwordRules';

interface PasswordRequirementsProps {
  id: string;
  password: string;
  confirmPassword: string;
}

const RuleLine: React.FC<{ met: boolean; label: string }> = ({ met, label }) => {
  const copy = useSiteCopy(AUTH_COPY).passwordRules;

  return (
    <li
      className={`flex items-start gap-2 type-meta ${met ? 'text-status-success' : 'text-notice-secondary'}`}
    >
      <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        {met ? (
          <path
            d="M3 8.5l3 3 7-7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
        )}
      </svg>
      <span>
        {label}
        <span className="sr-only">{met ? copy.done : copy.notYet}</span>
      </span>
    </li>
  );
};

/**
 * Lists what a new password needs and ticks each rule as it is met, so nobody has to guess the
 * rules from an error after pressing the button.
 */
export const PasswordRequirements: React.FC<PasswordRequirementsProps> = ({
  id,
  password,
  confirmPassword,
}) => {
  const copy = useSiteCopy(AUTH_COPY).passwordRules;

  return (
    <div id={id}>
      <p className="mb-2 type-meta text-notice-secondary">{copy.heading}</p>
      <ul className="m-0 list-none space-y-1 p-0">
        {PASSWORD_RULES.map((rule) => (
          <RuleLine key={rule.id} met={rule.isMet(password)} label={copy.rules[rule.id]} />
        ))}
        <RuleLine
          met={confirmPassword.length > 0 && password === confirmPassword}
          label={copy.match}
        />
      </ul>
    </div>
  );
};
