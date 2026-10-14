import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useConciergeStore } from '../../../concierge/store/conciergeStore';
import { fetchStaySummaries } from '../../api/staySummariesApi';
import type { StaySummary } from '../../types/liveCare';
import { aucklandIsoDate } from '../live-care/liveCareDates';
import { TodaysUpdateLine } from './TodaysUpdateLine';
import { firstSentence } from './firstSentence';

vi.mock('../../api/staySummariesApi', () => ({ fetchStaySummaries: vi.fn() }));

const today = aucklandIsoDate(new Date());

const update = (overrides: Partial<StaySummary>): StaySummary => ({
  id: 'sum-1',
  bookingPetId: 'bp-now-max',
  date: today,
  kind: 'daily',
  locale: 'en',
  body: 'Max had all 2 meals and 1 walk. Staff wrote: loved the yard.',
  photoPath: null,
  media: null,
  facts: {},
  generatedAt: new Date().toISOString(),
  ...overrides,
});

const renderLine = (): ReturnType<typeof render> =>
  render(
    <MemoryRouter>
      <TodaysUpdateLine bookingPetId="bp-now-max" to="/parent/live-care/bp-now-max" />
    </MemoryRouter>,
  );

afterEach(() => {
  vi.clearAllMocks();
  useConciergeStore.getState().setLocale('en');
});

describe('firstSentence', () => {
  it('stops at the first full stop, question mark or exclamation mark that ends a sentence', () => {
    expect(firstSentence('Max had all 2 meals. He walked twice.')).toBe('Max had all 2 meals.');
    expect(firstSentence('What a day! Max played.')).toBe('What a day!');
    expect(firstSentence('Max weighed 12.5 kg at check-in. Fine.')).toBe(
      'Max weighed 12.5 kg at check-in.',
    );
  });

  it('returns the whole text when it has no sentence end', () => {
    expect(firstSentence('Max had a quiet day')).toBe('Max had a quiet day');
  });
});

describe('TodaysUpdateLine', () => {
  it("shows the first sentence of today's update with a link to the whole of it", async () => {
    vi.mocked(fetchStaySummaries).mockResolvedValue([update({})]);
    renderLine();

    expect(
      await screen.findByText("Today's update: Max had all 2 meals and 1 walk."),
    ).toBeInTheDocument();
    expect(fetchStaySummaries).toHaveBeenCalledWith('bp-now-max');
    expect(screen.getByRole('link', { name: 'Read the full update' })).toHaveAttribute(
      'href',
      '/parent/live-care/bp-now-max',
    );
    expect(screen.queryByText(/loved the yard/)).not.toBeInTheDocument();
  });

  it('shows nothing when no update for today exists yet', async () => {
    vi.mocked(fetchStaySummaries).mockResolvedValue([update({ id: 'sum-0', date: '2026-01-01' })]);
    const { container } = renderLine();

    await waitFor(() => expect(fetchStaySummaries).toHaveBeenCalledTimes(1));
    await act(async () => {
      await Promise.resolve();
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('shows nothing when the updates cannot be loaded', async () => {
    vi.mocked(fetchStaySummaries).mockRejectedValue(new Error('Network down'));
    const { container } = renderLine();

    await waitFor(() => expect(fetchStaySummaries).toHaveBeenCalledTimes(1));
    await act(async () => {
      await Promise.resolve();
    });

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('writes the line in Chinese and keeps the sentence as the server wrote it', async () => {
    useConciergeStore.getState().setLocale('zh');
    vi.mocked(fetchStaySummaries).mockResolvedValue([update({})]);
    renderLine();

    expect(
      await screen.findByText('今日动态：Max had all 2 meals and 1 walk.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看完整动态' })).toBeInTheDocument();
  });
});
