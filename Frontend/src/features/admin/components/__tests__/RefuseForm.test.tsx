import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { REFUSAL_REASON_IDS } from '../../../../shared/booking/refusalReasons';
import { RefuseForm } from '../booking/RefuseForm';

describe('RefuseForm', () => {
  it('offers the preset reasons and refuses with the one picked', () => {
    const onRefuse = vi.fn();
    render(
      <RefuseForm releasesHold={false} isBusy={false} onRefuse={onRefuse} onCancel={vi.fn()} />,
    );

    expect(screen.getAllByRole('radio')).toHaveLength(REFUSAL_REASON_IDS.length);
    const confirm = screen.getByRole('button', { name: 'Confirm refuse' });
    expect(confirm).toBeDisabled();

    fireEvent.click(screen.getByLabelText('We are fully booked on those dates.'));
    fireEvent.click(confirm);

    expect(onRefuse).toHaveBeenCalledWith('We are fully booked on those dates.');
  });

  it('says when refusing releases the card hold', () => {
    render(<RefuseForm releasesHold isBusy={false} onRefuse={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText(/releases the card hold in full/)).toBeInTheDocument();
  });
});
