import React from 'react';
import { ConciergeIllustration as Illustration } from '../../concierge/components/ConciergeIllustration';
import type { IllustrationName } from '../../../shared/illustrations/illustrationAssets';
import type { LandingCopy } from '../copy';
import { BODY, PAGE_COLUMN, SECTION, SECTION_TITLE } from './landingStyles';

interface HowItWorksSectionProps {
  copy: LandingCopy;
}

const BOOKING_ART: readonly IllustrationName[] = [
  'booking-introduce',
  'booking-choose',
  'booking-submit',
  'booking-arrive',
];

/** The four steps from first question to check-in, as numbered, in reading order. */
export const HowItWorksSection: React.FC<HowItWorksSectionProps> = ({ copy }) => {
  const { howItWorks } = copy;
  return (
    <section
      id="how-it-works"
      aria-labelledby="landing-how-title"
      className={`${SECTION} border-y border-border-soft bg-surface-card`}
    >
      <div className={PAGE_COLUMN}>
        <h2 id="landing-how-title" className={SECTION_TITLE}>
          {howItWorks.title}
        </h2>
        <ol className="m-0 mt-10 grid list-none gap-x-8 gap-y-10 p-0 md:grid-cols-2 lg:grid-cols-4">
          {howItWorks.steps.map((step, index) => (
            <li key={step.title} className="flex min-w-0 flex-col gap-3">
              <Illustration name={BOOKING_ART[index] ?? 'booking-arrive'} />
              <span
                aria-hidden="true"
                className="font-fraunces text-[52px] leading-none text-notice-muted tabular-nums"
              >
                {index + 1}
              </span>
              <h3 className="m-0 font-agbalumo text-[21px] font-normal leading-tight text-notice-primary">
                {step.title}
              </h3>
              <p className={BODY}>{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
