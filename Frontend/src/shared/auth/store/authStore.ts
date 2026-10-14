import { create } from 'zustand';

export interface User {
  id?: string;
  email: string;
  name?: string;
  is_employee: boolean;
  is_pet_owner: boolean;
  employee_role?: 'manager' | 'staff' | null;
  avatarUrl?: string;
  isUsingTemporaryPassword?: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isHydrating: boolean;
  login: (user: User) => void;
  logout: () => void;
  setHydrating: (isHydrating: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isHydrating: true,
  login: (user): void => {
    set({ user, isAuthenticated: true, isHydrating: false });
  },
  logout: (): void => {
    set({ user: null, isAuthenticated: false, isHydrating: false });
  },
  setHydrating: (isHydrating): void => set({ isHydrating }),
}));
