import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useConciergeStore } from '../store/conciergeStore';
import type { ConciergeNeeds, ConciergeQuote } from '../types';
import { downloadCalendar } from '../utils/ics';
import {
  acceptedFor,
  oneDog,
  quoteFor,
  renderPage,
  resetPage,
  roomierCombo,
  sent,
  simpleCombo,
} from './conciergePageFixtures';
import { AVA, signInParent } from './fixtures';
import { englishWordsIn } from '../../../shared/i18n/testing/englishWordsIn';

/**
 * What the price covers, where the guest checks it: the summary beside the details form, and the
 * request receipt once the request is sent. Both name the stay from its lines and list the add-ons
 * its price covers, which is exactly what the server priced. The Sent screen never shows the
 * boarding pass: that waits for our manager's approval.
 */

vi.mock('../api/conciergeApi', () => ({
  conciergeApi: {
    chat: vi.fn(),
    priceSelection: vi.fn(),
    acceptQuote: vi.fn(),
    checkout: vi.fn(),
    status: vi.fn(),
    rates: vi.fn(),
    catalogue: vi.fn(),
    myPets: vi.fn(),
  },
}));

vi.mock('../utils/ics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils/ics')>()),
  downloadCalendar: vi.fn(),
}));

vi.mock('../hooks/useSignedInPetOwner', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../hooks/useSignedInPetOwner')>()),
  refreshSession: vi.fn(async () => undefined),
}));

/** The text of the row (a div holding a label and its value) that has this label. */
const valueIn =
  (container: HTMLElement) =>
  (label: string): string =>
    within(container).getByText(label).closest('div')?.textContent ?? '';

const oneCat: ConciergeNeeds = {
  ...oneDog,
  pets: [{ species: 'cat', size: null, needsMedication: false, firstTimeBoarding: null }],
};

/** A cat's stay with grooming: no walk, because walks are for dogs. */
const groomedCat: ConciergeQuote = quoteFor(
  [{ roomId: 'room-standard', foodId: 'food-fresh', addonIds: ['addon-grooming'] }],
  'quote-groomed-cat',
);

describe('the request summary on the details step', () => {
  beforeEach(resetPage);

  const showSummary = (quote: ConciergeQuote, needs: ConciergeNeeds = oneDog): HTMLElement => {
    signInParent();
    useConciergeStore.setState({
      needs,
      agreedNeeds: needs,
      missingFields: [],
      accepted: acceptedFor(quote),
      agreedQuote: quote,
    });
    useConciergeStore.getState().setVerified(AVA.email, null);
    useConciergeStore.getState().goTo('details');
    renderPage();
    return screen.getByRole('complementary', { name: 'Your request' });
  };

  it('names the stay from its lines and lists the add-ons the total covers', () => {
    const summary = showSummary(roomierCombo.quote);

    const value = valueIn(summary);
    expect(value('Stay')).toContain('Deluxe suite, House food and Outdoor walk');
    expect(value('Guests')).toContain('1');
    expect(value('Extras')).toContain('Outdoor walk');
    expect(within(summary).getAllByText('$267.00').length).toBeGreaterThan(0);
    // Every line, with its unit price, so nothing in the total is a surprise.
    expect(within(summary).getByText('$68.00 per night')).toBeInTheDocument();
  });

  it('says there are no extras when the stay has no add-on', () => {
    const value = valueIn(showSummary(simpleCombo.quote));

    expect(value('Stay')).toContain('Standard room and House food');
    expect(value('Extras')).toContain('None');
  });

  it('lists exactly the add-ons priced for a cat, with no walk', () => {
    const value = valueIn(showSummary(groomedCat, oneCat));

    expect(value('Extras')).toContain('Grooming: bath and brush');
    expect(value('Extras')).not.toContain('Outdoor walk');
  });
});

describe('the request receipt on the Sent screen', () => {
  beforeEach(resetPage);

  /** The real hand-over, so the receipt shows what the store keeps after sending. */
  const send = (quote: ConciergeQuote): void => {
    useConciergeStore.setState({
      needs: oneDog,
      agreedNeeds: oneDog,
      missingFields: [],
      accepted: acceptedFor(quote),
      agreedQuote: quote,
      detailsDraft: {
        contact: {
          email: '',
          password: '',
          firstName: '',
          lastName: '',
          address: '',
          phone: '',
        },
        pets: [],
        dropOffTime: '10:30',
        pickUpTime: '16:00',
        careNotes: '',
        termsAccepted: true,
        vetConsent: true,
      },
    });
    useConciergeStore.getState().setCheckoutResult(sent);
  };

  const receipt = (name = 'Request receipt'): HTMLElement => screen.getByRole('region', { name });

  it('holds the reference, each pet’s review, dates, times, the stay, extras and the total', () => {
    send(roomierCombo.quote);
    renderPage();

    expect(screen.getByRole('heading', { name: 'Request sent' })).toBeInTheDocument();
    const value = valueIn(receipt());
    expect(value('Reference')).toContain('PB-AAAAAA');
    expect(within(receipt()).getByText('Biscuit').closest('li')).toHaveTextContent(
      'BiscuitWaiting for review',
    );
    expect(within(receipt()).getByText('Mochi').closest('li')).toHaveTextContent(
      'MochiWaiting for review',
    );
    expect(value('Dates')).toContain('3 nights');
    expect(value('Check-in')).toContain('10:30 am');
    expect(value('Check-out')).toContain('4:00 pm');
    expect(value('Stay')).toContain('Deluxe suite, House food and Outdoor walk');
    expect(value('Extras')).toContain('Outdoor walk');
    expect(value('Total, paid at the desk')).toContain('$230.00');
    expect(within(receipt()).getByText('includes GST of $30.00')).toBeInTheDocument();
  });

  it('shows no boarding pass and says plainly that a waiting stay is not booked yet', () => {
    send(roomierCombo.quote);
    renderPage();

    expect(screen.queryByRole('region', { name: 'Boarding pass' })).not.toBeInTheDocument();
    expect(screen.queryByText('Boarding pass')).not.toBeInTheDocument();
    expect(
      within(receipt()).getByText(
        'A stay waiting for review is not booked yet. We will tell you here, in your notifications and in the chat, once our manager decides.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Once a stay is approved, its boarding pass is in My stays. On the day, we do a quick health check at the desk and you pay there.',
      ),
    ).toBeInTheDocument();
  });

  it('says a booking confirmed at once is confirmed, with no waiting line', () => {
    send(roomierCombo.quote);
    useConciergeStore.setState({
      checkoutResult: {
        ...sent,
        status: 'confirmed',
        pets: sent.pets.map((pet) => ({ ...pet, status: 'confirmed', reviewReasons: [] })),
      },
    });
    renderPage();

    expect(screen.getByRole('heading', { name: 'Booking confirmed' })).toBeInTheDocument();
    expect(document.title).toBe('Booking confirmed · Wagstay');
    expect(within(receipt()).getAllByText('Confirmed')).toHaveLength(2);
    expect(within(receipt()).queryByText('Waiting for review')).not.toBeInTheDocument();
    expect(within(receipt()).queryByText(/not booked yet/)).not.toBeInTheDocument();
  });

  it('marks each pet as confirmed or waiting when only some stays wait for our manager', () => {
    send(roomierCombo.quote);
    useConciergeStore.setState({
      checkoutResult: {
        ...sent,
        status: 'partly_confirmed',
        pets: [
          { name: 'Biscuit', status: 'confirmed', reviewReasons: [] },
          { name: 'Mochi', status: 'waiting_for_review', reviewReasons: ['medication'] },
        ],
      },
    });
    renderPage();

    expect(screen.getByRole('heading', { name: 'Booking sent' })).toBeInTheDocument();
    expect(within(receipt()).getByText('Biscuit').closest('li')).toHaveTextContent('Confirmed');
    expect(within(receipt()).getByText('Mochi').closest('li')).toHaveTextContent(
      'Waiting for review',
    );
    expect(within(receipt()).getByText(/not booked yet/)).toBeInTheDocument();
  });

  it('reads as a request receipt in Chinese, with the stay named in Chinese', async () => {
    send(roomierCombo.quote);
    renderPage();

    act(() => useConciergeStore.getState().setLocale('zh'));

    expect(screen.getByRole('heading', { name: '申请已提交' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: '住宿凭证' })).not.toBeInTheDocument();
    const value = valueIn(receipt('申请回执'));
    expect(value('预约编号')).toContain('PB-AAAAAA');
    expect(within(receipt('申请回执')).getAllByText('等待审核')).toHaveLength(2);
    expect(value('入住')).toContain('上午10:30');
    expect(value('离店')).toContain('下午4:00');
    expect(value('住宿')).toContain('豪华套房、店内干粮、户外散步');
    expect(value('附加服务')).toContain('户外散步');
    expect(value('总价（到店在前台支付）')).toContain('$230.00');
    expect(
      within(receipt('申请回执')).getByText(
        '等待审核的住宿还没有预约成功。经理决定后，我们会通过通知和聊天告诉你。',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        '住宿批准后，住宿凭证在“我的住宿”里。入住当天我们先在前台做简单的健康检查，然后你在前台付款。',
      ),
    ).toBeInTheDocument();
    expect(englishWordsIn(document.body, ['Biscuit', 'Mochi', 'PB', 'AAAAAA'])).toEqual([]);
  });

  it('copies the reference', async () => {
    const user = userEvent.setup();
    send(roomierCombo.quote);
    renderPage();

    await user.click(within(receipt()).getByRole('button', { name: 'Copy reference' }));

    await expect(navigator.clipboard.readText()).resolves.toBe('PB-AAAAAA');
    expect(within(receipt()).getByRole('button', { name: 'Reference copied' })).toBeInTheDocument();
    expect(within(receipt()).getByRole('status')).toHaveTextContent('Reference copied');
  });

  it('titles the calendar events as a request that is not yet confirmed', async () => {
    const user = userEvent.setup();
    vi.mocked(downloadCalendar).mockClear();
    send(roomierCombo.quote);
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Add to my calendar' }));

    const [fileName, content] = vi.mocked(downloadCalendar).mock.calls[0] ?? [];
    expect(fileName).toBe('wagstay-PB-AAAAAA.ics');
    expect(content).toContain('SUMMARY:Wagstay request (not yet confirmed) · Check-in');
    expect(content).toContain('SUMMARY:Wagstay request (not yet confirmed) · Check-out');
  });

  it('says there are no extras for a stay with no add-on', () => {
    send(simpleCombo.quote);
    renderPage();

    const value = valueIn(receipt());
    expect(value('Stay')).toContain('Standard room and House food');
    expect(value('Extras')).toContain('None');
  });

  it('leaves the stay and extras out rather than guess when the tab lost them', () => {
    send(roomierCombo.quote);
    useConciergeStore.setState({ booked: null });
    renderPage();

    expect(within(receipt()).queryByText('Stay')).not.toBeInTheDocument();
    expect(within(receipt()).queryByText('Extras')).not.toBeInTheDocument();
    expect(within(receipt()).getByText('PB-AAAAAA')).toBeInTheDocument();
  });

  it('shows one waiting line for a request saved before each pet had a status', () => {
    send(roomierCombo.quote);
    useConciergeStore.setState({ checkoutResult: { ...sent, bookingPetIds: [], pets: [] } });
    renderPage();

    expect(within(receipt()).getAllByText('Waiting for review')).toHaveLength(1);
    expect(within(receipt()).queryByText('Pet 1')).not.toBeInTheDocument();
  });
});
