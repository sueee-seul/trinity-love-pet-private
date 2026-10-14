import React from 'react';
import { AUTH_COPY } from '../../../../shared/auth/authCopy';
import { PASSWORD_RULES } from '../../../../shared/auth/passwordRules';
import { useSiteCopy } from '../../../../shared/i18n/siteLanguage';

/**
 * The sign-up password rules, ticked as the guest types, so the account made with the booking
 * follows exactly the rule of the sign-up page. One field, so there is no "passwords match" line.
 */
export const PasswordRuleList: React.FC<{ password: string }> = ({ password }) => {
  const words = useSiteCopy(AUTH_COPY).passwordRules;
  return (
    <ul className="m-0 -mt-2 list-none space-y-1 p-0">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.isMet(password);
        return (
          <li
            key={rule.id}
            className={`type-meta ${met ? 'text-status-success' : 'text-notice-secondary'}`}
          >
            <span aria-hidden="true">{met ? '✓ ' : '○ '}</span>
            {words.rules[rule.id]}
            <span className="sr-only">{met ? words.done : words.notYet}</span>
          </li>
        );
      })}
    </ul>
  );
};
