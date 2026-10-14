import React from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../../../shared/brand/BrandMark';
import type { ConciergeCopy } from '../copy';
import { HERO_BAND_TEXT_BUTTON, TEXT_BUTTON } from './conciergeStyles';

interface ConciergeHelpNavProps {
  copy: ConciergeCopy;
  /**
   * The public page draws the links on its hero band and adds sign-in (or the way back to the
   * portal). Inside the parent portal the owner is signed in and the portal has its own bar.
   */
  standalone: boolean;
  signedIn: boolean;
  onTalkToPerson: () => void;
  /** Opens the sign-in dialog over the plan, so the plan is never left behind. */
  onSignIn: () => void;
}

/**
 * A way to reach a person, and on the public page either sign-in for returning owners or a
 * signed-in pet parent's way back to their pet centre. The language switch lives in the
 * accessibility tools, the same place on every page.
 */
export const ConciergeHelpNav: React.FC<ConciergeHelpNavProps> = ({
  copy,
  standalone,
  signedIn,
  onTalkToPerson,
  onSignIn,
}) => {
  const textButton = standalone ? HERO_BAND_TEXT_BUTTON : TEXT_BUTTON;
  return (
    <nav aria-label={copy.helpNav} className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <button type="button" onClick={onTalkToPerson} className={textButton}>
        {copy.talkToPerson}
      </button>
      {standalone && signedIn && (
        <Link to="/parent" className={textButton}>
          {copy.myPetCentre}
        </Link>
      )}
      {standalone && !signedIn && (
        <button type="button" onClick={onSignIn} className={textButton}>
          {copy.returningSignIn}
        </button>
      )}
    </nav>
  );
};

type ConciergeHeaderProps = Omit<ConciergeHelpNavProps, 'standalone'>;

/** The public page's own brand bar, on the hero band: the wordmark and the help links. */
export const ConciergeHeader: React.FC<ConciergeHeaderProps> = (props) => (
  <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
    {/* The wordmark goes to the public landing page, where the service is explained. */}
    <Link
      to="/"
      className="inline-flex min-h-11 items-center gap-2.5 rounded-lg font-logo text-[22px] leading-none text-hero-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-hero-ink"
    >
      <BrandMark className="h-8 w-8" />
      Wagstay
    </Link>
    <ConciergeHelpNav {...props} standalone />
  </header>
);
