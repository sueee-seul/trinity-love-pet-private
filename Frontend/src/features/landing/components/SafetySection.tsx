import React from 'react';
import { ThemeIcon } from '../../../shared/theme';
import grayCatPhoto from '../assets/gray-cat-garden-lying.webp';
import type { LandingCopy } from '../copy';
import { BODY, LEAD, PAGE_COLUMN, PHOTO, SECTION, SECTION_TITLE } from './landingStyles';

interface SafetySectionProps {
  copy: LandingCopy;
}

/**
 * What every pet parent is asked for before check-in. The list matches the safety tasks the
 * booking confirmation hands out, so the landing page never promises a check the flow skips.
 */
export const SafetySection: React.FC<SafetySectionProps> = ({ copy }) => {
  const { safety } = copy;
  return (
    <section
      aria-labelledby="landing-safety-title"
      className={`${SECTION} border-y border-border-soft bg-surface-card`}
    >
      <div
        className={`${PAGE_COLUMN} grid items-center gap-10 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-16`}
      >
        <div className="flex min-w-0 flex-col gap-5">
          <h2 id="landing-safety-title" className={SECTION_TITLE}>
            {safety.title}
          </h2>
          <p className={LEAD}>{safety.lead}</p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {safety.items.map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 text-[18px] leading-7 text-notice-primary"
              >
                <ThemeIcon name="check" className="mt-0.5 h-6 w-6 shrink-0 text-notice-secondary" />
                <span className="min-w-0">{item}</span>
              </li>
            ))}
          </ul>
          <p className={BODY}>{safety.close}</p>
        </div>
        <div className="theme-photo-frame aspect-[4/3] overflow-hidden rounded-[28px] bg-surface-cream">
          <img
            src={grayCatPhoto}
            alt={safety.photoAlt}
            width={1200}
            height={900}
            loading="lazy"
            decoding="async"
            className={PHOTO}
          />
        </div>
      </div>
    </section>
  );
};
