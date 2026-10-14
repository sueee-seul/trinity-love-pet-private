import React from 'react';
import { ThemeIcon } from '../../../shared/theme';
import { CONCIERGE_MAX_PETS, MAX_ONLINE_NIGHTS } from '../../concierge';
import type { LandingCopy } from '../copy';
import { BODY, PAGE_COLUMN, SECTION, SECTION_TITLE } from './landingStyles';

interface FaqSectionProps {
  copy: LandingCopy;
}

/**
 * Plain questions with native details and summary: keyboard and screen reader support come from
 * the browser, and every answer is in the page for search engines and the speech reader.
 */
export const FaqSection: React.FC<FaqSectionProps> = ({ copy }) => {
  const { faq } = copy;
  const items = faq.items(CONCIERGE_MAX_PETS, MAX_ONLINE_NIGHTS);
  return (
    <section id="faq" aria-labelledby="landing-faq-title" className={SECTION}>
      <div
        className={`${PAGE_COLUMN} grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16`}
      >
        <h2 id="landing-faq-title" className={SECTION_TITLE}>
          {faq.title}
        </h2>
        <div className="landing-faq min-w-0 border-t border-border-soft">
          {items.map((item) => (
            <details key={item.question} className="group border-b border-border-soft">
              <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-lg py-4 font-inter text-[17px] leading-6 text-notice-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                <span className="min-w-0">{item.question}</span>
                <ThemeIcon
                  name="plus"
                  className="h-5 w-5 shrink-0 text-notice-secondary transition-transform duration-200 ease-out group-open:rotate-45 motion-reduce:transition-none"
                />
              </summary>
              <p className={`${BODY} max-w-[62ch] pb-5`}>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
};
