import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConciergeStore } from '../../../concierge/store/conciergeStore';
import { fetchLiveCare } from '../liveCareApi';

const DAY = {
  bookingPetId: 'bp-1',
  petId: 'pet-1',
  petName: 'Biscuit',
  sitterName: 'Sam',
  location: 'Wagstay',
  dropOffDate: '2026-10-12',
  pickUpDate: '2026-10-15',
  availableDates: ['2026-10-12'],
  selectedDate: '2026-10-12',
  entries: [],
  stats: [],
};

const requestedUrl = (): string => String(vi.mocked(fetch).mock.calls[0]?.[0]);

describe('fetchLiveCare', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (): Promise<Pick<Response, 'ok' | 'json'>> => ({
        ok: true,
        json: async (): Promise<unknown> => DAY,
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useConciergeStore.getState().setLocale('en');
  });

  it('asks for the day only, in English', async () => {
    await fetchLiveCare('bp-1', '2026-10-12');

    expect(requestedUrl()).toMatch(/\/petparent\/live-care\/bp-1\?date=2026-10-12$/);
  });

  // Staff notes come translated only for a parent reading Chinese.
  it('asks for Chinese staff notes when the page is in Chinese', async () => {
    useConciergeStore.getState().setLocale('zh');

    await fetchLiveCare('bp-1');

    expect(requestedUrl()).toMatch(/\/petparent\/live-care\/bp-1\?lang=zh$/);
  });
});
