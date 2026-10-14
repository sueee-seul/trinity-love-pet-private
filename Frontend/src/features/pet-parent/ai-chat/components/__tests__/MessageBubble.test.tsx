import { render as renderWithoutRouter, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useConciergeStore } from '../../../../concierge/store/conciergeStore';
import type { Message } from '../../types';
import { MessageBubble } from '../MessageBubble';

/** The pet cards link to each stay, so every bubble renders inside a router as it does in the app. */
const render = (ui: ReactElement): ReturnType<typeof renderWithoutRouter> =>
  renderWithoutRouter(<MemoryRouter>{ui}</MemoryRouter>);

const baseMessage: Message = {
  id: 'm1',
  senderRole: 'pet_owner',
  body: 'Hello there',
  timestamp: new Date().toISOString(),
};

describe('MessageBubble', () => {
  it('renders a system message as a centered pill', () => {
    render(
      <MessageBubble
        message={{ ...baseMessage, senderRole: 'system', body: 'Customer Support requested' }}
      />,
    );
    expect(screen.getByText(/Customer Support requested/)).toBeInTheDocument();
  });

  it('renders a pet_owner message right-aligned without a sender label', () => {
    render(<MessageBubble message={{ ...baseMessage, senderRole: 'pet_owner' }} />);
    expect(screen.getByText('Hello there')).toBeInTheDocument();
    expect(screen.queryByText(/AI Assistant/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Customer Support/)).not.toBeInTheDocument();
  });

  it('labels an ai message as "AI Assistant"', () => {
    render(<MessageBubble message={{ ...baseMessage, senderRole: 'ai', body: 'Here to help' }} />);
    expect(screen.getByText(/AI Assistant/)).toBeInTheDocument();
  });

  it('renders each pet overview in its own card with the stay details', () => {
    render(
      <MessageBubble
        message={{
          ...baseMessage,
          senderRole: 'ai',
          body: 'Generated long-form summary that should be replaced by the cards.',
          petCards: [
            {
              profile: {
                name: 'Biscuit',
                species: 'dog',
                breed: 'Spaniel',
                age: 5,
                weight: 18,
              },
              answer: 'Biscuit gets two meals each day.',
              stays: [
                {
                  stay: 'Current stay',
                  drop_off_time: null,
                  pick_up_time: null,
                  booking_status: 'confirmed',
                  care_information: {
                    feeding_routine: 'Two meals daily',
                    medication_instructions: null,
                    first_time_boarding: false,
                    crate_trained: true,
                    other_notes: null,
                    allows_socialization: true,
                    fully_vaccinated: true,
                    behavior_and_health_notes: null,
                  },
                  booked_services: [{ name: 'Chicken meal plan', category: 'food' }],
                },
              ],
            },
            {
              profile: {
                name: 'Sato',
                species: 'cat',
                breed: null,
                age: null,
                weight: null,
              },
              stays: [],
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByRole('article')).toHaveLength(2);
    expect(screen.getByText('Biscuit')).toBeInTheDocument();
    expect(screen.getByText('Sato')).toBeInTheDocument();
    expect(screen.getByText('Biscuit gets two meals each day.')).toBeInTheDocument();
    expect(screen.getByText('Two meals daily')).toBeInTheDocument();
    expect(screen.getByText('Chicken meal plan')).toBeInTheDocument();
    expect(screen.getByText('No stays are recorded.')).toBeInTheDocument();
    expect(
      screen.queryByText('Generated long-form summary that should be replaced by the cards.'),
    ).not.toBeInTheDocument();
  });

  it('renders pet quick replies and sends the selected pet name', async () => {
    const user = userEvent.setup();
    const onSelectQuickReply = vi.fn();
    render(
      <MessageBubble
        message={{
          ...baseMessage,
          senderRole: 'ai',
          body: 'Which pet are you asking about?',
          quickReplies: ['Biscuit', 'Sato', 'All my pets'],
        }}
        onSelectQuickReply={onSelectQuickReply}
      />,
    );

    expect(screen.getByRole('button', { name: 'Biscuit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sato' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All my pets' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All my pets' }));
    expect(onSelectQuickReply).toHaveBeenCalledWith('All my pets');
  });

  it('labels a support message with the authorName when present', () => {
    render(
      <MessageBubble
        message={{ ...baseMessage, senderRole: 'support', body: 'All set', authorName: 'John' }}
      />,
    );
    expect(screen.getByText(/John/)).toBeInTheDocument();
  });

  it('falls back to "Customer Support" for a support message with no authorName', () => {
    render(<MessageBubble message={{ ...baseMessage, senderRole: 'support', body: 'All set' }} />);
    expect(screen.getByText(/Customer Support/)).toBeInTheDocument();
  });

  it('labels a regular staff reply as "<name> (Customer Support)"', () => {
    render(
      <MessageBubble
        message={{
          ...baseMessage,
          senderRole: 'support',
          body: 'All set',
          authorName: 'John',
          authorIsManager: false,
        }}
      />,
    );
    expect(screen.getByText(/John \(Customer Support\)/)).toBeInTheDocument();
  });

  it('labels a manager\'s reply as "<name> (Manager from Customer Support)"', () => {
    render(
      <MessageBubble
        message={{
          ...baseMessage,
          senderRole: 'support',
          body: 'All set',
          authorName: 'Alex',
          authorIsManager: true,
        }}
      />,
    );
    expect(screen.getByText(/Alex \(Manager from Customer Support\)/)).toBeInTheDocument();
    expect(screen.queryByText(/Alex \(Customer Support\)/)).not.toBeInTheDocument();
  });
});

describe('MessageBubble in Chinese', () => {
  afterEach(() => {
    useConciergeStore.getState().setLocale('en');
  });

  // The server matches a quick reply word for word, so only what is shown changes.
  it('shows quick replies in Chinese but sends them as offered', async () => {
    useConciergeStore.getState().setLocale('zh');
    const user = userEvent.setup();
    const onSelectQuickReply = vi.fn();
    render(
      <MessageBubble
        message={{
          ...baseMessage,
          senderRole: 'ai',
          body: '你想问哪一次住宿？',
          quickReplies: ['Sep 8-10 (current)', 'All stays'],
        }}
        onSelectQuickReply={onSelectQuickReply}
      />,
    );

    await user.click(screen.getByRole('button', { name: '9月8日至10日（正在住宿）' }));
    expect(onSelectQuickReply).toHaveBeenCalledWith('Sep 8-10 (current)');
    expect(screen.getByRole('button', { name: '所有住宿' })).toBeInTheDocument();
  });

  it('shows a sent quick reply in Chinese', () => {
    useConciergeStore.getState().setLocale('zh');
    render(<MessageBubble message={{ ...baseMessage, body: 'All my pets' }} />);

    expect(screen.getByText('我所有的宠物')).toBeInTheDocument();
  });

  it('writes the pet cards in Chinese', () => {
    useConciergeStore.getState().setLocale('zh');
    render(
      <MessageBubble
        message={{
          ...baseMessage,
          senderRole: 'ai',
          body: '',
          petCards: [
            {
              profile: { name: 'Biscuit', species: 'dog', breed: null, age: 5, weight: null },
              stays: [
                {
                  stay: 'Sep 8-10 (current)',
                  drop_off_time: null,
                  pick_up_time: null,
                  booking_status: 'Staying now',
                  care_information: {
                    feeding_routine: null,
                    medication_instructions: null,
                    first_time_boarding: true,
                    crate_trained: null,
                    other_notes: null,
                    allows_socialization: null,
                    fully_vaccinated: null,
                    behavior_and_health_notes: null,
                  },
                  booked_services: [],
                },
              ],
            },
          ],
        }}
      />,
    );

    const card = screen.getByRole('article');
    expect(card).toHaveTextContent('狗狗');
    expect(card).toHaveTextContent('5 岁');
    expect(card).toHaveTextContent('未记录');
    expect(card).toHaveTextContent('9月8日至10日（正在住宿）');
    expect(card).toHaveTextContent('第一次寄养是');
    expect(card).toHaveTextContent('没有记录服务。');
    expect(card.textContent).not.toMatch(/Staying now|Age|Weight|Yes|Stays/);
  });
});
