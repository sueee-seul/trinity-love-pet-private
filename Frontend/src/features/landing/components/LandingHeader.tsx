import React from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../../../shared/brand/BrandMark';
import type { LandingCopy } from '../copy';
import { useActiveSection } from '../hooks/useActiveSection';
import { HERO_TEXT_LINK, PAGE_COLUMN, PRIMARY_BUTTON_SMALL } from './landingStyles';

interface LandingHeaderProps {
  copy: LandingCopy;
  /** A signed-in pet parent sees the way to their pet centre instead of Sign in. */
  signedIn: boolean;
}

/** The sections the bar links to, in page order. Prices lead to /book, where the rate card is. */
const NAV_ITEMS = [
  { sectionId: 'how-it-works', key: 'howItWorks' },
  { sectionId: 'care', key: 'care' },
  { sectionId: 'faq', key: 'faq' },
] as const;

const NAV_SECTION_IDS = NAV_ITEMS.map((item) => item.sectionId);

/**
 * The top bar, in the hero colour so it reads as one piece with the hero band below it.
 *
 * From 1024px it stays at the top while the page scrolls, and the section being read shows as the
 * solid pill (`aria-current="true"`, the value for a place within a page). Phones keep it in the
 * flow: two rows would take too much of a small screen. Below 640px the section links are left out
 * so the bar stays one row (logo, Sign in, Plan a stay); the sections are a short scroll away.
 * It is `lg:sticky`, never the plain `sticky` class, because `header.sticky` is the signed-in
 * bars' hook in brand-themes.css and would give this bar their colours.
 */
export const LandingHeader: React.FC<LandingHeaderProps> = ({ copy, signedIn }) => {
  const { header } = copy;
  const activeSection = useActiveSection(NAV_SECTION_IDS);

  return (
    <header className="landing-header bg-hero theme-gradient-hero text-hero-ink lg:sticky lg:top-0 lg:z-30">
      <div className={`${PAGE_COLUMN} flex flex-wrap items-center gap-x-4 gap-y-2 py-3 sm:py-4`}>
        <Link
          to="/"
          aria-label={header.homeLabel}
          className="inline-flex items-center gap-2.5 rounded-lg font-logo text-[24px] leading-none text-hero-ink no-underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hero-ink sm:text-[28px]"
        >
          <BrandMark className="h-8 w-8 sm:h-9 sm:w-9" />
          Wagstay
        </Link>
        <nav
          aria-label={header.navLabel}
          className="order-last hidden w-full sm:block lg:order-none lg:flex lg:w-auto lg:flex-1 lg:justify-center lg:px-4"
        >
          <ul className="nav-pills nav-pills--hero overflow-x-auto">
            <li>
              <Link to="/book" className="nav-pill">
                {header.nav.prices}
              </Link>
            </li>
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <a
                  href={`#${item.sectionId}`}
                  className="nav-pill"
                  aria-current={activeSection === item.sectionId ? 'true' : undefined}
                >
                  {header.nav[item.key]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-1 gap-y-2">
          {signedIn ? (
            <Link to="/parent" className={HERO_TEXT_LINK}>
              {header.myPetCentre}
            </Link>
          ) : (
            <Link to="/login" className={HERO_TEXT_LINK}>
              {header.signIn}
            </Link>
          )}
          <Link to="/book" className={`${PRIMARY_BUTTON_SMALL} ml-1`}>
            {header.planStay}
          </Link>
        </div>
      </div>
    </header>
  );
};
