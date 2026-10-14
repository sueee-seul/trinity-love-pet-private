import type { ReactElement } from 'react';
import {
  Illustration,
  type IllustrationProps,
} from '../../../../shared/illustrations/Illustration';
import { usePortalLocale } from '../../i18n/portalLocale';

/** Uses the portal's language without coupling decorative artwork to care or pet data. */
export function PortalIllustration(props: Omit<IllustrationProps, 'language'>): ReactElement {
  return <Illustration {...props} language={usePortalLocale()} />;
}
