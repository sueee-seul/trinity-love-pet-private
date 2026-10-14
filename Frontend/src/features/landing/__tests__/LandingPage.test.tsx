import { act, render, screen, within, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccessibilityStore } from '../../../shared/accessibility';
import { useAuthStore, type User } from '../../../shared/auth/store/authStore';
import { BRAND_MARK_SRC } from '../../../shared/brand/BrandMark';
import { useBrandThemeStore } from '../../../shared/theme';
import { conciergeApi } from '../../concierge/api/conciergeApi';
import { resetConciergeStatusCache } from '../../concierge/hooks/useConciergeStatus';
import { statusResponse } from '../../concierge/__tests__/fixtures';
import { useConciergeStore } from '../../concierge/store/conciergeStore';
import type { Service } from '../../pet-parent/types/booking';
import { SiteLanguageProvider } from '../../../app/SiteLanguageProvider';
import { englishWordsIn } from '../../../shared/i18n/testing/englishWordsIn';
import { LandingPage } from '../components/LandingPage';

vi.mock('../../concierge/api/conciergeApi', () => ({
  conciergeApi: {
    chat: vi.fn(),
    acceptQuote: vi.fn(),
    checkout: vi.fn(),
    status: vi.fn(),
    rates: vi.fn(),
    catalogue: vi.fn(),
    myPets: vi.fn(),
    startVerification: vi.fn(),
    confirmVerification: vi.fn(),
  },
}));

/** LOCALE_KEY in conciergeStore.ts: the landing page and /book share the guest's choice. */
const SAVED_LOCALE_KEY = 'trinity-concierge-locale';

const EN_TITLE = 'A happy stay for your dog or cat';
const ZH_TITLE = '让狗狗和猫咪住得开心';

const petOwner: User = {
  id: 'parent-1',
  email: 'parent@example.test',
  is_employee: false,
  is_pet_owner: true,
  employee_role: null,
};

const catalogue: Service[] = [
  {
    id: 'room',
    name: 'Garden suite',
    category: 'boarding_rate',
    price: 60,
    priceUnit: 'per night',
    compulsory: false,
  },
  {
    id: 'food',
    name: 'House food',
    category: 'food',
    price: 8,
    priceUnit: 'per day',
    compulsory: true,
  },
  {
    id: 'walk',
    name: 'Daily walk',
    category: 'addon',
    price: 15,
    priceUnit: 'per walk',
    compulsory: false,
  },
];

// The app's language provider is there too, as in the app: shared parts take their words from it.
const renderLanding = (page: React.ReactElement = <LandingPage />): RenderResult =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <SiteLanguageProvider>{page}</SiteLanguageProvider>
    </MemoryRouter>,
  );

/** Waits for the assistant's status, so every section is drawn before a test looks at the page. */
const renderLoadedLanding = async (): Promise<RenderResult> => {
  const result = renderLanding();
  await act(async () => {
    await Promise.resolve();
  });
  return result;
};

describe('LandingPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    useConciergeStore.getState().setLocale('en');
    useAuthStore.getState().logout();
    useBrandThemeStore.getState().setTheme('simple');
    useAccessibilityStore.getState().setContrastTheme('default');
    resetConciergeStatusCache();
    vi.mocked(conciergeApi.status).mockResolvedValue(statusResponse());
    vi.mocked(conciergeApi.rates).mockResolvedValue({
      fromTotal: 45,
      nights: 1,
      currency: 'NZD',
      gstInclusive: true,
    });
    vi.mocked(conciergeApi.catalogue).mockResolvedValue(catalogue);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '', '/');
  });

  it('opens in English even when the browser prefers Chinese', async () => {
    vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['zh-CN', 'zh']);
    vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('zh-CN');
    window.localStorage.clear();
    // The language is chosen once, when the store starts: a fresh copy is a first visit.
    vi.resetModules();
    const fresh = await import('../components/LandingPage');

    renderLanding(<fresh.LandingPage />);

    expect(screen.getByRole('heading', { level: 1, name: EN_TITLE })).toBeInTheDocument();
    expect(document.title).toBe('Wagstay | Boarding for dogs and cats');
  });

  it('opens in Chinese when the link says ?lang=zh', async () => {
    window.history.replaceState(null, '', '/?lang=zh');
    vi.resetModules();
    const fresh = await import('../components/LandingPage');

    renderLanding(<fresh.LandingPage />);

    expect(screen.getByRole('heading', { level: 1, name: ZH_TITLE })).toBeInTheDocument();
  });

  // The themes decorate one word of the title. What a screen reader hears must not change.
  it('wraps one word of the title in both languages, keeping the title whole', async () => {
    renderLanding();

    const english = screen.getByRole('heading', { level: 1, name: EN_TITLE });
    expect(english.querySelector('.theme-accent-word')).toHaveTextContent(/^happy$/);

    act(() => useConciergeStore.getState().setLocale('zh'));

    const chinese = screen.getByRole('heading', { level: 1, name: ZH_TITLE });
    expect(chinese.querySelector('.theme-accent-word')).toHaveTextContent(/^开心$/);
  });

  it('switches to Chinese, saves the choice for /book, and restores the tab on leaving', async () => {
    document.title = 'Before';
    const page = renderLanding();

    act(() => useConciergeStore.getState().setLocale('zh'));

    expect(screen.getByRole('heading', { level: 1, name: ZH_TITLE })).toBeInTheDocument();
    expect(window.localStorage.getItem(SAVED_LOCALE_KEY)).toBe('zh');
    expect(document.title).toBe('Wagstay | 狗狗和猫咪寄养');
    // "Daily walk" is a test service the real price list does not have.
    expect(englishWordsIn(document.body, ['Daily', 'walk'])).toEqual([]);

    page.unmount();
    expect(document.title).toBe('Before');
  });

  it('promises confirmation when there is room, and names the stays our manager checks first', async () => {
    await renderLoadedLanding();
    expect(
      screen.getByRole('heading', { name: 'Confirmed when there is room' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'A stay is confirmed as soon as you send it, if there is room. If your pet takes medication, our manager checks the stay first.',
      ),
    ).toBeInTheDocument();
    act(() => useConciergeStore.getState().setLocale('zh'));
    expect(screen.getByRole('heading', { name: '有空位就确认' })).toBeInTheDocument();
    expect(
      screen.getByText('有空位的话，提交后立即确认。如果宠物需要用药，经理会先审核。'),
    ).toBeInTheDocument();
  });

  it('sends every "Plan a stay" to the booking page', async () => {
    await renderLoadedLanding();

    const links = screen.getAllByRole('link', { name: 'Plan a stay' });
    expect(links.length).toBeGreaterThanOrEqual(3);
    for (const link of links) expect(link).toHaveAttribute('href', '/book');
  });

  it('labels the example care clip as play time and AI-made, and never autoplays it', async () => {
    await renderLoadedLanding();

    const clip = screen.getByLabelText('Example video of a dog playing with a rope toy');
    expect(clip.tagName).toBe('VIDEO');
    expect(clip).not.toHaveAttribute('autoplay');
    expect(screen.getByText('Play time · 1:15 pm')).toBeInTheDocument();
    expect(
      screen.getByText('An example, not a real pet. The video and photos are made with AI.'),
    ).toBeInTheDocument();
  });

  it('has no price section, and sends every price link to /book', async () => {
    await renderLoadedLanding();

    expect(document.getElementById('prices')).toBeNull();
    expect(screen.queryByText('Prices you can see today')).not.toBeInTheDocument();
    expect(screen.queryByText('Rooms, food and extras')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See prices' })).toHaveAttribute('href', '/book');
    for (const link of screen.getAllByRole('link', { name: 'Prices' })) {
      expect(link).toHaveAttribute('href', '/book');
    }
  });

  it('switches the whole site to the theme chosen, and turns off a reading colour', async () => {
    const user = userEvent.setup();
    useAccessibilityStore.getState().setContrastTheme('dark');
    renderLanding();
    const royal = screen.getByRole('radio', { name: 'Le Petit Palais' });

    expect(screen.getByRole('radio', { name: 'Simple' })).toBeChecked();
    await user.click(royal);

    expect(royal).toBeChecked();
    expect(useBrandThemeStore.getState().theme).toBe('royal');
    expect(document.documentElement.dataset.theme).toBe('royal');
    expect(useAccessibilityStore.getState().contrastTheme).toBe('default');
  });

  it('marks the section being read as the solid pill in the header', () => {
    // jsdom has no IntersectionObserver, so each observer is recorded and fired by hand.
    const observers: Array<{ callback: IntersectionObserverCallback; targets: Element[] }> = [];
    class RecordingIntersectionObserver {
      private readonly record: { callback: IntersectionObserverCallback; targets: Element[] };
      constructor(callback: IntersectionObserverCallback) {
        this.record = { callback, targets: [] };
        observers.push(this.record);
      }
      observe(target: Element): void {
        this.record.targets.push(target);
      }
      unobserve(): void {}
      disconnect(): void {}
    }
    vi.stubGlobal('IntersectionObserver', RecordingIntersectionObserver);
    try {
      renderLanding();
      const faq = document.getElementById('faq');
      const spy = observers.find(({ targets }) => faq !== null && targets.includes(faq));
      const crossStrip = (isIntersecting: boolean): void =>
        act(() =>
          spy?.callback(
            [{ target: faq, isIntersecting } as unknown as IntersectionObserverEntry],
            {} as IntersectionObserver,
          ),
        );
      const onThisPage = screen.getByRole('navigation', { name: 'On this page' });

      expect(spy).toBeDefined();
      crossStrip(true);
      expect(within(onThisPage).getByRole('link', { name: 'FAQ' })).toHaveAttribute(
        'aria-current',
        'true',
      );
      expect(within(onThisPage).getByRole('link', { name: 'Prices' })).not.toHaveAttribute(
        'aria-current',
      );

      crossStrip(false);
      expect(within(onThisPage).getByRole('link', { name: 'FAQ' })).not.toHaveAttribute(
        'aria-current',
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('puts the one Wagstay paw beside the wordmark in the header and the footer', () => {
    renderLanding();

    const headerBrand = screen.getByRole('link', { name: 'Wagstay home' });
    const footer = screen.getByRole('contentinfo');
    expect(headerBrand.querySelector(`img[src="${BRAND_MARK_SRC}"]`)).not.toBeNull();
    expect(footer.querySelector(`img[src="${BRAND_MARK_SRC}"]`)).not.toBeNull();
  });

  it('groups the looks as romantic, luxury and minimal, night mode last in each group', () => {
    renderLanding();
    const themes = screen.getByRole('group', { name: 'Site look' });

    const groups = within(themes)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    expect(groups).toEqual(['Romantic', 'Luxury', 'Minimal']);

    const looks = within(themes)
      .getAllByRole('radio')
      .map((radio) => radio.getAttribute('value'));
    expect(looks).toEqual([
      'strawberry',
      'milk-cream',
      'garden',
      'moonlight',
      'royal',
      'noir',
      'simple',
      'plain-light',
      'plain-dark',
    ]);
  });

  it('tags Strawberry Cream, and nothing else, as the default look', () => {
    renderLanding();
    const themes = screen.getByRole('group', { name: 'Site look' });

    const defaultLooks = within(themes)
      .getAllByText('Default')
      .map((tag) => tag.closest('label')?.querySelector('input')?.getAttribute('value'));
    expect(defaultLooks).toEqual(['strawberry']);
  });

  it('shows a picture for every look except the three minimal ones', () => {
    renderLanding();
    const themes = screen.getByRole('group', { name: 'Site look' });

    const cardsWithPicture = within(themes)
      .getAllByRole('radio')
      .filter((radio) => radio.closest('label')?.querySelector('img') !== null)
      .map((radio) => radio.getAttribute('value'));
    expect(cardsWithPicture).toEqual([
      'strawberry',
      'milk-cream',
      'garden',
      'moonlight',
      'royal',
      'noir',
    ]);
  });

  it('tags only Moonlight Sleepover and Slate as night mode', () => {
    renderLanding();
    const themes = screen.getByRole('group', { name: 'Site look' });

    const nightModeLooks = within(themes)
      .getAllByText('Night mode')
      .map((tag) => tag.closest('label')?.querySelector('input')?.getAttribute('value'));
    expect(nightModeLooks).toEqual(['moonlight', 'plain-dark']);
  });

  it('has one h1 and never skips a heading level', async () => {
    await renderLoadedLanding();

    const levels = screen
      .getAllByRole('heading')
      .map((heading) => Number(heading.tagName.slice(1)));
    expect(levels[0]).toBe(1);
    expect(levels.filter((level) => level === 1)).toHaveLength(1);
    levels.forEach((level, index) => {
      if (index > 0) expect(level).toBeLessThanOrEqual((levels[index - 1] ?? 1) + 1);
    });
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
  });

  it('offers a guest Sign in and a signed-in pet parent their pet centre', async () => {
    const page = renderLanding();
    expect(screen.getAllByRole('link', { name: 'Sign in' })[0]).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('link', { name: 'My pet centre' })).not.toBeInTheDocument();
    page.unmount();

    act(() => {
      useAuthStore.getState().login(petOwner);
    });
    await renderLoadedLanding();

    expect(screen.getAllByRole('link', { name: 'My pet centre' })[0]).toHaveAttribute(
      'href',
      '/parent',
    );
    expect(screen.getByRole('link', { name: 'Open my pet centre' })).toHaveAttribute(
      'href',
      '/parent',
    );
    expect(screen.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument();
  });

  it('opens the same hand-off to a person that /book offers', async () => {
    const user = userEvent.setup();
    await renderLoadedLanding();

    await user.click(screen.getByRole('button', { name: 'Talk to a person' }));

    expect(
      await screen.findByRole('heading', { name: 'Send this plan to our team' }),
    ).toBeInTheDocument();
  });
});
