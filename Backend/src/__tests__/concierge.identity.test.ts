import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DatabaseAuthUser } from '../repositories/auth.repository.js';
import { confirmEmailAndResolveIdentity } from '../services/concierge/concierge.identity.js';
import { verifyVerifiedEmail } from '../services/concierge/concierge.tokens.js';
import { ConciergeVerificationStore } from '../services/concierge/concierge.verification.js';
import { TEST_SIGNING_SECRET } from './fixtures/concierge.fixtures.js';

vi.mock('../config/database.js', () => ({ pool: { query: vi.fn(), connect: vi.fn() } }));

const EMAIL = 'ava@example.test';

const owner = (overrides: Partial<DatabaseAuthUser> = {}): DatabaseAuthUser => ({
  id: '00000000-0000-4000-8000-000000000301',
  email: EMAIL,
  username: 'ava',
  name: 'Ava',
  is_employee: false,
  is_pet_owner: true,
  staff_role: null,
  is_temporary_password: false,
  ...overrides,
});

const storeWithCode = async (): Promise<ConciergeVerificationStore> => {
  const store = new ConciergeVerificationStore({
    secret: 'test-secret',
    sender: { sendVerificationCode: async (): Promise<void> => undefined },
    generateCode: (): string => '123456',
  });
  await store.start(EMAIL);
  return store;
};

describe('confirmEmailAndResolveIdentity', () => {
  const originalSecret = process.env.CONCIERGE_SIGNING_SECRET;

  beforeEach(() => {
    process.env.CONCIERGE_SIGNING_SECRET = TEST_SIGNING_SECRET;
  });

  afterEach(() => {
    process.env.CONCIERGE_SIGNING_SECRET = originalSecret;
  });

  it('signs in an existing pet owner who proves the email', async () => {
    const identity = await confirmEmailAndResolveIdentity(EMAIL, '123456', {
      store: await storeWithCode(),
      findUser: async (): Promise<DatabaseAuthUser> => owner(),
      hasPassword: async (): Promise<boolean> => false,
    });

    expect(identity).toEqual({ kind: 'existing_owner', ownerId: owner().id });
  });

  it('never signs into an account that has a password, since sign-up does not prove the email', async () => {
    await expect(
      confirmEmailAndResolveIdentity(EMAIL, '123456', {
        store: await storeWithCode(),
        findUser: async (): Promise<DatabaseAuthUser> => owner(),
        hasPassword: async (): Promise<boolean> => true,
      }),
    ).rejects.toMatchObject({ code: 'CONCIERGE_PASSWORD_ACCOUNT', statusCode: 409 });
  });

  it('gives a new email a verified-email token for checkout', async () => {
    const identity = await confirmEmailAndResolveIdentity(EMAIL, '123456', {
      store: await storeWithCode(),
      findUser: async (): Promise<null> => null,
    });

    expect(identity.kind).toBe('new_email');
    if (identity.kind === 'new_email') {
      expect(await verifyVerifiedEmail(identity.verificationToken)).toBe(EMAIL);
    }
  });

  it('refuses a staff email', async () => {
    await expect(
      confirmEmailAndResolveIdentity(EMAIL, '123456', {
        store: await storeWithCode(),
        findUser: async (): Promise<DatabaseAuthUser> =>
          owner({ is_employee: true, is_pet_owner: false, staff_role: 'staff' }),
      }),
    ).rejects.toMatchObject({ code: 'CONCIERGE_STAFF_EMAIL' });
  });

  it('looks nobody up when the code is wrong', async () => {
    const findUser = vi.fn(async (): Promise<null> => null);

    await expect(
      confirmEmailAndResolveIdentity(EMAIL, '000000', { store: await storeWithCode(), findUser }),
    ).rejects.toMatchObject({ code: 'CONCIERGE_CODE_INVALID' });
    expect(findUser).not.toHaveBeenCalled();
  });
});
