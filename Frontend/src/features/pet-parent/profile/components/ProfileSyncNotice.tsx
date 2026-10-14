import type { ReactElement } from 'react';
import type { ProfileSyncState } from '../repository';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import { ACCOUNT_CHROME_COPY, localizeSyncError } from '../copy/accountCopy';

/**
 * Says what the server said.
 *
 * There is no browser copy of the profile any more, so a failure is a plain
 * failure: nothing was saved, and the screen says so instead of implying a
 * local copy is holding the change. Success is silent: it is the expected
 * result and does not need celebrating.
 *
 * The sync state does not know whether the failed call was a read or a write, but the page does:
 * with no profile on screen, nothing could have been saved, so it passes a load `title` instead
 * of the default "Not saved".
 * Both messages sit on an opaque ground: the portal panel behind them is glass.
 * The error's tint is mixed into the card colour rather than laid over the glass.
 */
export function ProfileSyncNotice({
  sync,
  title,
}: {
  sync: ProfileSyncState;
  title?: string;
}): ReactElement | null {
  const locale = usePortalLocale();
  const copy = usePortalCopy(ACCOUNT_CHROME_COPY);
  if (sync.error) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-status-danger/30 bg-[color-mix(in_srgb,var(--color-status-danger)_6%,var(--color-surface-card))] p-4"
      >
        <p className="type-body font-medium text-status-danger mb-1">{title ?? copy.notSaved}</p>
        <p className="type-meta mb-0">{localizeSyncError(sync.error, locale)}</p>
      </div>
    );
  }

  if (sync.loading) {
    return (
      <p className="parent-plate type-meta text-notice-muted" role="status">
        {copy.loadingProfile}
      </p>
    );
  }

  return null;
}
