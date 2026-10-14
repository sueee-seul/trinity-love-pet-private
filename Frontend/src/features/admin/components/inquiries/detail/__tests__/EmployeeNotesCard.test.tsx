import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmployeeNotesCard } from '../EmployeeNotesCard';

describe('EmployeeNotesCard', () => {
  it('disables Save until the draft differs from notes', async () => {
    const user = userEvent.setup();
    render(<EmployeeNotesCard notes="Existing note" onSave={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await user.type(screen.getByPlaceholderText('Add a note for the team…'), '!');

    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  it('calls onSave with the current draft', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<EmployeeNotesCard notes="" onSave={onSave} />);

    await user.type(screen.getByPlaceholderText('Add a note for the team…'), 'New note');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith('New note');
  });

  it('preserves the in-progress draft across a collapse/expand cycle', async () => {
    const user = userEvent.setup();
    render(<EmployeeNotesCard notes="" onSave={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Add a note for the team…'), 'Draft text');
    const toggle = screen.getByRole('button', { name: 'Employee Notes' });

    await user.click(toggle);
    expect(screen.queryByPlaceholderText('Add a note for the team…')).not.toBeInTheDocument();

    await user.click(toggle);
    expect(screen.getByPlaceholderText('Add a note for the team…')).toHaveValue('Draft text');
  });
});
