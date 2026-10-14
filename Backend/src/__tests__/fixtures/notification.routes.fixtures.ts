import { AUTH_COOKIE_NAME, createSessionToken } from '../../services/auth.session.js';

// Accounts and session cookies shared by the notification route tests. Each test file mocks
// `findUserById` from auth.repository with `findTestUser`, so a cookie resolves to one of these.

export const OWNER = {
  id: '00000000-0000-4000-8000-000000000301',
  email: 'owner@example.test',
  username: 'owner.one',
  name: 'Owner One',
  is_employee: false,
  is_pet_owner: true,
  staff_role: null,
};
export const OTHER_OWNER = {
  ...OWNER,
  id: '00000000-0000-4000-8000-000000000302',
  username: 'owner.two',
};
export const STAFF = {
  ...OWNER,
  id: '00000000-0000-4000-8000-000000000303',
  username: 'staff.one',
  is_employee: true,
  is_pet_owner: false,
  staff_role: 'staff',
};
export const MANAGER = {
  ...STAFF,
  id: '00000000-0000-4000-8000-000000000304',
  username: 'manager.one',
  staff_role: 'manager',
};

const USERS = [OWNER, OTHER_OWNER, STAFF, MANAGER];

export const findTestUser = async (id: string): Promise<(typeof USERS)[number] | null> =>
  USERS.find((user) => user.id === id) ?? null;

export const useTestSessionSecret = (): void => {
  process.env.AUTH_SESSION_SECRET = 'notification-route-test-secret';
  process.env.AUTH_SESSION_VERSION = '1';
};

export const cookieFor = async (user: { id: string }): Promise<string> =>
  `${AUTH_COOKIE_NAME}=${await createSessionToken(user.id)}`;
