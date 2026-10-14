import React from 'react';
import type { ConciergeCopy } from '../copy';
import type { ConciergeStep } from '../types';

type RailStep = keyof ConciergeCopy['steps'];

const RAIL: RailStep[] = ['plan', 'choose', 'verify', 'details', 'done'];

/** "Choose" happens on the plan screen, once suggested stays exist, so it has no screen of its own. */
const currentRailStep = (step: ConciergeStep, hasOptions: boolean): RailStep => {
  if (step === 'plan') return hasOptions ? 'choose' : 'plan';
  return step;
};

interface StepRailProps {
  copy: ConciergeCopy;
  step: ConciergeStep;
  hasOptions: boolean;
  /** Signed-in owners never see the email step, so it is not shown to them as a step. */
  skipVerify: boolean;
}

/** Where the guest is. Numbers and a text state carry the progress, not colour alone. */
export const StepRail: React.FC<StepRailProps> = ({ copy, step, hasOptions, skipVerify }) => {
  const rail = skipVerify ? RAIL.filter((railStep) => railStep !== 'verify') : RAIL;
  const current = rail.indexOf(currentRailStep(step, hasOptions));
  return (
    // `relative` makes the rail the box its screen-reader-only labels are placed in. Without it a
    // "(done)" label past the right edge on a phone escaped the scroller and widened the page.
    // On a phone only the current step shows its name; the others show their number or tick, with
    // the name kept for screen readers, so four or five steps fit one line without scrolling.
    <ol className="relative m-0 flex list-none items-center gap-1.5 overflow-x-auto p-0 [scrollbar-width:none] sm:gap-2 print:hidden">
      {rail.map((railStep, index) => {
        const state = index < current ? 'done' : index === current ? 'current' : 'upcoming';
        return (
          <li key={railStep} className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
            <span
              aria-current={state === 'current' ? 'step' : undefined}
              className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 type-meta font-semibold ${
                state === 'current'
                  ? 'border-action-dark bg-action-dark text-on-action-dark'
                  : state === 'done'
                    ? 'border-border-soft bg-surface-bubbles text-notice-primary'
                    : 'border-border-soft bg-surface-card text-notice-muted'
              }`}
            >
              <span aria-hidden="true" className="tabular-nums">
                {state === 'done' ? '✓' : index + 1}
              </span>
              <span className={state === 'current' ? undefined : 'max-sm:sr-only'}>
                {copy.steps[railStep]}
              </span>
              {state === 'done' && <span className="sr-only">{copy.a11y.done}</span>}
            </span>
            {index < rail.length - 1 && (
              <span aria-hidden="true" className="h-px w-2 bg-border-soft sm:w-6" />
            )}
          </li>
        );
      })}
    </ol>
  );
};
