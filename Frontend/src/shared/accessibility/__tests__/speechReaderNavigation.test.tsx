import { cleanup, fireEvent, render as rtlRender, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessibilityWidget } from '../components/AccessibilityWidget';
import { ACCESSIBILITY_COPY } from '../accessibilityCopy';
import { SiteLanguageContext } from '../../i18n/siteLanguage';
import { DEFAULT_PREFERENCES } from '../preferences';
import { useAccessibilityStore } from '../store/accessibilityStore';

/**
 * The reader finishes the page and then describes the top bar. These tests drive it through a
 * stubbed `speechSynthesis` and assert on the queue of spoken text, because the order of the two
 * passes is the behaviour that matters.
 */

const spoken: string[] = [];
const { speech } = ACCESSIBILITY_COPY.en;

/**
 * jsdom implements neither layout nor `innerText`, and the reader depends on both: `getClientRects`
 * tells it which header is on screen, and `innerText` is what keeps hidden text out of the speech.
 * Both are stubbed per element so the test drives the same code path a browser would.
 */
const treatAsRendered = (element: Element, innerText: string): void => {
  element.getClientRects = (): DOMRectList =>
    [{ width: 100, height: 20 }] as unknown as DOMRectList;
  Object.defineProperty(element, 'innerText', { configurable: true, value: innerText });
};

const renderShell = (options: { withAccountMenu: boolean }): void => {
  document.body.insertAdjacentHTML(
    'afterbegin',
    `
    <header>
      <a href="/parent">Wagstay</a>
      <nav><a href="/parent">Homepage</a><a href="/parent/stays">Stays</a></nav>
      ${options.withAccountMenu ? '<button aria-haspopup="menu">Account</button>' : ''}
    </header>
    <main><p>Boarding dates.</p></main>
  `,
  );
  const header = document.querySelector('header');
  if (header) {
    treatAsRendered(header, 'Wagstay\nHomepage\nStays');
  }
  const main = document.querySelector('main');
  if (main) {
    treatAsRendered(main, 'Boarding dates.');
  }
};

const startReading = (): void => {
  // The toolbar's Theme button links to Account Settings, so it needs router context.
  rtlRender(
    <MemoryRouter>
      <AccessibilityWidget />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByTestId('accessibility-launcher'));
  fireEvent.click(screen.getByLabelText('Read this page aloud'));
};

describe('speech reader navigation pass', () => {
  beforeEach(() => {
    useAccessibilityStore.setState({ ...DEFAULT_PREFERENCES, isToolbarOpen: false });
    spoken.length = 0;

    class FakeUtterance {
      lang = '';
      onend: (() => void) | null = null;
      text: string;

      // A constructor parameter property is not erasable syntax, which this project forbids.
      constructor(text: string) {
        this.text = text;
      }
    }

    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
    vi.stubGlobal('speechSynthesis', {
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      speak: (utterance: { text: string }): void => {
        spoken.push(utterance.text);
      },
    });
  });

  afterEach(() => {
    // Unmount first: the widget cancels speech on unmount, so the stub has to outlive it, and
    // Testing Library owns a container that wiping the body out from under it would orphan.
    cleanup();
    vi.unstubAllGlobals();
    document.querySelectorAll('header, main').forEach((element) => element.remove());
  });

  it('reads the page first, then announces the navigation bar and its links', () => {
    renderShell({ withAccountMenu: false });

    startReading();

    // Page content leads; only the first segment is spoken up front, the rest follow on skip.
    expect(spoken[0]).toBe('Boarding dates.');

    fireEvent.click(screen.getByLabelText('Next sentence'));
    expect(spoken[1]).toBe(speech.navigationPreamble);

    fireEvent.click(screen.getByLabelText('Next sentence'));
    expect(spoken[2]).toBe('Wagstay');
  });

  it('tells the visitor what the avatar menu opens when the menu is closed', () => {
    renderShell({ withAccountMenu: true });

    startReading();
    for (let step = 0; step < 8; step += 1) {
      fireEvent.click(screen.getByLabelText('Next sentence'));
    }

    expect(spoken).toContain(speech.accountMenuHint);
  });

  it('reads the real menu items instead of the hint while the menu is open', () => {
    renderShell({ withAccountMenu: true });
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    menu.textContent = 'Profile';
    document.querySelector('header')?.appendChild(menu);
    treatAsRendered(menu, 'Profile');

    startReading();
    for (let step = 0; step < 8; step += 1) {
      fireEvent.click(screen.getByLabelText('Next sentence'));
    }

    expect(spoken).toContain(speech.accountMenuOpen);
    expect(spoken).not.toContain(speech.accountMenuHint);
  });

  // Chinese puts no space after a full stop, so each stop has to end a sentence on its own.
  it('reads a Chinese page sentence by sentence, and announces the bar in Chinese', () => {
    renderShell({ withAccountMenu: false });
    const main = document.querySelector('main');
    if (main) {
      treatAsRendered(main, '寄养日期。请准时到店！');
    }

    rtlRender(
      <MemoryRouter>
        <SiteLanguageContext.Provider value="zh">
          <AccessibilityWidget />
        </SiteLanguageContext.Provider>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId('accessibility-launcher'));
    fireEvent.click(screen.getByLabelText('朗读本页'));
    fireEvent.click(screen.getByLabelText('下一句'));
    fireEvent.click(screen.getByLabelText('下一句'));

    expect(spoken.slice(0, 3)).toEqual([
      '寄养日期。',
      '请准时到店！',
      ACCESSIBILITY_COPY.zh.speech.navigationPreamble,
    ]);
  });
});
