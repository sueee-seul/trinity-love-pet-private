import type { ReactElement } from 'react';
import { useSiteLanguage, type SiteLanguage } from '../i18n/siteLanguage';
import { illustrationAsset, type IllustrationName } from './illustrationAssets';

export interface IllustrationProps {
  name: IllustrationName;
  className?: string;
  imageClassName?: string;
  /** Hide the caption only for decorative avatars beside an existing AI label. */
  caption?: boolean;
  language?: SiteLanguage;
  /** Use phrasing content inside a package's radio label. */
  inline?: boolean;
}

/** Shows labelled, lazy-loaded concept art with editable bilingual captions. */
export function Illustration({
  name,
  className = '',
  imageClassName = 'aspect-video w-full rounded-2xl object-cover',
  caption = true,
  language,
  inline = false,
}: IllustrationProps): ReactElement {
  const siteLanguage = useSiteLanguage();
  const asset = illustrationAsset(name, language ?? siteLanguage);
  const Frame = inline ? 'span' : 'figure';
  const Caption = inline ? 'span' : 'figcaption';
  const artwork = (
    <img
      src={asset.src}
      alt={caption ? asset.alt : ''}
      width={asset.width}
      height={asset.height}
      loading="lazy"
      decoding="async"
      className={`${!caption ? className : ''} ${imageClassName}`}
    />
  );
  if (!caption) return artwork;
  return (
    <Frame className={`m-0 block min-w-0 ${className}`}>
      {artwork}
      {caption && (
        <Caption className="mt-2 block type-meta text-notice-muted">
          {asset.aiLabel} · {asset.label}
        </Caption>
      )}
    </Frame>
  );
}
