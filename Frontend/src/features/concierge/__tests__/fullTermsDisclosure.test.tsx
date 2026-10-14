import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { conciergeApi } from '../api/conciergeApi';
import { FullTermsDisclosure } from '../components/checkout/FullTermsDisclosure';
import { CONCIERGE_COPY } from '../copy';
import { TERMS_VERSION_LABEL } from '../hooks/useConciergeCheckout';
import { termsInChinese } from '../terms/termsInChinese';
import { useConciergeStore } from '../store/conciergeStore';

vi.mock('../api/conciergeApi', () => ({ conciergeApi: { terms: vi.fn() } }));

const TERMS = {
  version: 'concierge-terms-2026-10-01',
  content: 'Wagstay booking terms, version concierge-terms-2026-10-01\n\n3. Cancellation',
};

describe('the full booking terms beside the agreement box', () => {
  beforeEach(() => vi.mocked(conciergeApi.terms).mockReset());
  afterEach(() => useConciergeStore.getState().setLocale('en'));

  it('loads every clause the first time it is opened, not before', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.terms).mockResolvedValue(TERMS);
    render(<FullTermsDisclosure copy={CONCIERGE_COPY.en.details.fullTerms} />);

    expect(conciergeApi.terms).not.toHaveBeenCalled();
    await user.click(screen.getByText('Read the full booking terms'));

    expect(await screen.findByText(/3\. Cancellation/)).toBeInTheDocument();
    expect(conciergeApi.terms).toHaveBeenCalledTimes(1);
  });

  it('says when the terms could not be loaded and lets the parent try again', async () => {
    const user = userEvent.setup();
    vi.mocked(conciergeApi.terms)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(TERMS);
    render(<FullTermsDisclosure copy={CONCIERGE_COPY.en.details.fullTerms} />);

    await user.click(screen.getByText('Read the full booking terms'));
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t load the terms.');

    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/3\. Cancellation/)).toBeInTheDocument();
  });

  it('tells a Chinese reader when a version has no translation', async () => {
    const user = userEvent.setup();
    useConciergeStore.getState().setLocale('zh');
    vi.mocked(conciergeApi.terms).mockResolvedValue(TERMS);
    render(<FullTermsDisclosure copy={CONCIERGE_COPY.zh.details.fullTerms} />);

    await user.click(screen.getByText('阅读完整预约条款'));

    expect(await screen.findByText(/3\. Cancellation/)).toHaveAttribute('lang', 'en');
    expect(screen.getByText(/完整条款目前只有英文/)).toBeInTheDocument();
  });

  // The English is what is agreed to, so it stays one tap away and the note says it prevails.
  it('gives a Chinese reader the translation of the current terms', async () => {
    const user = userEvent.setup();
    useConciergeStore.getState().setLocale('zh');
    vi.mocked(conciergeApi.terms).mockResolvedValue({
      version: 'concierge-terms-2026-10-06',
      content: 'Wagstay booking terms, version concierge-terms-2026-10-06\n\n3. Cancellation',
    });
    render(<FullTermsDisclosure copy={CONCIERGE_COPY.zh.details.fullTerms} />);

    await user.click(screen.getByText('阅读完整预约条款'));

    expect(await screen.findByText(/3\. 取消/)).toHaveAttribute('lang', 'zh-Hans');
    expect(screen.getByText(/以英文版本为准/)).toBeInTheDocument();
    await user.click(screen.getByText('查看英文原文'));
    expect(screen.getByText(/3\. Cancellation/)).toHaveAttribute('lang', 'en');
  });

  // A new terms version must be translated before Chinese readers are asked to agree to it.
  it('has a Chinese translation of the version checkout agrees to', () => {
    expect(termsInChinese(TERMS_VERSION_LABEL)).not.toBeNull();
  });
});
