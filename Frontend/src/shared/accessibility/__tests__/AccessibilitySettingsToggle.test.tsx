import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { AccessibilitySettingsToggle } from '../components/AccessibilitySettingsToggle';
import { DEFAULT_PREFERENCES } from '../preferences';
import { useAccessibilityStore } from '../store/accessibilityStore';

describe('AccessibilitySettingsToggle', () => {
  beforeEach(() => {
    useAccessibilityStore.setState({ ...DEFAULT_PREFERENCES, isToolbarOpen: false });
  });

  it('reflects the current launcher setting', () => {
    render(<AccessibilitySettingsToggle />);

    expect(screen.getByRole('switch')).toBeChecked();
  });

  it('switches the launcher off and back on', () => {
    render(<AccessibilitySettingsToggle />);
    const toggle = screen.getByRole('switch');

    fireEvent.click(toggle);
    expect(useAccessibilityStore.getState().isLauncherEnabled).toBe(false);
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    expect(useAccessibilityStore.getState().isLauncherEnabled).toBe(true);
  });
});
