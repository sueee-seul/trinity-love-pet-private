import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeIcon } from '../icons/ThemeIcon';
import { THEME_ICON_NAMES } from '../icons/iconNames';

describe('ThemeIcon', () => {
  it('ships all 24 shapes from the design package', () => {
    expect(THEME_ICON_NAMES).toHaveLength(24);
  });

  it('renders every icon with geometry inside', () => {
    THEME_ICON_NAMES.forEach((name) => {
      const { container, unmount } = render(<ThemeIcon name={name} />);
      const svg = container.querySelector('svg');

      expect(svg).not.toBeNull();
      expect(svg?.children.length).toBeGreaterThan(0);
      unmount();
    });
  });

  // The whole reason for 24 files instead of 96: colour comes from the surrounding text, so one
  // set of shapes follows the brand theme and the high-contrast reading modes alike.
  it('takes its colour from the surrounding text rather than a baked-in value', () => {
    const { container } = render(<ThemeIcon name="paw" />);
    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('stroke', 'currentColor');
    expect(svg?.getAttribute('style')).toBeNull();
    expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{6}/);
  });

  it('is hidden from assistive technology unless it is given a label', () => {
    const { container: decorative } = render(<ThemeIcon name="bell" />);
    expect(decorative.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');

    const { container: labelled } = render(<ThemeIcon name="bell" label="Notifications" />);
    const svg = labelled.querySelector('svg');
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg).toHaveAttribute('aria-label', 'Notifications');
    expect(svg).not.toHaveAttribute('aria-hidden');
  });
});
