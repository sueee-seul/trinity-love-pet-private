import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useMediaQuery } from '../useMediaQuery';

const QUERY = '(min-width: 48rem)';

// A stand-in for the browser's MediaQueryList, whose answer the test can change.
const installMatchMedia = (initial: boolean): { resize: (matches: boolean) => void } => {
  let matches = initial;
  const listeners = new Set<() => void>();
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn((query: string) => ({
      get matches(): boolean {
        return matches;
      },
      media: query,
      addEventListener: (_type: 'change', listener: () => void): void => {
        listeners.add(listener);
      },
      removeEventListener: (_type: 'change', listener: () => void): void => {
        listeners.delete(listener);
      },
    })),
  });
  return {
    resize: (next: boolean): void => {
      matches = next;
      listeners.forEach((listener) => listener());
    },
  };
};

afterEach(() => {
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('useMediaQuery', () => {
  it('answers the query and follows the window when it changes', () => {
    const screenSize = installMatchMedia(false);
    const { result } = renderHook(() => useMediaQuery(QUERY, true));
    expect(result.current).toBe(false);

    act(() => screenSize.resize(true));

    expect(result.current).toBe(true);
  });

  it('uses the fallback where the browser cannot answer', () => {
    expect(renderHook(() => useMediaQuery(QUERY, true)).result.current).toBe(true);
    expect(renderHook(() => useMediaQuery(QUERY, false)).result.current).toBe(false);
  });
});
