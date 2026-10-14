import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { BRAND_THEMES, UNTHEMED_BRAND_THEME } from '../constants';
import { ThemeDivider } from '../decorations/ThemeDivider';
import { ThemeHeroOrnament } from '../decorations/ThemeHeroOrnament';
import { ThemePetAvatar } from '../decorations/ThemePetAvatar';
import { THEME_LACE_EDGE_HEIGHT, ThemeLaceEdge } from '../decorations/ThemeLaceEdge';
import { ThemeSignatureBadge } from '../decorations/ThemeSignatureBadge';
import { useBrandThemeStore } from '../themeStore';

const setTheme = (theme: (typeof BRAND_THEMES)[number]): void => {
  useBrandThemeStore.setState({ theme });
};

describe('theme decorations', () => {
  beforeEach(() => {
    setTheme(UNTHEMED_BRAND_THEME);
  });

  describe('ThemeSignatureBadge', () => {
    // Only the two themes whose owner picked a badge pin one to the Signature card.
    it('shows the bow on Strawberry Cream and the crown on Le Petit Palais', () => {
      const badgeFor = (theme: (typeof BRAND_THEMES)[number]): string => {
        setTheme(theme);
        const { container, unmount } = render(<ThemeSignatureBadge />);
        const html = container.innerHTML;
        unmount();
        return html;
      };
      const bow = badgeFor('strawberry');
      const crown = badgeFor('royal');

      expect(bow).toContain('theme-signature-badge');
      expect(crown).toContain('theme-signature-badge');
      expect(bow).not.toBe(crown);
    });

    it('shows nothing in any other theme', () => {
      const shown = BRAND_THEMES.filter((theme) => {
        setTheme(theme);
        const { container, unmount } = render(<ThemeSignatureBadge />);
        const hasBadge = container.querySelector('.theme-signature-badge') !== null;
        unmount();
        return hasBadge;
      });

      expect(shown).toEqual(['strawberry', 'royal']);
    });

    // The card names its tier; the badge only repeats it in pictures.
    it('is hidden from assistive technology', () => {
      setTheme('strawberry');
      const { container } = render(<ThemeSignatureBadge />);

      expect(container.querySelector('.theme-signature-badge')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
    });
  });

  describe('ThemeDivider and ThemeHeroOrnament', () => {
    it('are decoration, hidden from assistive technology', () => {
      const { container } = render(
        <>
          <ThemeDivider />
          <ThemeHeroOrnament />
        </>,
      );

      expect(container.querySelector('.theme-divider')).toHaveAttribute('aria-hidden', 'true');
      expect(container.querySelector('.theme-hero-ornament')).toHaveAttribute(
        'aria-hidden',
        'true',
      );
      expect(container.querySelectorAll('.theme-hero-star')).toHaveLength(5);
    });
  });

  describe('ThemeLaceEdge', () => {
    it('gives every theme its own scallop unit', () => {
      const widths = BRAND_THEMES.map((theme) => {
        setTheme(theme);
        const { container, unmount } = render(<ThemeLaceEdge />);
        const width = container.querySelector('pattern')?.getAttribute('width');
        unmount();
        return width;
      });

      expect(widths.every((width) => Number(width) > 0)).toBe(true);
      // Royal's drape is wider than the plain scallop, so the set is not one repeated unit.
      expect(new Set(widths).size).toBeGreaterThan(1);
    });

    it('reserves the height the consuming bar pads for', () => {
      const { container } = render(<ThemeLaceEdge />);
      const svg = container.querySelector('svg');

      expect(svg).toHaveAttribute('height', String(THEME_LACE_EDGE_HEIGHT));
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    // Two bars on one page must not share a pattern id, or one paints with the other's geometry.
    it('scopes its pattern id per instance', () => {
      const { container } = render(
        <>
          <ThemeLaceEdge />
          <ThemeLaceEdge />
        </>,
      );
      const ids = Array.from(container.querySelectorAll('pattern')).map((node) => node.id);

      expect(ids).toHaveLength(2);
      expect(new Set(ids).size).toBe(2);
    });

    it('takes its colours from theme tokens, not baked values', () => {
      const { container } = render(<ThemeLaceEdge />);

      // The shell token is what puts gold lace on Royal's emerald bar.
      expect(container.innerHTML).toContain('--brand-shell');
      expect(container.innerHTML).not.toMatch(/#[0-9a-fA-F]{6}/);
    });
  });

  describe('ThemePetAvatar', () => {
    // Unlike the hero, an avatar is often the only thing naming which pet a row is about.
    it('is announced rather than hidden', () => {
      const { container } = render(<ThemePetAvatar species="kitten" />);
      const svg = container.querySelector('svg');

      expect(svg).toHaveAttribute('role', 'img');
      expect(svg).toHaveAttribute('aria-label', 'Kitten avatar');
    });

    it('keeps its illustration colours and distinguishes the two species', () => {
      const { container: puppy } = render(<ThemePetAvatar species="puppy" label="Mochi" />);
      const { container: kitten } = render(<ThemePetAvatar species="kitten" label="Mochi" />);

      expect(puppy.innerHTML).toMatch(/#b87845/);
      expect(puppy.innerHTML).not.toBe(kitten.innerHTML);
      expect(puppy.querySelector('svg')).toHaveAttribute('aria-label', 'Mochi');
    });
  });
});
