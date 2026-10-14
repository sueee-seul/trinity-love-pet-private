import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { ContrastSettingsSection } from '../components/ContrastSettingsSection';
import { ACCESSIBILITY_COPY } from '../accessibilityCopy';
import { SELECTABLE_CONTRAST_THEMES } from '../constants';
import { DEFAULT_PREFERENCES } from '../preferences';
import { useAccessibilityStore } from '../store/accessibilityStore';

/**
 * This section is the only place a reading colour mode can be reached - the toolbar carries none
 * of them. That makes "every mode is here" the assertion that matters: drop one and it becomes
 * unreachable rather than merely inconvenient.
 */
describe('ContrastSettingsSection', () => {
  beforeEach(() => {
    useAccessibilityStore.setState({ ...DEFAULT_PREFERENCES, isToolbarOpen: false });
  });

  it('offers every reading colour mode', () => {
    render(<ContrastSettingsSection />);

    expect(screen.getAllByRole('button')).toHaveLength(SELECTABLE_CONTRAST_THEMES.length);
    // Matched on the label a person reads, not the internal id - the two differ in spelling
    // ("grayscale" vs "Greyscale"), and the label is what has to be there.
    SELECTABLE_CONTRAST_THEMES.forEach((theme) => {
      expect(
        screen.getByRole('button', {
          name: new RegExp(ACCESSIBILITY_COPY.en.contrast.labels[theme], 'i'),
        }),
      ).toBeInTheDocument();
    });
  });

  /**
   * There is no button for `default`. It is the absence of a reading colour, and a control that
   * applies nothing sitting among four that apply something reads as a broken one - which is
   * exactly how it behaved with a brand theme active.
   */
  it('offers no button for the absence of a reading colour', () => {
    render(<ContrastSettingsSection />);

    expect(screen.queryByRole('button', { name: /Apricot/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Default/i })).not.toBeInTheDocument();
  });

  it('applies a mode when its option is chosen', () => {
    render(<ContrastSettingsSection />);

    fireEvent.click(screen.getByRole('button', { name: /Yellow on black/ }));

    expect(useAccessibilityStore.getState().contrastTheme).toBe('yellow');
  });

  // Nothing is selected to begin with, so the visitor needs a way back out of a mode they tried.
  it('clears the mode when the active one is pressed again', () => {
    render(<ContrastSettingsSection />);
    const yellow = screen.getByRole('button', { name: /Yellow on black/ });

    fireEvent.click(yellow);
    expect(yellow).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(yellow);

    expect(useAccessibilityStore.getState().contrastTheme).toBe('default');
    expect(yellow).toHaveAttribute('aria-pressed', 'false');
  });
});
