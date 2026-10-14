import type { ReactElement } from 'react';
import { usePortalCopy } from '../../i18n/portalLocale';
import type { SummaryMedia } from '../../types/liveCare';
import { LIVE_CARE_COPY } from './liveCareCopy';

const MEDIA_CLASS = 'mt-3 h-48 w-full rounded-xl object-cover sm:h-80';

/**
 * The photo or short video an update carries. A video starts muted and only plays when the parent
 * presses play, so the page never makes a sound by itself; `preload="metadata"` loads just enough
 * for the first frame and the length, not the whole clip.
 */
export function UpdateMedia({
  media,
  petName,
}: {
  media: SummaryMedia;
  petName: string;
}): ReactElement {
  const copy = usePortalCopy(LIVE_CARE_COPY).updates;
  if (media.kind === 'video') {
    return (
      <video
        src={media.url}
        controls
        muted
        playsInline
        preload="metadata"
        aria-label={copy.videoLabel(petName)}
        className={`${MEDIA_CLASS} bg-surface-deep object-contain`}
      />
    );
  }
  return (
    <img
      src={media.url}
      alt={copy.photoAlt(petName)}
      className={MEDIA_CLASS}
      loading="lazy"
      decoding="async"
    />
  );
}
