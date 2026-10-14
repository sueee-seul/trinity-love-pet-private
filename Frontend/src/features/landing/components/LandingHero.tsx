import React from 'react';
import { Link } from 'react-router-dom';
import { ThemeHeroOrnament, ThemeIcon, ThemeLaceEdge } from '../../../shared/theme';
import type { LandingCopy } from '../copy';
import { HERO_OUTLINE_BUTTON, PAGE_COLUMN, PRIMARY_BUTTON } from './landingStyles';

interface LandingHeroProps {
  copy: LandingCopy;
}

interface AccentedTitleProps {
  title: string;
  accent: string;
}

/**
 * The title with one word wrapped, so Strawberry Cream can draw a honey wave under it and Maison
 * Noir can set it in gold italics. The text a screen reader hears is unchanged. If the word is not
 * in the title, the title renders plain rather than guessing.
 */
const AccentedTitle: React.FC<AccentedTitleProps> = ({ title, accent }) => {
  const start = accent ? title.indexOf(accent) : -1;
  if (start === -1) {
    return <>{title}</>;
  }

  return (
    <>
      {title.slice(0, start)}
      <span className="theme-accent-word">{accent}</span>
      {title.slice(start + accent.length)}
    </>
  );
};

/**
 * The first screen: the promise, the two ways forward, and the current theme's picture.
 *
 * The picture is the hero band's CSS background (`.theme-hero-band`), so it changes with the theme
 * and the reading colours can take it away. On phones the band veils it behind the copy, so a
 * second, uncovered view of it sits under the buttons; it repeats the band and is hidden from
 * assistive technology.
 */
export const LandingHero: React.FC<LandingHeroProps> = ({ copy }) => {
  const { hero } = copy;
  return (
    <>
      <section aria-labelledby="landing-title" className="theme-hero-band relative">
        <ThemeHeroOrnament />
        <div
          className={`${PAGE_COLUMN} flex flex-col justify-center pt-10 pb-10 sm:pt-14 md:min-h-[460px] md:pb-16 lg:min-h-[540px]`}
        >
          <div className="landing-hero-copy flex min-w-0 flex-col gap-6">
            <h1
              id="landing-title"
              className="m-0 max-w-[16ch] text-balance font-agbalumo text-[clamp(38px,6.2vw,68px)] font-normal leading-[1.04] text-hero-ink"
            >
              <AccentedTitle title={hero.title} accent={hero.titleAccent} />
            </h1>
            <p className="m-0 max-w-[52ch] text-[18px] leading-8 text-hero-ink/80 sm:text-[19px]">
              {hero.lead}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/book" className={PRIMARY_BUTTON}>
                {hero.planStay}
              </Link>
              <Link to="/book" className={HERO_OUTLINE_BUTTON}>
                {hero.seePrices}
              </Link>
            </div>
            <p className="m-0 flex items-start gap-2 font-inter text-[14px] leading-6 text-hero-ink/80">
              <ThemeIcon name="check" className="mt-0.5 h-5 w-5 shrink-0" />
              <span>{hero.reassurance}</span>
            </p>
          </div>
          <div
            aria-hidden="true"
            className="landing-hero-picture bg-theme-image mt-10 aspect-[16/10] w-full rounded-[24px] md:hidden"
          />
        </div>
      </section>
      <div className="landing-hero-edge -mt-px print:hidden">
        <ThemeLaceEdge />
      </div>
    </>
  );
};
