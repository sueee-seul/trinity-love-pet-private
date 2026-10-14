import { authApi } from '../../../shared/auth/api/authApi';
import { isPetParentAccount } from '../../../shared/auth/accountIdentity';
import { useAuthStore } from '../../../shared/auth/store/authStore';

/** Whether the visitor is a signed-in pet owner, the only account kind that can book. */
export const useSignedInPetOwner = (): boolean =>
  useAuthStore((state) => Boolean(state.user && isPetParentAccount(state.user)));

/**
 * The signed-in parent's name as the account holds it (`pet_owners` first and last name, which the
 * session sends as `name`), so the name they sign the booking terms with is not typed again. Null
 * for a guest, who types it.
 */
export const useSignedInPetOwnerName = (): string | null =>
  useAuthStore((state) =>
    state.user && isPetParentAccount(state.user) ? state.user.name?.trim() || null : null,
  );

/**
 * After the concierge signs someone in (a verified existing account, or a new account at
 * checkout), the rest of the app learns about the new session the same way App does on load.
 */
export const refreshSession = async (): Promise<void> => {
  const result = await authApi.getCurrentUser();
  const user = result.data.data?.user;
  if (result.ok && user) {
    useAuthStore.getState().login(user);
  }
};
