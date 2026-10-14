import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { conciergeApi } from '../api/conciergeApi';
import { ConciergePage } from '../components/ConciergePage';
import { resetConciergeStatusCache } from '../hooks/useConciergeStatus';
import { useConciergeStore } from '../store/conciergeStore';
import type { ConciergeLocale } from '../types';
import { statusResponse } from './fixtures';
import { SiteLanguageProvider } from '../../../app/SiteLanguageProvider';
import { AccessibilityWidget } from '../../../shared/accessibility';

vi.mock('../api/conciergeApi', () => ({
  conciergeApi: {
    chat: vi.fn(),
    acceptQuote: vi.fn(),
    checkout: vi.fn(),
    status: vi.fn(),
    rates: vi.fn(),
    catalogue: vi.fn(),
    myPets: vi.fn(),
  },
}));

vi.mock('../hooks/useSignedInPetOwner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useSignedInPetOwner')>()),
  refreshSession: vi.fn(async () => undefined),
}));

/** LOCALE_KEY in conciergeStore.ts. Guests' saved choices live under it, so it must not change. */
const SAVED_LOCALE_KEY = 'trinity-concierge-locale';

/**
 * The store picks its language once, when its module is first loaded. A fresh copy of the module
 * is the only honest way to see what a new visitor gets.
 */
const localeOnFirstVisit = async (): Promise<ConciergeLocale> => {
  vi.resetModules();
  const freshStore = await import('../store/conciergeStore');
  return freshStore.useConciergeStore.getState().locale;
};

const pretendBrowserLanguages = (languages: string[]): void => {
  vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(languages);
  vi.spyOn(window.navigator, 'language', 'get').mockReturnValue(languages[0] ?? '');
};

describe('concierge language on a first visit', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('opens in English even when the browser prefers Chinese', async () => {
    pretendBrowserLanguages(['zh-CN', 'zh']);

    expect(await localeOnFirstVisit()).toBe('en');
  });

  it('opens in Chinese when the link says ?lang=zh', async () => {
    window.history.replaceState(null, '', '/book?lang=zh');

    expect(await localeOnFirstVisit()).toBe('zh');
  });

  it('opens in Chinese when the guest chose Chinese before', async () => {
    window.localStorage.setItem(SAVED_LOCALE_KEY, 'zh');

    expect(await localeOnFirstVisit()).toBe('zh');
  });

  it('lets the link win over an earlier choice', async () => {
    window.localStorage.setItem(SAVED_LOCALE_KEY, 'zh');
    window.history.replaceState(null, '', '/book?lang=en');

    expect(await localeOnFirstVisit()).toBe('en');
  });
});

describe('page language on <html>', () => {
  const LANG_BEFORE_THE_PAGE = 'en-GB';

  beforeEach(() => {
    document.documentElement.lang = LANG_BEFORE_THE_PAGE;
    useConciergeStore.getState().reset();
    useConciergeStore.getState().setLocale('en');
    resetConciergeStatusCache();
    vi.mocked(conciergeApi.status).mockResolvedValue(
      statusResponse({ contact: { email: 'bookings@wagstay.com', phone: '09 555 0100' } }),
    );
    vi.mocked(conciergeApi.rates).mockResolvedValue({
      fromTotal: 45,
      nights: 1,
      currency: 'NZD',
      gstInclusive: true,
    });
  });

  afterEach(() => {
    document.documentElement.lang = 'en';
  });

  it('follows the language switch in the accessibility tools', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/book']}>
        <SiteLanguageProvider>
          <ConciergePage variant="standalone" />
          <AccessibilityWidget />
        </SiteLanguageProvider>
      </MemoryRouter>,
    );

    expect(document.documentElement.lang).toBe('en-NZ');

    // The switch lives in the accessibility tools, the same place on every page.
    await user.click(screen.getByRole('button', { name: 'Open accessibility tools' }));
    await user.click(screen.getByRole('button', { name: 'Switch to Chinese' }));
    expect(document.documentElement.lang).toBe('zh-Hans');

    await user.click(screen.getByRole('button', { name: '切换到英文' }));
    expect(document.documentElement.lang).toBe('en-NZ');
  });
});
