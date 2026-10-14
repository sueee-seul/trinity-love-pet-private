import { validateImageFile } from '../../../../shared/utils/imageUpload';
import {
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type ChangeEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import { HomeIcon } from '../../components/home/HomeIcons';
import { SECTION_TITLE } from '../../components/home/homeStyles';
import { initialsOf } from '../utils';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import { PHOTO_UPLOAD_COPY, localizeImageError } from '../copy/photoUploadCopy';

/**
 * The card every account section sits on. The portal panel is already the page surface, so a
 * card is the only frame inside it: never a card inside a card.
 */
export const CARD_CLASS =
  'rounded-2xl border border-border-soft bg-surface-card p-5 shadow-card sm:p-6';

export const FOCUS_RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2';

/** A card with one h2. Every card heading on the account pages uses this one style. */
export function SectionCard({
  title,
  meta,
  children,
  className = '',
}: {
  title: string;
  /** Short text or an action beside the heading. */
  meta?: ReactNode;
  children: ReactNode;
  className?: string;
}): ReactElement {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={`${CARD_CLASS} ${className}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={headingId} className={SECTION_TITLE}>
          {title}
        </h2>
        {meta}
      </div>
      {children}
    </section>
  );
}

export interface DetailItem {
  label: string;
  value: ReactNode;
}

/** Label and value rows. Labels stack above values in a narrow card so a long address never squeezes. */
export function DetailList({ items }: { items: DetailItem[] }): ReactElement {
  return (
    // A container query, not a screen one: the same list sits in a full-width card and in a
    // half-width one, and only its own width says whether a label fits beside its value.
    <dl className="@container m-0 divide-y divide-border-soft">
      {items.map(({ label, value }) => (
        <div
          key={label}
          className="flex flex-col gap-0.5 py-3 first:pt-0 last:pb-0 @md:flex-row @md:items-baseline @md:gap-6"
        >
          <dt className="type-meta @md:w-40 @md:shrink-0">{label}</dt>
          <dd className="m-0 min-w-0 break-words type-body">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

const BUTTON_VARIANTS = {
  primary: 'bg-action-dark theme-gradient-action text-on-action-dark hover:bg-action-dark-hover',
  outline: 'border border-action-dark text-action-dark hover:bg-surface-deep',
  soft: 'bg-surface-deep text-action-dark hover:bg-surface-bubbles',
  // Outlined, not filled: deleting is the rare action on a page, so it should not be the loudest.
  danger: 'border border-status-danger text-status-danger hover:bg-status-danger/10',
  ghost: 'text-accent-foreground underline underline-offset-2 hover:text-accent-foreground-hover',
} as const;

const BUTTON_SHAPE = `inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-5 type-button transition-colors disabled:pointer-events-none disabled:opacity-50 ${FOCUS_RING}`;

/** A link that leads a page's actions (a pet's "Book a stay"), drawn as the primary button. */
export const PRIMARY_BUTTON_LINK = `${BUTTON_SHAPE} ${BUTTON_VARIANTS.primary}`;

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  variant?: keyof typeof BUTTON_VARIANTS;
}): ReactElement {
  return (
    <button
      type="button"
      className={`${BUTTON_SHAPE} ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * A short label on a pill. Tone adds colour, but the words always carry the meaning too.
 *
 * A badge wraps by default, because some hold text a person typed, such as an allergy or a
 * medicine name, and one long name must stay inside a phone-width card. Only a status label with
 * fixed short words passes `nowrap`, so it keeps its place at the end of a row.
 */
export function Badge({
  children,
  tone = 'muted',
  nowrap = false,
}: {
  children: ReactNode;
  tone?: 'muted' | 'accent' | 'success' | 'warning' | 'danger' | 'dark';
  nowrap?: boolean;
}): ReactElement {
  const tones = {
    muted: 'bg-surface-deep text-notice-secondary border-border-soft',
    accent: 'bg-accent-foreground/10 text-accent-foreground border-accent-foreground/20',
    success: 'bg-status-success/10 text-status-success border-status-success/30',
    warning: 'bg-theme-sun/15 text-theme-earth border-theme-sun/40',
    danger: 'bg-status-danger/10 text-status-danger border-status-danger/30',
    dark: 'bg-action-dark text-on-action-dark border-action-dark',
  } as const;
  // rounded-xl is a full pill at one line of 12px text, and stays a neat rounded box when a long
  // name wraps to two lines, where rounded-full would curve into the text.
  const wrapping = nowrap
    ? 'shrink-0 whitespace-nowrap rounded-full'
    : 'max-w-full whitespace-normal wrap-anywhere rounded-xl';
  return (
    <span
      className={`inline-flex items-center border px-2.5 py-1 type-eyebrow ${wrapping} ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

const PET_AVATAR_SIZES = {
  md: 'h-14 w-14 text-card-title',
  lg: 'h-20 w-20 text-display',
  xl: 'h-28 w-28 text-display',
} as const;

/**
 * A pet's photo, or its initials when there is none. The name is always written next to the
 * avatar, so the picture is decorative and has an empty alt.
 */
export function PetAvatar({
  name,
  photoUrl,
  size = 'lg',
}: {
  name: string;
  photoUrl?: string | null;
  size?: keyof typeof PET_AVATAR_SIZES;
}): ReactElement {
  const initials = initialsOf(name);
  return (
    <div
      className={`${PET_AVATAR_SIZES[size]} flex shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-border-soft bg-surface-bubbles font-fraunces font-bold text-accent-foreground`}
    >
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : initials ? (
        <span aria-hidden="true">{initials}</span>
      ) : (
        <HomeIcon name="paw" className="h-1/2 w-1/2" />
      )}
    </div>
  );
}

export function UserAvatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl?: string | null;
}): ReactElement {
  return (
    <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-action-dark font-fraunces text-display font-bold text-on-action-dark">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{initialsOf(name) || 'U'}</span>
      )}
    </div>
  );
}

// Sentence case, not the 12px capitals of a group label: a form is read one field at a time.
export const FIELD_LABEL_CLASS = 'type-meta font-semibold text-notice-secondary';

/**
 * A labelled form field. Pass `htmlFor` with the control's id when the control opens a dialog,
 * such as DateField: the label then sits beside the control instead of around it, because a click
 * on the dialog's backdrop inside a wrapping <label> is passed on to the trigger and reopens it.
 */
export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}): ReactElement {
  if (htmlFor !== undefined) {
    return (
      <div className="block space-y-1">
        <label htmlFor={htmlFor} className={FIELD_LABEL_CLASS}>
          {label}
        </label>
        {children}
      </div>
    );
  }
  return (
    <label className="block space-y-1">
      <span className={FIELD_LABEL_CLASS}>{label}</span>
      {children}
    </label>
  );
}

/**
 * Picks a photo from disk and hands the caller the file. The parent API uploads
 * it to object storage when the form is saved; the object URL is never held as
 * a base64 string in React state or sent through the JSON API.
 */
export function ImageUploadField({
  label,
  value,
  onChange,
  fallback,
  shape = 'round',
}: {
  label: string;
  value: string | null;
  onChange: (file: File | null) => void;
  fallback: ReactNode;
  shape?: 'round' | 'square';
}): ReactElement {
  const inputId = useId();
  const locale = usePortalLocale();
  const copy = usePortalCopy(PHOTO_UPLOAD_COPY);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return (): void => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleFile = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    // Reset so choosing the same file again still fires a change event.
    event.target.value = '';
    if (!file) return;

    const { error: reason } = validateImageFile(file);
    setError(reason);
    if (!reason) {
      setPreviewUrl(URL.createObjectURL(file));
      onChange(file);
    }
  };

  const removeImage = (): void => {
    setError(null);
    setPreviewUrl(null);
    onChange(null);
  };

  return (
    <div className="space-y-1">
      <span className={FIELD_LABEL_CLASS}>{label}</span>
      <div className="flex items-center gap-4">
        <div
          className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden border-2 border-border-soft bg-surface-bubbles ${shape === 'round' ? 'rounded-full' : 'rounded-xl'}`}
        >
          {previewUrl || value ? (
            <img
              src={previewUrl ?? value ?? undefined}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            fallback
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-2">
            {/*
             * Visually hidden rather than display:none, so Tab still reaches the file picker; the
             * label beside it draws the focus ring through `peer`.
             */}
            <input
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="peer sr-only"
              onChange={(event) => void handleFile(event)}
            />
            <label
              htmlFor={inputId}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-action-dark px-5 type-button text-action-dark transition-colors hover:bg-surface-deep peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2"
            >
              {copy.upload}
            </label>
            {(value || previewUrl) && (
              <Button type="button" variant="ghost" onClick={removeImage}>
                {copy.remove}
              </Button>
            )}
            <span className="self-center type-meta text-notice-muted">{copy.sizeLimit}</span>
          </div>
          {error && (
            <p role="alert" className="type-meta text-status-danger">
              {localizeImageError(error, locale)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// `field-border`, not `border-soft`: the soft border is 1.3:1 on white and leaves a field with no
// visible edge. 44px tall so a field is an easy target on a phone.
export const inputClass =
  'w-full min-h-11 rounded-xl border border-field-border bg-surface-card px-3 type-body text-notice-primary focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20';
export const textareaClass =
  'w-full min-h-24 resize-y rounded-xl border border-field-border bg-surface-card px-3 py-2.5 type-body text-notice-primary focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20';
