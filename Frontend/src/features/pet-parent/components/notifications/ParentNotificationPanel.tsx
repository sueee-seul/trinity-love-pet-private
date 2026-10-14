import { useEffect, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import type { ParentNotification } from '../../types/notifications';
import { SECONDARY_BUTTON, SECTION_TITLE } from '../home/homeStyles';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import { noticeWords } from './noticeWords';
import { NOTIFICATIONS_COPY } from './notificationsCopy';
import type { ParentNotifications } from './useParentNotifications';

// Every notice is about a stay, and My stays shows each stay's live status, so a notice sent
// before a later decision never leaves the parent on a stale answer.
const STAYS_PATH = '/parent/stays';

const STATE_TEXT = 'type-body m-0 px-4 py-8 text-center';

interface NotificationItemProps {
  notification: ParentNotification;
  isNew: boolean;
  onFollow: () => void;
}

function NotificationItem({ notification, isNew, onFollow }: NotificationItemProps): ReactElement {
  const copy = usePortalCopy(NOTIFICATIONS_COPY);
  const words = noticeWords(notification, usePortalLocale());
  return (
    <Link
      to={STAYS_PATH}
      onClick={onFollow}
      className="flex min-h-11 w-full gap-3 px-4 py-3 text-left no-underline transition-colors hover:bg-surface-cream focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
    >
      <span
        aria-hidden="true"
        className={`mt-2 h-2 w-2 shrink-0 rounded-full ${isNew ? 'bg-accent-foreground' : 'bg-transparent'}`}
      />
      <span className="min-w-0 flex-1">
        <span className={`block type-body ${isNew ? 'font-bold' : ''}`}>
          {/* The dot and the weight show "new" by sight; this says it to a screen reader. */}
          {isNew && <span className="sr-only">{copy.newPrefix}</span>}
          {words.title}
        </span>
        <span className="mt-1 block type-meta text-notice-secondary">{words.body}</span>
        <time className="mt-1 block type-meta" dateTime={notification.createdAt}>
          {copy.sentAt(notification.createdAt)}
        </time>
      </span>
    </Link>
  );
}

interface ParentNotificationPanelProps {
  bell: ParentNotifications;
  /** Closes the bell once the parent follows a notice to its stay. */
  onFollow: () => void;
}

/** The bell's open list. It mounts when the bell opens, which loads and marks the notices read. */
export function ParentNotificationPanel({
  bell,
  onFollow,
}: ParentNotificationPanelProps): ReactElement {
  const copy = usePortalCopy(NOTIFICATIONS_COPY);
  const { openBell } = bell;
  useEffect(() => {
    void openBell();
  }, [openBell]);

  const hasItems = bell.items.length > 0;

  const renderContent = (): ReactElement => {
    if (!hasItems && bell.status === 'loading') {
      return (
        <p role="status" className={`${STATE_TEXT} text-notice-muted`}>
          {copy.loading}
        </p>
      );
    }
    if (!hasItems && bell.status === 'error') {
      return (
        <div className="flex flex-col items-center gap-4 px-4 py-8 text-center">
          <p role="alert" className="type-body m-0 text-status-danger">
            {bell.error && copy.errors[bell.error]}
          </p>
          <button type="button" onClick={(): void => void openBell()} className={SECONDARY_BUTTON}>
            {copy.tryAgain}
          </button>
        </div>
      );
    }
    if (!hasItems) {
      return <p className={`${STATE_TEXT} text-notice-muted`}>{copy.empty}</p>;
    }
    return (
      <ul className="m-0 max-h-[min(28rem,calc(100vh-8rem))] list-none divide-y divide-border-soft overflow-y-auto p-0">
        {bell.items.map((notification) => (
          <li key={notification.id}>
            <NotificationItem
              notification={notification}
              isNew={notification.readAt === null || bell.newIds.has(notification.id)}
              onFollow={(): void => {
                void bell.markRead(notification);
                onFollow();
              }}
            />
          </li>
        ))}
      </ul>
    );
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border-soft bg-surface-card shadow-card">
      <div className="border-b border-border-soft px-4 py-3">
        <h2 className={`${SECTION_TITLE} m-0`}>{copy.title}</h2>
      </div>
      {hasItems && bell.error && (
        <p
          role="alert"
          className="type-meta m-0 border-b border-border-soft px-4 py-2 text-status-danger"
        >
          {copy.errors[bell.error]}
        </p>
      )}
      {renderContent()}
    </div>
  );
}
