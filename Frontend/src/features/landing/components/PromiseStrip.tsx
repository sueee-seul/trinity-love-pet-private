import React from 'react';
import { ThemeIcon, type ThemeIconName } from '../../../shared/theme';
import type { LandingCopy } from '../copy';
import { BODY, PAGE_COLUMN } from './landingStyles';

interface PromiseStripProps {
  copy: LandingCopy;
}

/** One icon per promise, in the order the copy lists them. */
const PROMISE_ICONS: readonly ThemeIconName[] = ['check', 'heart', 'user', 'shield'];

/** Four short facts straight after the hero. No cards: a hairline and space group each one. */
export const PromiseStrip: React.FC<PromiseStripProps> = ({ copy }) => {
  const { promises } = copy;
  return (
    <section aria-labelledby="landing-promises-title" className="pt-10 pb-4 sm:pt-14">
      <div className={PAGE_COLUMN}>
        <h2 id="landing-promises-title" className="sr-only">
          {promises.title}
        </h2>
        <ul className="m-0 grid list-none grid-cols-1 gap-x-8 gap-y-8 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {promises.items.map((item, index) => (
            <li
              key={item.title}
              className="theme-wiggle-host flex min-w-0 flex-col gap-3 border-t border-border-soft pt-6"
            >
              <span className="theme-wiggle-icon flex h-11 w-11 items-center justify-center rounded-full border border-border-soft bg-surface-card text-notice-primary">
                <ThemeIcon name={PROMISE_ICONS[index] ?? 'paw'} />
              </span>
              <h3 className="m-0 font-agbalumo text-[20px] font-normal leading-tight text-notice-primary">
                {item.title}
              </h3>
              <p className={BODY}>{item.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
