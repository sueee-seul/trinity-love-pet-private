import React from 'react';
import { SignupPasswordField, SignupTextField } from './SignupTextField';
import { useSiteCopy } from '../../i18n/siteLanguage';
import { AUTH_COPY, localizeFieldErrors } from '../authCopy';
import type { SignupDraft, SignupErrors } from './signupTypes';

interface SignupAccountStepProps {
  draft: SignupDraft;
  errors: SignupErrors;
  showPassword: boolean;
  showConfirmPassword: boolean;
  onEmailChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onToggleConfirmPassword: () => void;
}

export const SignupAccountStep: React.FC<SignupAccountStepProps> = ({
  draft,
  errors,
  showPassword,
  showConfirmPassword,
  onEmailChange,
  onUsernameChange,
  onPasswordChange,
  onConfirmPasswordChange,
  onTogglePassword,
  onToggleConfirmPassword,
}) => {
  const copy = useSiteCopy(AUTH_COPY);

  return (
    <div className="flex flex-col space-y-5">
      <SignupTextField
        id="signup-email"
        label={copy.signup.labels.email}
        type="email"
        value={draft.email}
        errors={localizeFieldErrors('email', errors.email, copy)}
        autoComplete="email"
        autoFocus
        onChange={onEmailChange}
      />
      <SignupTextField
        id="signup-username"
        label={copy.signup.labels.username}
        type="text"
        value={draft.username}
        errors={localizeFieldErrors('username', errors.username, copy)}
        autoComplete="username"
        onChange={onUsernameChange}
      />
      <SignupPasswordField
        id="signup-password"
        label={copy.signup.labels.password}
        value={draft.password}
        errors={localizeFieldErrors('password', errors.password, copy)}
        autoComplete="new-password"
        showPassword={showPassword}
        onChange={onPasswordChange}
        onToggleVisibility={onTogglePassword}
      />
      <SignupPasswordField
        id="signup-confirm-password"
        label={copy.signup.labels.confirmPassword}
        value={draft.confirmPassword}
        errors={localizeFieldErrors('confirmPassword', errors.confirmPassword, copy)}
        autoComplete="new-password"
        showPassword={showConfirmPassword}
        onChange={onConfirmPasswordChange}
        onToggleVisibility={onToggleConfirmPassword}
      />
    </div>
  );
};
