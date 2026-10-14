import React from 'react';
import { Link } from 'react-router-dom';
import { BrandMark } from '../../../shared/brand/BrandMark';
import type { LandingCopy } from '../copy';
import { PAGE_COLUMN } from './landingStyles';

interface LandingFooterProps {
  copy: LandingCopy;
  signedIn: boolean;
}

const FOOTER_LINK =
  'inline-flex min-h-11 items-center rounded-full font-inter text-[15px] text-notice-primary underline decoration-1 underline-offset-4 hover:decoration-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';

/** The brand line, the ways in, and the year. */
export const LandingFooter: React.FC<LandingFooterProps> = ({ copy, signedIn }) => {
  const { footer } = copy;
  return (
    <footer className="border-t border-border-soft bg-surface-card pb-[max(8.5rem,env(safe-area-inset-bottom))] md:pb-10">
      <div className={`${PAGE_COLUMN} flex flex-col gap-6 pt-10 md:flex-row md:justify-between`}>
        <div className="flex flex-col gap-2">
          <p className="m-0 flex items-center gap-2.5 font-logo text-[26px] leading-none text-notice-primary">
            <BrandMark className="h-8 w-8" />
            Wagstay
          </p>
          <p className="m-0 text-[16px] leading-6 text-notice-secondary">{footer.tagline}</p>
        </div>
        <nav aria-label={footer.navLabel}>
          <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-1 p-0">
            <li>
              <Link to="/book" className={FOOTER_LINK}>
                {footer.planStay}
              </Link>
            </li>
            <li>
              <Link to="/book" className={FOOTER_LINK}>
                {footer.prices}
              </Link>
            </li>
            {signedIn ? (
              <li>
                <Link to="/parent" className={FOOTER_LINK}>
                  {footer.myPetCentre}
                </Link>
              </li>
            ) : (
              <>
                <li>
                  <Link to="/login" className={FOOTER_LINK}>
                    {footer.signIn}
                  </Link>
                </li>
                <li>
                  <Link to="/signup" className={FOOTER_LINK}>
                    {footer.createAccount}
                  </Link>
                </li>
              </>
            )}
          </ul>
        </nav>
      </div>
      <p className={`${PAGE_COLUMN} mt-8 mb-0 font-inter text-[13px] text-notice-muted`}>
        {footer.copyright(new Date().getFullYear())}
      </p>
    </footer>
  );
};
