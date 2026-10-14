import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BOOKING_PET_PARAM } from '../../pet-parent/utils/home';
import type { ConciergeStep } from '../types';

/**
 * Gives each step its own browser history entry (?step=verify|details|done on the same route), so
 * the browser's or Android's Back button moves one step instead of leaving the booking.
 *
 * The store stays the source of truth. The URL is only a hint: a step the plan cannot show (a
 * details screen with nothing agreed, a form after the request was sent) is never opened from it.
 */

const ORDER: Record<ConciergeStep, number> = { plan: 0, verify: 1, details: 2, done: 3 };
const STEPS_BACKWARDS: ConciergeStep[] = ['details', 'verify', 'plan'];

const parseStep = (value: string | null): ConciergeStep =>
  value === 'verify' || value === 'details' || value === 'done' ? value : 'plan';

export const useStepHistory = (
  step: ConciergeStep,
  moveTo: (step: ConciergeStep) => void,
  canShow: (step: ConciergeStep) => boolean,
): void => {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStep = parseStep(searchParams.get('step'));
  const seen = useRef({ step, urlStep, mounted: false });

  useEffect(() => {
    const writeUrl = (target: ConciergeStep, replace: boolean): void => {
      const next = new URLSearchParams(searchParams);
      // A pet's "Book a stay" link is read once when the page opens (useAccountPets). No step
      // entry carries it on, even when this write starts from an address that still had it.
      next.delete(BOOKING_PET_PARAM);
      if (target === 'plan') next.delete('step');
      else next.set('step', target);
      setSearchParams(next, { replace });
      seen.current.urlStep = target;
    };

    const previous = seen.current;
    const storeMoved = step !== previous.step;
    const urlMoved = urlStep !== previous.urlStep;
    seen.current = { step, urlStep, mounted: true };

    if (!previous.mounted) {
      // Arriving with ?step=details from a bookmark or a stale tab: show what the plan allows.
      if (urlStep !== step) writeUrl(step, true);
      return;
    }
    if (storeMoved && step !== urlStep) {
      // Forward moves add an entry; moving back with our own buttons does not pile them up.
      writeUrl(step, ORDER[step] < ORDER[urlStep]);
      return;
    }
    if (urlMoved && urlStep !== step) {
      // The browser's Back or Forward. A sent request never reopens its form.
      if (step === 'done') {
        writeUrl(step, true);
      } else if (canShow(urlStep)) {
        moveTo(urlStep);
      } else if (ORDER[urlStep] < ORDER[step]) {
        // Back landed on a step that no longer applies (the parent is already signed in): keep
        // going back to the nearest one that does, so one press always moves one screen.
        const earlier = STEPS_BACKWARDS.find(
          (candidate) => ORDER[candidate] < ORDER[urlStep] && canShow(candidate),
        );
        moveTo(earlier ?? 'plan');
      } else {
        writeUrl(step, true);
      }
    }
  }, [step, urlStep, searchParams, setSearchParams, moveTo, canShow]);
};
