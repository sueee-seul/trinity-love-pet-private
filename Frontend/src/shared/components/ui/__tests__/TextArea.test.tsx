import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TextArea } from '../TextArea';

describe('TextArea', () => {
  it('forwards the changed value through onValueChange', () => {
    const onValueChange = vi.fn();
    render(
      <TextArea
        aria-label="Shared text area"
        onValueChange={onValueChange}
        placeholder="Type here"
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: 'Shared text area' }), {
      target: { value: 'A shared value' },
    });

    expect(onValueChange).toHaveBeenCalledWith('A shared value');
  });

  it('preserves native textarea attributes for read-only consumers', () => {
    render(
      <TextArea
        aria-label="Read-only text area"
        className="custom-text-area"
        maxLength={2000}
        readOnly
        rows={6}
      />,
    );

    const textArea = screen.getByRole('textbox', { name: 'Read-only text area' });
    expect(textArea).toHaveAttribute('class', 'custom-text-area');
    expect(textArea).toHaveAttribute('maxLength', '2000');
    expect(textArea).toHaveAttribute('readonly');
    expect(textArea).toHaveAttribute('rows', '6');
  });
});
