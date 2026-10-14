import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { InquiryConversation } from '../../../types/inquiry';
import { InquiryTable } from '../InquiryTable';

function makeInquiry(overrides: Partial<InquiryConversation> = {}): InquiryConversation {
  return {
    uuid: 'inq-1',
    parentName: 'Sarah Nguyen',
    parentInitials: 'SN',
    petName: 'Bella',
    topic: "Bella's Care Updates",
    topicCategory: 'Feeding',
    startedAt: '2026-06-15T10:00:00.000Z',
    durationMinutes: 20,
    status: 'Active',
    supportStatus: 'AI Handling',
    supportRequestedAt: null,
    assignee: null,
    notes: '',
    aiSummary: 'Summary',
    aiDetectedTopic: 'Feeding',
    aiEscalationReason: null,
    aiRelevantInfo: 'Info',
    messages: [],
    ...overrides,
  };
}

const SORT = { field: 'startedAt' as const, direction: 'desc' as const };

const baseProps = {
  inquiries: [makeInquiry()],
  selectedUuid: null,
  onSelect: vi.fn(),
  isManager: true,
  assigneeOptions: [{ id: 'staff-1', name: 'Alice' }],
  onAssigneeChange: vi.fn(),
  loading: false,
  error: null,
  sort: SORT,
  onSortChange: vi.fn(),
};

describe('InquiryTable: status states', () => {
  it('shows the loading state instead of the table', () => {
    render(<InquiryTable {...baseProps} loading />);
    expect(screen.getByText('Loading inquiries…')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the error state instead of the table', () => {
    render(<InquiryTable {...baseProps} error="Something broke" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Something broke');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows the empty state when there are no inquiries', () => {
    render(<InquiryTable {...baseProps} inquiries={[]} />);
    expect(screen.getByText('No conversations found.')).toBeInTheDocument();
  });
});

describe('InquiryTable: row selection', () => {
  it('calls onSelect with the row uuid when a row is clicked', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<InquiryTable {...baseProps} onSelect={onSelect} />);

    await user.click(screen.getByText('Sarah Nguyen'));

    expect(onSelect).toHaveBeenCalledWith('inq-1');
  });

  it('highlights the selected row', () => {
    render(<InquiryTable {...baseProps} selectedUuid="inq-1" />);
    const row = screen.getByText('Sarah Nguyen').closest('tr');
    expect(row).toHaveClass('bg-apricot-cream-100');
  });
});

describe('InquiryTable: assignee cell', () => {
  it('renders an assignee select for a manager', () => {
    render(<InquiryTable {...baseProps} isManager />);
    expect(screen.getByRole('combobox', { name: 'Assignee for Sarah Nguyen' })).toBeInTheDocument();
  });

  it('renders a read-only "You" pill for a non-manager', () => {
    render(<InquiryTable {...baseProps} isManager={false} />);
    expect(
      screen.queryByRole('combobox', { name: 'Assignee for Sarah Nguyen' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('does not trigger row selection when interacting with the assignee cell', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<InquiryTable {...baseProps} onSelect={onSelect} />);

    await user.click(screen.getByRole('combobox', { name: 'Assignee for Sarah Nguyen' }));

    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('InquiryTable: sortable headers', () => {
  it('calls onSortChange with the clicked field', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(<InquiryTable {...baseProps} onSortChange={onSortChange} />);

    await user.click(screen.getByRole('button', { name: /Sort by Duration/ }));

    expect(onSortChange).toHaveBeenCalledWith('durationMinutes');
  });

  it('rotates the chevron only for the active sort field, matching its direction', () => {
    render(<InquiryTable {...baseProps} sort={{ field: 'startedAt', direction: 'asc' }} />);

    const startedButton = screen.getByRole('button', { name: /Sort by Started/ });
    const durationButton = screen.getByRole('button', { name: /Sort by Duration/ });

    expect(startedButton.querySelector('svg')).toHaveClass('rotate-180');
    expect(durationButton.querySelector('svg')).not.toHaveClass('rotate-180');
  });
});

describe('InquiryTable: notes indicator', () => {
  it('styles the notes icon differently when notes are present vs empty', () => {
    const { rerender } = render(
      <InquiryTable {...baseProps} inquiries={[makeInquiry({ notes: 'Has a note' })]} />,
    );
    const withNotesIcon = document
      .querySelector('td span.bg-apricot-cream-100 svg')
      ?.closest('span');
    expect(withNotesIcon).toHaveClass('text-accent-foreground');

    rerender(<InquiryTable {...baseProps} inquiries={[makeInquiry({ notes: '' })]} />);
    expect(document.querySelector('td span.bg-apricot-cream-100')).toBeNull();
  });
});
