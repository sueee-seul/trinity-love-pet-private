import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatMarkdown } from '../ChatMarkdown';

describe('ChatMarkdown', () => {
  it('shows plain text as one paragraph with nothing added', () => {
    const { container } = render(<ChatMarkdown text="How many nights would you like?" />);

    expect(screen.getByText('How many nights would you like?').tagName).toBe('P');
    expect(container.querySelectorAll('strong, em, ul, ol, br')).toHaveLength(0);
  });

  it('turns **bold** and *italic* into emphasis without the stars', () => {
    const { container } = render(
      <ChatMarkdown text="I recommend the **Deluxe suite** for a *quiet* stay." />,
    );

    expect(screen.getByText('Deluxe suite').tagName).toBe('STRONG');
    expect(screen.getByText('quiet').tagName).toBe('EM');
    expect(container.textContent).toBe('I recommend the Deluxe suite for a quiet stay.');
  });

  it('turns "- " lines into a bullet list and keeps the text around it', () => {
    render(
      <ChatMarkdown
        text={
          'The combo has:\n- **Deluxe suite:** more room\n- Outdoor walk\n\nOpen your stay to change it.'
        }
      />,
    );

    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.textContent)).toEqual([
      'Deluxe suite: more room',
      'Outdoor walk',
    ]);
    expect(screen.getByRole('list').tagName).toBe('UL');
    expect(screen.getByText('Deluxe suite:').tagName).toBe('STRONG');
    expect(screen.getByText('The combo has:').tagName).toBe('P');
    expect(screen.getByText('Open your stay to change it.').tagName).toBe('P');
  });

  it('keeps the numbers of a numbered list', () => {
    render(<ChatMarkdown text={'2. Second\n3. Third'} />);

    const list = screen.getByRole('list');
    expect(list.tagName).toBe('OL');
    expect(list).toHaveAttribute('start', '2');
  });

  it('keeps single line breaks inside a paragraph', () => {
    const { container } = render(<ChatMarkdown text={'Line one\nLine two'} />);

    expect(container.querySelectorAll('p')).toHaveLength(1);
    expect(container.querySelectorAll('br')).toHaveLength(1);
  });

  it('shows a heading as a bold line, not as raw hashes', () => {
    render(<ChatMarkdown text="## Your stay" />);

    expect(screen.getByText('Your stay').tagName).toBe('STRONG');
  });

  it('leaves stray stars and arithmetic as text', () => {
    const { container } = render(<ChatMarkdown text="2 * 3 is six, and **unclosed stays" />);

    expect(container.textContent).toBe('2 * 3 is six, and **unclosed stays');
    expect(container.querySelectorAll('strong, em')).toHaveLength(0);
  });

  it('never turns HTML in a reply into elements', () => {
    const { container } = render(
      <ChatMarkdown text={'<b>x</b> and <img src=x onerror="alert(1)"> and **<i>y</i>**'} />,
    );

    expect(container.querySelector('b, img, i')).toBeNull();
    expect(container.textContent).toBe('<b>x</b> and <img src=x onerror="alert(1)"> and <i>y</i>');
    expect(screen.getByText('<i>y</i>').tagName).toBe('STRONG');
  });
});
