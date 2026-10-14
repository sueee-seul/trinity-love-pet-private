import React from 'react';
import { ConciergeIllustration as Illustration } from '../../concierge/components/ConciergeIllustration';
import { Link } from 'react-router-dom';
import { ThemeIcon, type ThemeIconName } from '../../../shared/theme';
import type { ConciergeCopy } from '../../concierge';
import type { LandingCopy } from '../copy';
import { CARD, LEAD, PAGE_COLUMN, PRIMARY_BUTTON, SECTION, SECTION_TITLE } from './landingStyles';

interface AssistantSectionProps {
  copy: LandingCopy;
  /** The /book copy: the assistant's real greeting and its AI label are quoted from it. */
  conciergeCopy: ConciergeCopy;
}

/** One icon per point, in the order the copy lists them. */
const POINT_ICONS: readonly ThemeIconName[] = ['chat', 'home', 'check', 'user'];

/**
 * The booking assistant, introduced honestly: it is an AI, it says so, and the greeting shown is
 * the one /book opens with, word for word.
 */
export const AssistantSection: React.FC<AssistantSectionProps> = ({ copy, conciergeCopy }) => {
  const { assistant } = copy;
  return (
    <section aria-labelledby="landing-assistant-title" className={SECTION}>
      <div
        className={`${PAGE_COLUMN} grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16`}
      >
        <div className="flex min-w-0 flex-col gap-5">
          <h2 id="landing-assistant-title" className={SECTION_TITLE}>
            {assistant.title}
          </h2>
          <p className={LEAD}>{assistant.lead}</p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {assistant.points.map((point, index) => (
              <li
                key={point}
                className="flex items-start gap-3 text-[18px] leading-7 text-notice-primary"
              >
                <ThemeIcon
                  name={POINT_ICONS[index] ?? 'paw'}
                  className="mt-0.5 h-6 w-6 shrink-0 text-notice-secondary"
                />
                <span className="min-w-0">{point}</span>
              </li>
            ))}
          </ul>
          <Link to="/book" className={`${PRIMARY_BUTTON} self-start`}>
            {assistant.cta}
          </Link>
        </div>
        <figure className={`${CARD} theme-key-card m-0 min-w-0 p-6 sm:p-8`}>
          <figcaption className="font-inter text-[13.5px] leading-5 text-notice-muted">
            {assistant.sampleLabel}
          </figcaption>
          <div className="mt-5 flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border-soft bg-surface-cream text-notice-primary">
              <Illustration
                name="assistant"
                caption={false}
                imageClassName="h-11 w-11 rounded-full object-cover"
              />
            </span>
            <div className="min-w-0 flex-1">
              <p className="m-0 font-inter text-[13px] font-bold text-notice-secondary">
                {conciergeCopy.aiBadge}
              </p>
              <blockquote className="m-0 mt-2 rounded-[22px] rounded-tl-md border border-border-soft bg-surface-cream px-5 py-4 text-[17px] leading-7 text-notice-primary">
                {conciergeCopy.chat.greeting('unknown')}
              </blockquote>
            </div>
          </div>
        </figure>
      </div>
    </section>
  );
};
