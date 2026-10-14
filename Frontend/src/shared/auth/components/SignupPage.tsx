import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSiteCopy } from '../../i18n/siteLanguage';
import { authApi } from '../api/authApi';
import { AUTH_COPY, type AuthText } from '../authCopy';
import { AuthLayout } from './AuthLayout';
import { SignupAccountStep } from './SignupAccountStep';
import { SignupProfileStep } from './SignupProfileStep';
import type { SignupDraft, SignupErrors, SignupValidationRequest } from './signupTypes';

type SignupStep = 'ACCOUNT' | 'PROFILE';

const INITIAL_DRAFT: SignupDraft = {
  email: '',
  username: '',
  password: '',
  confirmPassword: '',
  emergencyContactNumber: '',
  firstName: '',
  lastName: '',
  address: '',
  dateOfBirth: '',
};

const hasErrors = (errors: SignupErrors): boolean => Object.keys(errors).length > 0;

const hasAccountErrors = (errors: SignupErrors): boolean => {
  return Boolean(errors.email || errors.username || errors.password || errors.confirmPassword);
};

const getFieldErrors = (result: {
  data: { data?: { fieldErrors?: SignupErrors } | null };
}): SignupErrors => {
  return result.data.data?.fieldErrors ?? {};
};

export function SignupPage(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const googleState = location.state as {
    googleUser?: { email: string; firstName: string; lastName: string };
    idToken?: string;
  } | null;
  const isGoogleSignup = Boolean(googleState?.googleUser && googleState?.idToken);

  const [step, setStep] = useState<SignupStep>(isGoogleSignup ? 'PROFILE' : 'ACCOUNT');
  const [draft, setDraft] = useState<SignupDraft>({
    ...INITIAL_DRAFT,
    ...(isGoogleSignup
      ? {
          email: googleState?.googleUser?.email ?? '',
          firstName: googleState?.googleUser?.firstName ?? '',
          lastName: googleState?.googleUser?.lastName ?? '',
        }
      : {}),
  });
  const [errors, setErrors] = useState<SignupErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Kept as what happened, so the words follow a language switch.
  const [requestError, setRequestError] = useState<{ text: AuthText } | null>(null);
  const copy = useSiteCopy(AUTH_COPY);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateField = <K extends keyof SignupDraft>(field: K, value: SignupDraft[K]): void => {
    setDraft((currentDraft) => ({ ...currentDraft, [field]: value }));
    setErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };
      delete nextErrors[field];
      return nextErrors;
    });
    setRequestError(null);
  };

  const requestBackendValidation = async (
    payload: SignupValidationRequest,
  ): Promise<SignupErrors> => {
    const result = await authApi.validateSignup(payload);
    const nextErrors = getFieldErrors(result);

    if (!result.ok && !hasErrors(nextErrors)) {
      const message = result.data.msg;
      setRequestError({ text: (words) => words.fromServer(message, words.signup.fixFields) });
    }

    return nextErrors;
  };

  const handleAccountNext = async (): Promise<void> => {
    setIsSubmitting(true);
    setRequestError(null);

    try {
      const nextErrors = await requestBackendValidation({
        step: 'account',
        email: draft.email,
        username: draft.username,
        password: draft.password,
        confirmPassword: draft.confirmPassword,
      });
      setErrors(nextErrors);

      if (!hasErrors(nextErrors)) {
        setStep('PROFILE');
      }
    } catch {
      setRequestError({ text: (words) => words.signup.validateUnavailable });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProfileSubmit = async (): Promise<void> => {
    setIsSubmitting(true);
    setRequestError(null);

    const formattedPhone = draft.emergencyContactNumber.trim()
      ? '+64 ' + draft.emergencyContactNumber.trim().replace(/^0+/, '')
      : '';

    try {
      let nextErrors: SignupErrors = {};

      const payload: Extract<SignupValidationRequest, { step: 'profile' }> = {
        step: 'profile',
        email: draft.email,
        username: draft.username,
        password: draft.password,
        confirmPassword: draft.confirmPassword,
        emergencyContactNumber: formattedPhone,
        firstName: draft.firstName,
        lastName: draft.lastName,
        address: draft.address,
        dateOfBirth: draft.dateOfBirth,
      };

      if (!isGoogleSignup) {
        nextErrors = await requestBackendValidation(payload);
        setErrors(nextErrors);
      }

      if (!hasErrors(nextErrors)) {
        let creationResult: Awaited<ReturnType<typeof authApi.createAccount>>;
        try {
          if (isGoogleSignup && googleState?.idToken) {
            creationResult = await authApi.googleSignup(googleState.idToken, payload);
          } else {
            creationResult = await authApi.createAccount(payload);
          }
        } catch {
          setRequestError({ text: (words) => words.signup.createUnavailable });
          return;
        }

        const creationErrors = creationResult.data.data?.fieldErrors ?? {};
        setErrors(creationErrors);

        if (!creationResult.ok) {
          const message = creationResult.data.msg;
          setRequestError({
            text: (words) => words.fromServer(message, words.signup.createFailed),
          });
          return;
        }

        navigate('/login', {
          state: {
            notice: { type: 'success', kind: 'accountCreated' },
          },
        });
      } else if (hasAccountErrors(nextErrors)) {
        setStep('ACCOUNT');
      }
    } catch {
      setRequestError({ text: (words) => words.signup.processUnavailable });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    if (step === 'ACCOUNT') {
      void handleAccountNext();
    } else {
      void handleProfileSubmit();
    }
  };

  const handleBack = (): void => {
    if (isSubmitting) {
      return;
    }

    if (step === 'PROFILE' && !isGoogleSignup) {
      setStep('ACCOUNT');
      setErrors({});
      setRequestError(null);
      return;
    }

    navigate('/login');
  };

  const title = step === 'ACCOUNT' ? copy.signup.titleAccount : copy.signup.titleProfile;
  const subtitle = isGoogleSignup
    ? copy.signup.subtitleGoogle
    : step === 'ACCOUNT'
      ? copy.signup.subtitleAccount
      : copy.signup.subtitleProfile;

  return (
    <AuthLayout title={title} subtitle={subtitle} footerLabel={copy.signup.footer}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col">
        {step === 'ACCOUNT' ? (
          <SignupAccountStep
            draft={draft}
            errors={errors}
            showPassword={showPassword}
            showConfirmPassword={showConfirmPassword}
            onEmailChange={(value) => updateField('email', value)}
            onUsernameChange={(value) => updateField('username', value)}
            onPasswordChange={(value) => updateField('password', value)}
            onConfirmPasswordChange={(value) => updateField('confirmPassword', value)}
            onTogglePassword={() => setShowPassword((visible) => !visible)}
            onToggleConfirmPassword={() => setShowConfirmPassword((visible) => !visible)}
          />
        ) : (
          <SignupProfileStep
            draft={draft}
            errors={errors}
            onEmergencyContactNumberChange={(value) => updateField('emergencyContactNumber', value)}
            onFirstNameChange={(value) => updateField('firstName', value)}
            onLastNameChange={(value) => updateField('lastName', value)}
            onAddressChange={(value) => updateField('address', value)}
            onDateOfBirthChange={(value) => updateField('dateOfBirth', value)}
          />
        )}

        {requestError && (
          <div
            role="alert"
            className="mt-5 rounded-xl bg-theme-peach px-4 py-3 type-meta font-bold text-status-danger"
          >
            {requestError.text(copy)}
          </div>
        )}

        <div className="mt-10 flex items-center justify-between md:mt-14">
          <button
            type="button"
            onClick={handleBack}
            disabled={isSubmitting}
            className="-ml-4 rounded-full px-4 py-2 type-button text-accent-foreground transition-colors hover:bg-surface-cream hover:text-accent-foreground-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {step === 'PROFILE' ? copy.signup.back : copy.signup.backToSignIn}
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-action-dark theme-gradient-action px-6 py-2 type-button text-on-action-dark transition-colors hover:bg-action-dark-hover focus:outline-none focus:ring-2 focus:ring-focus focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting
              ? copy.signup.checking
              : step === 'ACCOUNT'
                ? copy.signup.next
                : copy.signup.createAccount}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
