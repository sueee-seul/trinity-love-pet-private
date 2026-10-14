import { useState, useEffect } from 'react';
import type { CredentialResponse } from '@react-oauth/google';
import { authApi } from '../api/authApi';

interface EmailCheckResult {
  success: boolean;
  msg?: string;
}

interface AuthActionResult {
  success: boolean;
  data: Awaited<ReturnType<typeof authApi.loginWithPassword>>['data'];
}

interface AuthLoginState {
  clientId: string;
  /** True when the Backend has no real Google client ID, so the Google button cannot work. */
  googleUnavailable: boolean;
  checkEmail: (email: string) => Promise<EmailCheckResult>;
  loginWithPassword: (email: string, password: string) => Promise<AuthActionResult>;
  loginWithGoogle: (credentialResponse: CredentialResponse) => Promise<AuthActionResult>;
}

export function useAuthLogin(): AuthLoginState {
  const [clientId, setClientId] = useState('');
  const [googleUnavailable, setGoogleUnavailable] = useState(false);

  useEffect(() => {
    authApi
      .getGoogleConfig()
      .then((data) => {
        if (data?.data?.clientId) {
          setClientId(data.data.clientId);
        } else {
          setGoogleUnavailable(true);
        }
      })
      .catch((err) => {
        console.error(err);
        setGoogleUnavailable(true);
      });
  }, []);

  const checkEmail = async (email: string): Promise<EmailCheckResult> => {
    const { ok, data } = await authApi.checkEmail(email);
    if (ok) {
      return { success: true };
    } else {
      return { success: false, msg: data.msg };
    }
  };

  const loginWithPassword = async (email: string, password: string): Promise<AuthActionResult> => {
    const { ok, data } = await authApi.loginWithPassword(email, password);
    return { success: ok, data };
  };

  const loginWithGoogle = async (
    credentialResponse: CredentialResponse,
  ): Promise<AuthActionResult> => {
    const { ok, data } = await authApi.loginWithGoogle(credentialResponse);
    return { success: ok, data };
  };

  return {
    clientId,
    googleUnavailable,
    checkEmail,
    loginWithPassword,
    loginWithGoogle,
  };
}
