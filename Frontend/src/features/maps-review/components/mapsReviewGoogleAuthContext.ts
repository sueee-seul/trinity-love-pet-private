import { createContext, useContext } from 'react';

export interface MapsReviewGoogleAuthContextValue {
  requestLogin: () => void;
  loginError: string | null;
  clearLoginError: () => void;
}

export const MapsReviewGoogleAuthContext = createContext<MapsReviewGoogleAuthContextValue | null>(
  null,
);

export const useMapsReviewGoogleAuth = (): MapsReviewGoogleAuthContextValue => {
  const context = useContext(MapsReviewGoogleAuthContext);
  if (!context) {
    throw new Error('useMapsReviewGoogleAuth must be used within MapsReviewGoogleAuthProvider');
  }

  return context;
};
