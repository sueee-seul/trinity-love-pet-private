/**
 * The account password rules, shown to people while they type.
 *
 * The Backend decides; these mirror `addPasswordIssues` in
 * Backend/src/contracts/auth.signup.contract.ts so the page can say up front what a password
 * needs, instead of failing after submit. Keep the two in step.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 32;

export type PasswordRuleId = 'length' | 'number' | 'symbol' | 'edges';

/** The words for each rule are in `AUTH_COPY.passwordRules`, in both languages. */
export interface PasswordRule {
  id: PasswordRuleId;
  isMet: (password: string) => boolean;
}

export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: 'length',
    isMet: (password) =>
      password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH,
  },
  { id: 'number', isMet: (password) => /\d/.test(password) },
  {
    id: 'symbol',
    isMet: (password) => /[^A-Za-z0-9\s]/.test(password),
  },
  {
    id: 'edges',
    isMet: (password) => password.length > 0 && password === password.trim(),
  },
];

export const meetsPasswordRules = (password: string): boolean =>
  PASSWORD_RULES.every((rule) => rule.isMet(password));
