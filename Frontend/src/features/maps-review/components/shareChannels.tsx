import type React from 'react';
import type { ShareTarget } from '../types/reviewTypes';
import { ReviewIcon } from './ReviewIcon';
import { ShareChannelGlyph } from './ShareChannelGlyph';

/** One round button in the share dialog's channel row. */
export interface ShareChannel {
  id: string;
  label: string;
  icon: React.ReactElement;
  /** Builds the channel's public share endpoint. */
  buildHref: (target: ShareTarget) => string;
  /**
   * Whether the channel needs its own tab. A web compose screen does; a `mailto:` handler is
   * taken over by the mail client and would leave an empty tab behind.
   */
  opensInNewTab: boolean;
}

const FACEBOOK_GLYPH =
  'M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94z';

const X_GLYPH =
  'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z';

const WHATSAPP_GLYPH =
  'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.002-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884M20.463 3.488A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413';

/**
 * The channels Google Maps offers on a shared review, in the same order.
 *
 * @remarks
 * These are the public share endpoints each network documents. Nothing is posted on the
 * visitor's behalf: the button only opens the network's own compose screen.
 */
export const SHARE_CHANNELS: ShareChannel[] = [
  {
    id: 'facebook',
    label: 'Share on Facebook',
    icon: <ShareChannelGlyph path={FACEBOOK_GLYPH} />,
    buildHref: ({ url }) =>
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    opensInNewTab: true,
  },
  {
    id: 'x',
    label: 'Share on X',
    icon: <ShareChannelGlyph path={X_GLYPH} />,
    buildHref: ({ url, title }) =>
      `https://x.com/intent/post?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
    opensInNewTab: true,
  },
  {
    id: 'whatsapp',
    label: 'Share on WhatsApp',
    icon: <ShareChannelGlyph path={WHATSAPP_GLYPH} />,
    buildHref: ({ url, title }) => `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    opensInNewTab: true,
  },
  {
    id: 'email',
    label: 'Share by email',
    icon: <ReviewIcon name="mail" />,
    buildHref: ({ url, title }) =>
      `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`,
    opensInNewTab: false,
  },
];
