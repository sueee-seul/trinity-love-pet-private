import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CONCIERGE_COPY,
  HandoffPanel,
  useConciergeLocale,
  useConciergeStatus,
  useSignedInPetOwner,
} from '../../concierge';
import { LANDING_COPY } from '../copy';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import '../landing.css';
import { AssistantSection } from './AssistantSection';
import { CareUpdatesSection } from './CareUpdatesSection';
import { FaqSection } from './FaqSection';
import { FinalCallToAction } from './FinalCallToAction';
import { HowItWorksSection } from './HowItWorksSection';
import { LandingFooter } from './LandingFooter';
import { LandingHeader } from './LandingHeader';
import { LandingHero } from './LandingHero';
import { PetsSection } from './PetsSection';
import { PromiseStrip } from './PromiseStrip';
import { SafetySection } from './SafetySection';
import { ThemeSection } from './ThemeSection';
import { ThemeDivider } from '../../../shared/theme';
import { PAGE_COLUMN } from './landingStyles';

const SKIP_LINK =
  'sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:rounded-full focus:bg-surface-card focus:px-5 focus:py-3 focus:font-inter focus:font-bold focus:text-notice-primary focus:shadow-card focus:outline-2 focus:outline-offset-2 focus:outline-focus';

/**
 * The public front page at "/": what Wagstay is and how booking works, for guests
 * and signed-in pet parents alike. Every section links on to /book, where the stay is planned.
 *
 * The language is the one /book uses (English unless the guest or the link asks for Chinese), so
 * a choice made here carries over. "Talk to a person" opens the same hand-off /book offers.
 */
export const LandingPage: React.FC = () => {
  const { locale } = useConciergeLocale();
  const signedIn = useSignedInPetOwner();
  const status = useConciergeStatus();
  const navigate = useNavigate();
  const [handoffOpen, setHandoffOpen] = useState(false);
  const copy = LANDING_COPY[locale];
  const conciergeCopy = CONCIERGE_COPY[locale];

  useDocumentTitle(copy.documentTitle);

  return (
    <div
      lang={locale === 'zh' ? 'zh-Hans' : 'en-NZ'}
      className="landing-page min-h-dvh overflow-x-clip bg-surface-cream text-notice-primary"
    >
      <a href="#main" className={SKIP_LINK}>
        {copy.skipLink}
      </a>
      <LandingHeader copy={copy} signedIn={signedIn} />
      <main id="main" tabIndex={-1} className="theme-pattern focus:outline-none">
        <LandingHero copy={copy} />
        <PromiseStrip copy={copy} />
        <ThemeDivider className={PAGE_COLUMN} />
        <HowItWorksSection copy={copy} />
        <CareUpdatesSection copy={copy} conciergeCopy={conciergeCopy} signedIn={signedIn} />
        <ThemeDivider className={PAGE_COLUMN} />
        <PetsSection copy={copy} />
        <SafetySection copy={copy} />
        <ThemeDivider className={PAGE_COLUMN} />
        <AssistantSection copy={copy} conciergeCopy={conciergeCopy} />
        <ThemeDivider className={PAGE_COLUMN} />
        <ThemeSection copy={copy} />
        <ThemeDivider className={PAGE_COLUMN} />
        <FaqSection copy={copy} />
        <FinalCallToAction copy={copy} onTalkToPerson={() => setHandoffOpen(true)} />
      </main>
      <LandingFooter copy={copy} signedIn={signedIn} />
      <HandoffPanel
        copy={conciergeCopy}
        status={status}
        open={handoffOpen}
        onClose={() => setHandoffOpen(false)}
        {...(!signedIn
          ? {
              onSignIn: (): void => {
                setHandoffOpen(false);
                navigate('/login');
              },
            }
          : {})}
      />
    </div>
  );
};
