// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DashboardVisualHelp } from '../DashboardVisualHelp';

describe('DashboardVisualHelp', () => {
  it('exposes the note through the help button title and accessible description', () => {
    const note = 'Shows the selected-period review categories.';

    render(<DashboardVisualHelp visualName="Feedback Mix" note={note} />);

    const button = screen.getByRole('button', { name: 'Help for Feedback Mix' });
    expect(button).toHaveAttribute('title', note);

    const descriptionId = button.getAttribute('aria-describedby');
    if (!descriptionId) {
      throw new Error('Expected the help button to reference its accessible description.');
    }

    expect(document.getElementById(descriptionId)).toHaveTextContent(note);
  });
});
