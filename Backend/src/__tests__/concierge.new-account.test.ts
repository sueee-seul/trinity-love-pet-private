import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConciergeCheckoutRequest } from '../contracts/concierge.contract.js';
import { findUserByEmail, type DatabaseAuthUser } from '../repositories/auth.repository.js';
import { resolveOwner } from '../services/concierge/concierge.checkout-checks.js';
import { TEST_SIGNING_SECRET } from './fixtures/concierge.fixtures.js';

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));
vi.mock('../repositories/auth.repository.js', () => ({ findUserByEmail: vi.fn() }));

const OWNER_ID = '00000000-0000-4000-8000-000000000301';
const STRONG_PASSWORD = 'Sunny-days-42';

const existingUser = (overrides: Partial<DatabaseAuthUser> = {}): DatabaseAuthUser => ({
  id: OWNER_ID,
  email: 'ava@example.test',
  username: 'ava',
  name: 'Ava Mitchell',
  is_employee: false,
  is_pet_owner: true,
  staff_role: null,
  is_temporary_password: false,
  ...overrides,
});

/** Only the fields resolveOwner reads; the rest of a checkout request is checked elsewhere. */
const guestRequest = (password = STRONG_PASSWORD): ConciergeCheckoutRequest =>
  ({
    newAccount: { email: 'ava@example.test', password },
    contact: { firstName: 'Ava', lastName: 'Mitchell', phone: '021 555 0199' },
  }) as ConciergeCheckoutRequest;

describe('a first-time guest makes their account at checkout', () => {
  const originalSecret = process.env.CONCIERGE_SIGNING_SECRET;

  beforeEach(() => {
    process.env.CONCIERGE_SIGNING_SECRET = TEST_SIGNING_SECRET;
    vi.mocked(findUserByEmail).mockResolvedValue(null);
  });

  afterEach(() => {
    process.env.CONCIERGE_SIGNING_SECRET = originalSecret;
    vi.clearAllMocks();
  });

  it('takes a new email and a password that meets the sign-up rule', async () => {
    await expect(resolveOwner(guestRequest(), {})).resolves.toEqual({
      email: 'ava@example.test',
      password: STRONG_PASSWORD,
    });
  });

  it('refuses a weak password before looking the email up, and never echoes it', async () => {
    const attempt = resolveOwner(guestRequest('short1'), {});
    await expect(attempt).rejects.toMatchObject({
      code: 'CONCIERGE_PASSWORD_INVALID',
      statusCode: 422,
      details: [{ field: 'newAccount.password', code: 'PASSWORD_INVALID_LENGTH' }],
    });
    await expect(attempt).rejects.not.toHaveProperty('message', expect.stringContaining('short1'));
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it('refuses a password made from the guest’s own name', async () => {
    await expect(resolveOwner(guestRequest('Mitchell-2026'), {})).rejects.toMatchObject({
      code: 'CONCIERGE_PASSWORD_INVALID',
      details: [{ field: 'newAccount.password', code: 'PASSWORD_PERSONAL_INFORMATION' }],
    });
  });

  it('sends an email that already has an account to sign in, so nobody books onto it', async () => {
    vi.mocked(findUserByEmail).mockResolvedValue(existingUser());
    await expect(resolveOwner(guestRequest(), {})).rejects.toMatchObject({
      code: 'CONCIERGE_ACCOUNT_EXISTS',
      statusCode: 409,
    });
  });

  it('refuses a staff email', async () => {
    vi.mocked(findUserByEmail).mockResolvedValue(
      existingUser({ is_employee: true, is_pet_owner: false }),
    );
    await expect(resolveOwner(guestRequest(), {})).rejects.toMatchObject({
      code: 'CONCIERGE_STAFF_EMAIL',
    });
  });

  it('books a signed-in parent on their own account whatever new account the request names', async () => {
    await expect(resolveOwner(guestRequest(), { signedInOwnerId: OWNER_ID })).resolves.toEqual({
      existingOwnerId: OWNER_ID,
    });
    expect(findUserByEmail).not.toHaveBeenCalled();
  });

  it('asks a guest with neither a session nor a new account to sign in or choose a password', async () => {
    await expect(resolveOwner({} as ConciergeCheckoutRequest, {})).rejects.toMatchObject({
      code: 'CONCIERGE_EMAIL_UNVERIFIED',
    });
  });
});
