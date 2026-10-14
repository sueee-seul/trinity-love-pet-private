import React, { useEffect, useRef } from 'react';

const RULER_HEIGHT_PX = 44;

/**
 * A horizontal band that follows the pointer, so a visitor who loses their place can keep one line
 * visually isolated. Pointer-events are off so the band never intercepts a click.
 *
 * The position is written straight to the node through a ref, inside a single queued animation
 * frame. Holding it in React state instead meant a re-render for every `pointermove` the browser
 * fired - well over a hundred a second while the mouse is moving - and that was enough to make the
 * whole page feel like it was stuttering. Nothing else re-renders when the pointer moves, so
 * nothing needs to know the position except this one element.
 */
export const ReadingRuler: React.FC = () => {
  const bandRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let frame = 0;
    let pointerY: number | null = null;

    const paint = (): void => {
      frame = 0;
      const band = bandRef.current;
      if (!band || pointerY === null) {
        return;
      }
      // Hidden until the pointer has been somewhere, so the band never starts pinned to the top.
      band.style.visibility = 'visible';
      band.style.transform = `translateY(${pointerY - RULER_HEIGHT_PX / 2}px)`;
    };

    const handlePointerMove = (event: PointerEvent): void => {
      pointerY = event.clientY;
      // Coalesces a burst of pointer events into one paint per frame.
      if (frame === 0) {
        frame = window.requestAnimationFrame(paint);
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    return (): void => {
      window.removeEventListener('pointermove', handlePointerMove);
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, []);

  return (
    <div
      ref={bandRef}
      aria-hidden="true"
      data-testid="accessibility-reading-ruler"
      className="pointer-events-none fixed left-0 right-0 top-0 z-[65] border-y-2 border-theme-sun bg-theme-sun/15"
      style={{ height: RULER_HEIGHT_PX, visibility: 'hidden', willChange: 'transform' }}
    />
  );
};
