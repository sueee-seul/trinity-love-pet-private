import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { BookingDetailsModal } from '../BookingDetailsModal';
import { useConciergeStore } from '../../../../concierge/store/conciergeStore';
import { clearParentWrittenText } from '../../../i18n/parentWrittenText';
import { bookedStay } from './stayFixtures';

const CHINESE = /[㐀-鿿]/;

const stayWithChineseNote = bookedStay({
  caringInfo: {
    ...bookedStay().caringInfo,
    feedingRoutine: 'Kibble twice a day',
    others: '喜欢白天睡觉',
  },
});

const answer = (ok: boolean, translations: (string | null)[]): void => {
  vi.mocked(globalThis.fetch).mockResolvedValue({
    ok,
    status: ok ? 200 : 503,
    json: async () => (ok ? { translations } : {}),
  } as Response);
};

const renderDetails = (): void => {
  render(
    <MemoryRouter>
      <BookingDetailsModal stay={stayWithChineseNote} onClose={() => undefined} />
    </MemoryRouter>,
  );
};

// An English page shows no Chinese: a note the parent wrote in Chinese is shown in English.
describe('booking details, notes the parent wrote', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    clearParentWrittenText();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useConciergeStore.getState().setLocale('en');
  });

  it('shows a Chinese note in English, marked as translated', async () => {
    answer(true, ['Likes to sleep during the day']);
    renderDetails();

    expect(await screen.findByText('Likes to sleep during the day')).toBeInTheDocument();
    expect(screen.getByText('Translated')).toBeInTheDocument();
    expect(screen.getByText('Kibble twice a day')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(CHINESE);
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0] ?? [];
    expect(String(url)).toContain('/petparent/translations/english');
    expect(JSON.parse(String(init?.body))).toEqual({ texts: ['喜欢白天睡觉'] });
  });

  it('says it could not translate rather than showing the Chinese', async () => {
    answer(false, []);
    renderDetails();

    expect(
      await screen.findByText('You wrote this in Chinese. We could not translate it just now.'),
    ).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(CHINESE);
  });

  it('shows the note as written on a Chinese page, without asking for a translation', () => {
    useConciergeStore.getState().setLocale('zh');
    renderDetails();

    expect(screen.getByText('喜欢白天睡觉')).toBeInTheDocument();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
