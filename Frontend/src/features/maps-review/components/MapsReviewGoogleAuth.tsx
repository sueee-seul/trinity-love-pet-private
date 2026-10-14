import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  GoogleOAuthProvider,
  useGoogleLogin,
  useGoogleOAuth,
  type CodeResponse,
} from '@react-oauth/google';
import { authApi } from '../../../shared/auth/api/authApi';
import { useReviewerAuth } from '../hooks/useReviewerAuth';
import { MapsReviewGoogleAuthContext } from './mapsReviewGoogleAuthContext';

interface MapsReviewGoogleAuthProviderProps {
  children: React.ReactNode;
  onLoginSuccess: () => void;
}

interface GoogleAuthClientProps {
  onReady: (login: () => void) => void;
  onLoginSuccess: () => void;
  onError: (message: string) => void;
}

const GoogleAuthClient: React.FC<GoogleAuthClientProps> = ({
  onReady,
  onLoginSuccess,
  onError,
}) => {
  const { scriptLoadedSuccessfully } = useGoogleOAuth();
  const { loginWithGoogleCode } = useReviewerAuth({ hydrateOnMount: false });

  const handleCodeResponse = useCallback(
    async (response: CodeResponse): Promise<void> => {
      if (!response.code) {
        onError('Google login failed. Please try again.');
        return;
      }

      const result = await loginWithGoogleCode(response.code);
      if (result.success) {
        onLoginSuccess();
        return;
      }

      onError(result.message ?? 'Google login failed. Please try again.');
    },
    [loginWithGoogleCode, onError, onLoginSuccess],
  );

  const login = useGoogleLogin({
    flow: 'auth-code',
    ux_mode: 'popup',
    select_account: true,
    onSuccess: (response) => void handleCodeResponse(response),
    onError: () => onError('Google login failed. Please try again.'),
    onNonOAuthError: () => onError('Google login popup could not be opened. Please try again.'),
  });

  useEffect(() => {
    if (scriptLoadedSuccessfully) {
      onReady(login);
    }
  }, [login, onReady, scriptLoadedSuccessfully]);

  return null;
};

export const MapsReviewGoogleAuthProvider: React.FC<MapsReviewGoogleAuthProviderProps> = ({
  children,
  onLoginSuccess,
}) => {
  const [clientId, setClientId] = useState<string | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [loginAction, setLoginAction] = useState<(() => void) | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const pendingLoginRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const loadClientConfig = async (): Promise<void> => {
      try {
        const result = await authApi.getGoogleConfig();
        if (!isMounted) {
          return;
        }

        if (result.data?.clientId) {
          setClientId(result.data.clientId);
        } else {
          setLoginError('Google login is unavailable right now. Please try again.');
        }
      } catch {
        if (isMounted) {
          setLoginError('Google login is unavailable right now. Please try again.');
        }
      } finally {
        if (isMounted) {
          setIsLoadingConfig(false);
        }
      }
    };

    void loadClientConfig();
    return (): void => {
      isMounted = false;
    };
  }, []);

  const registerLogin = useCallback((login: () => void): void => {
    setLoginAction(() => login);
  }, []);

  const reportLoginError = useCallback((message: string): void => {
    pendingLoginRef.current = false;
    setLoginError(message);
  }, []);

  const requestLogin = useCallback((): void => {
    setLoginError(null);
    if (loginAction) {
      loginAction();
      return;
    }

    if (isLoadingConfig) {
      pendingLoginRef.current = true;
      return;
    }

    setLoginError('Google login is unavailable right now. Please try again.');
  }, [isLoadingConfig, loginAction]);

  useEffect(() => {
    if (!loginAction || !pendingLoginRef.current) {
      return;
    }

    pendingLoginRef.current = false;
    loginAction();
  }, [loginAction]);

  const clearLoginError = useCallback((): void => setLoginError(null), []);
  const contextValue = useMemo(
    () => ({ requestLogin, loginError, clearLoginError }),
    [clearLoginError, loginError, requestLogin],
  );

  return (
    <MapsReviewGoogleAuthContext.Provider value={contextValue}>
      {children}
      {clientId && (
        <GoogleOAuthProvider clientId={clientId}>
          <GoogleAuthClient
            onReady={registerLogin}
            onLoginSuccess={onLoginSuccess}
            onError={reportLoginError}
          />
        </GoogleOAuthProvider>
      )}
    </MapsReviewGoogleAuthContext.Provider>
  );
};
