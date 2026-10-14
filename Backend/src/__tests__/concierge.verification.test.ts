import { describe, expect, it, vi } from 'vitest';
import {
  CODE_TTL_MS,
  ConciergeVerificationStore,
  FIRST_LOCK_MS,
  MAX_ATTEMPTS_PER_CODE,
  MAX_FAILURES_PER_EMAIL,
  MAX_STARTS_PER_EMAIL,
  RESEND_COOLDOWN_MS,
  START_WINDOW_MS,
} from '../services/concierge/concierge.verification.js';
import {
  createConciergeEmailSender,
  DevelopmentConsoleEmailSender,
  maskEmail,
} from '../services/concierge/concierge.email.js';

const EMAIL = 'ava@example.test';

interface TestStore {
  store: ConciergeVerificationStore;
  sendVerificationCode: ReturnType<typeof vi.fn>;
}

const createStore = (clock: { now: number }): TestStore => {
  const sendVerificationCode = vi.fn(async (): Promise<void> => undefined);
  const store = new ConciergeVerificationStore({
    secret: 'test-secret',
    sender: { sendVerificationCode },
    now: (): number => clock.now,
    generateCode: (): string => '123456',
  });
  return { store, sendVerificationCode };
};

const guessWrong = (store: ConciergeVerificationStore, times: number): void => {
  for (let attempt = 0; attempt < times; attempt += 1) {
    expect(() => store.confirm(EMAIL, '000000')).toThrow();
  }
};

describe('ConciergeVerificationStore', () => {
  it('sends a code and accepts it once', async () => {
    const clock = { now: 1_000 };
    const { store, sendVerificationCode } = createStore(clock);

    await store.start(EMAIL);
    expect(sendVerificationCode).toHaveBeenCalledWith({
      to: EMAIL,
      code: '123456',
      expiresInMinutes: 10,
    });

    expect(() => store.confirm(EMAIL, '123456')).not.toThrow();
    expect(() => store.confirm(EMAIL, '123456')).toThrow(/not right or has expired/);
  });

  it('refuses a resend inside the cooldown', async () => {
    const clock = { now: 1_000 };
    const { store } = createStore(clock);

    await store.start(EMAIL);
    await expect(store.start(EMAIL)).rejects.toMatchObject({ code: 'CONCIERGE_CODE_COOLDOWN' });

    clock.now += RESEND_COOLDOWN_MS;
    await expect(store.start(EMAIL)).resolves.toBeUndefined();
  });

  it('burns the code after too many wrong guesses', async () => {
    const clock = { now: 1_000 };
    const { store } = createStore(clock);
    await store.start(EMAIL);

    guessWrong(store, MAX_ATTEMPTS_PER_CODE);

    expect(() => store.confirm(EMAIL, '123456')).toThrow(/not right or has expired/);
  });

  it('does not restore spent attempts when a new code is sent', async () => {
    const clock = { now: 1_000 };
    const { store } = createStore(clock);
    await store.start(EMAIL);
    guessWrong(store, MAX_ATTEMPTS_PER_CODE - 1);

    clock.now += RESEND_COOLDOWN_MS;
    await store.start(EMAIL);
    guessWrong(store, 1);

    // The resend kept the one remaining attempt, so the new code is already used up.
    expect(() => store.confirm(EMAIL, '123456')).toThrow(/not right or has expired/);
  });

  it('locks an email after repeated failures across many codes', async () => {
    const clock = { now: 1_000 };
    const { store } = createStore(clock);

    for (let failures = 0; failures < MAX_FAILURES_PER_EMAIL; failures += 1) {
      await store.start(EMAIL);
      guessWrong(store, 1);
      clock.now += START_WINDOW_MS / MAX_STARTS_PER_EMAIL + RESEND_COOLDOWN_MS;
    }

    await expect(store.start(EMAIL)).rejects.toMatchObject({ code: 'CONCIERGE_CODE_LOCKED' });
  });

  it('keeps a spent code until it expires, so the resend cooldown still applies', async () => {
    const clock = { now: 1_000 };
    const { store } = createStore(clock);
    await store.start(EMAIL);
    guessWrong(store, MAX_ATTEMPTS_PER_CODE);

    await expect(store.start(EMAIL)).rejects.toMatchObject({ code: 'CONCIERGE_CODE_COOLDOWN' });
    expect(() => store.confirm(EMAIL, '123456')).toThrow(/not right or has expired/);
  });

  it('lifts the first lock after a short while instead of a whole day', async () => {
    const clock = { now: 1_000 };
    const { store } = createStore(clock);
    for (let failures = 0; failures < MAX_FAILURES_PER_EMAIL; failures += 1) {
      await store.start(EMAIL);
      guessWrong(store, 1);
      clock.now += START_WINDOW_MS / MAX_STARTS_PER_EMAIL + RESEND_COOLDOWN_MS;
    }
    await expect(store.start(EMAIL)).rejects.toMatchObject({ code: 'CONCIERGE_CODE_LOCKED' });

    clock.now += FIRST_LOCK_MS;
    await expect(store.start(EMAIL)).resolves.toBeUndefined();
  });

  it('limits how many codes one email can be sent per hour', async () => {
    const clock = { now: 1_000 };
    const { store } = createStore(clock);

    for (let start = 0; start < MAX_STARTS_PER_EMAIL; start += 1) {
      await store.start(EMAIL);
      clock.now += RESEND_COOLDOWN_MS;
    }

    await expect(store.start(EMAIL)).rejects.toMatchObject({ code: 'CONCIERGE_CODE_TOO_MANY' });
    clock.now += START_WINDOW_MS;
    await expect(store.start(EMAIL)).resolves.toBeUndefined();
  });

  it('rejects an expired code', async () => {
    const clock = { now: 1_000 };
    const { store } = createStore(clock);
    await store.start(EMAIL);

    clock.now += CODE_TTL_MS;

    expect(() => store.confirm(EMAIL, '123456')).toThrow(/not right or has expired/);
  });

  it('does not store the code when sending fails', async () => {
    const clock = { now: 1_000 };
    const store = new ConciergeVerificationStore({
      secret: 'test-secret',
      sender: {
        sendVerificationCode: async (): Promise<void> => Promise.reject(new Error('smtp down')),
      },
      now: (): number => clock.now,
      generateCode: (): string => '123456',
    });

    await expect(store.start(EMAIL)).rejects.toThrow('smtp down');
    expect(() => store.confirm(EMAIL, '123456')).toThrow();
  });
});

describe('concierge email sender', () => {
  it('masks the address it prints', async () => {
    const lines: string[] = [];
    await new DevelopmentConsoleEmailSender((line) => lines.push(line)).sendVerificationCode({
      to: 'ava.mitchell@example.test',
      code: '654321',
      expiresInMinutes: 10,
    });

    expect(maskEmail('ava.mitchell@example.test')).toBe('av***@example.test');
    expect(lines[0]).toContain('av***@example.test');
    expect(lines[0]).not.toContain('ava.mitchell');
  });

  it('prints codes only when console mode is chosen explicitly outside production', () => {
    expect(
      createConciergeEmailSender({ CONCIERGE_EMAIL_MODE: 'console', NODE_ENV: 'development' }),
    ).toBeInstanceOf(DevelopmentConsoleEmailSender);
    // A deployment that forgot NODE_ENV must not start writing codes to its logs.
    expect(() => createConciergeEmailSender({})).toThrow(/not available yet/);
    expect(() =>
      createConciergeEmailSender({ CONCIERGE_EMAIL_MODE: 'console', NODE_ENV: 'production' }),
    ).toThrow(/not available yet/);
  });
});
