import type { ReactElement } from 'react';
import { Illustration, type IllustrationProps } from '../../../shared/illustrations/Illustration';
import { CareIllustrations } from '../../../shared/illustrations/CareIllustrations';
import { useConciergeStore } from '../store/conciergeStore';

/** Keeps illustration captions in the booking page's language, including standalone previews. */
export function ConciergeIllustration(props: Omit<IllustrationProps, 'language'>): ReactElement {
  const language = useConciergeStore((state) => state.locale);
  return <Illustration {...props} language={language} />;
}

/** The shared care sample follows the same language owner as package descriptions. */
export function ConciergeCareIllustrations(): ReactElement {
  const language = useConciergeStore((state) => state.locale);
  return <CareIllustrations language={language} />;
}
