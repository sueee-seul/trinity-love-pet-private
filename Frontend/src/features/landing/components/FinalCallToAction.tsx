import React from 'react';
import { Link } from 'react-router-dom';
import type { LandingCopy } from '../copy';
import { HERO_OUTLINE_BUTTON, PAGE_COLUMN, PRIMARY_BUTTON } from './landingStyles';

interface FinalCallToActionProps {
  copy: LandingCopy;
  onTalkToPerson: () => void;
}

/** The last ask, on the hero colour so the page ends where it began. */
export const FinalCallToAction: React.FC<FinalCallToActionProps> = ({ copy, onTalkToPerson }) => {
  const { finalCta } = copy;
  return (
    <section aria-labelledby="landing-final-title" className="pb-16 sm:pb-20 lg:pb-28">
      <div className={PAGE_COLUMN}>
        <div className="flex flex-col items-start gap-5 rounded-[32px] bg-hero theme-gradient-hero px-6 py-12 text-hero-ink sm:px-10 sm:py-14 lg:px-16 lg:py-20">
          <h2
            id="landing-final-title"
            className="m-0 max-w-[20ch] text-balance font-agbalumo text-[clamp(30px,4.4vw,48px)] font-normal leading-[1.1] text-hero-ink"
          >
            {finalCta.title}
          </h2>
          <p className="m-0 max-w-[56ch] text-[18px] leading-8 text-hero-ink/80">{finalCta.lead}</p>
          <div className="flex flex-wrap gap-3">
            <Link to="/book" className={PRIMARY_BUTTON}>
              {finalCta.planStay}
            </Link>
            <button type="button" onClick={onTalkToPerson} className={HERO_OUTLINE_BUTTON}>
              {finalCta.talkToPerson}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
