import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSiteCopy, type SiteCopy } from '../../i18n/siteLanguage';
import {
  HEADER_ICON,
  HEADER_ICON_BUTTON,
  HEADER_ICON_BUTTON_ACTIVE,
  HEADER_ICON_COUNT,
  HEADER_ICON_STROKE_WIDTH,
} from './headerIconStyles';

interface NotificationPopoverProps {
  notificationCount: number;
  href?: string;
  popoverId: string;
  openOnHover?: boolean;
  /** The list. A function receives `close`, for an item that navigates away. */
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
}

interface NotificationPopoverCopy {
  /** The count is part of the button's name, so a screen reader hears it with the button. */
  trigger: (notificationCount: number) => string;
  region: string;
}

const NOTIFICATION_POPOVER_COPY: SiteCopy<NotificationPopoverCopy> = {
  en: {
    trigger: (count) => (count > 0 ? `Open notifications, ${count} unread` : 'Open notifications'),
    region: 'Notifications',
  },
  zh: {
    trigger: (count) => (count > 0 ? `打开通知，${count} 条未读` : '打开通知'),
    region: '通知',
  },
};

export const NotificationPopover: React.FC<NotificationPopoverProps> = ({
  notificationCount,
  href,
  popoverId,
  openOnHover = true,
  children,
}) => {
  const copy = useSiteCopy(NOTIFICATION_POPOVER_COPY);
  const [isOpen, setIsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent): void => {
      const target = event.target;
      if (
        notificationRef.current &&
        target instanceof Node &&
        !notificationRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);
    return (): void => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const triggerContent = (
    <span className={HEADER_ICON}>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={HEADER_ICON_STROKE_WIDTH}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
        />
      </svg>
      {notificationCount > 0 && (
        <span aria-hidden="true" className={HEADER_ICON_COUNT}>
          {notificationCount}
        </span>
      )}
    </span>
  );

  const triggerClassName = `${HEADER_ICON_BUTTON} ${isOpen ? HEADER_ICON_BUTTON_ACTIVE : ''}`;

  return (
    <div
      ref={notificationRef}
      className="relative flex"
      onMouseEnter={openOnHover ? (): void => setIsOpen(true) : undefined}
      onMouseLeave={openOnHover ? (): void => setIsOpen(false) : undefined}
    >
      {href ? (
        <Link
          to={href}
          aria-label={copy.trigger(notificationCount)}
          aria-expanded={isOpen}
          aria-controls={popoverId}
          className={triggerClassName}
          onFocus={openOnHover ? (): void => setIsOpen(true) : undefined}
        >
          {triggerContent}
        </Link>
      ) : (
        <button
          type="button"
          aria-label={copy.trigger(notificationCount)}
          aria-expanded={isOpen}
          aria-controls={popoverId}
          className={triggerClassName}
          onClick={(): void => setIsOpen((open) => !open)}
          onFocus={openOnHover ? (): void => setIsOpen(true) : undefined}
        >
          {triggerContent}
        </button>
      )}

      {isOpen && (
        <div
          id={popoverId}
          role="region"
          aria-label={copy.region}
          className="absolute right-0 top-full z-50 w-[min(20rem,calc(100vw-2rem))] pt-3"
        >
          {typeof children === 'function' ? children(() => setIsOpen(false)) : children}
        </div>
      )}
    </div>
  );
};
