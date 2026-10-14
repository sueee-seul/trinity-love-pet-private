import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useConciergeStore } from '../../features/concierge/store/conciergeStore';
import { AccessibilityWidget } from '../../shared/accessibility';
import { DEFAULT_PREFERENCES } from '../../shared/accessibility/preferences';
import { useAccessibilityStore } from '../../shared/accessibility/store/accessibilityStore';
import { SiteLanguageProvider } from '../SiteLanguageProvider';

const renderAt = (path: string): void => {
  render(
    <MemoryRouter initialEntries={[path]}>
      <SiteLanguageProvider>
        <AccessibilityWidget />
      </SiteLanguageProvider>
    </MemoryRouter>,
  );
};

describe('SiteLanguageProvider', () => {
  beforeEach(() => {
    useAccessibilityStore.setState({ ...DEFAULT_PREFERENCES, isToolbarOpen: false });
    useConciergeStore.getState().setLocale('zh');
  });

  afterEach(() => {
    useConciergeStore.getState().setLocale('en');
    document.documentElement.lang = 'en';
  });

  it('speaks the language the visitor picked on a pet parent page', () => {
    renderAt('/parent');

    expect(document.documentElement.lang).toBe('zh-Hans');
    expect(screen.getByRole('button', { name: '打开无障碍工具' })).toBeInTheDocument();
  });

  // Staff pages are English only, even for a visitor who picked Chinese on the public pages.
  it('keeps staff pages in English', () => {
    renderAt('/admin/bookings');

    expect(document.documentElement.lang).toBe('en-NZ');
    expect(screen.getByRole('button', { name: 'Open accessibility tools' })).toBeInTheDocument();
  });
});
