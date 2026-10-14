import React from 'react';
import { NotificationPopover } from '../../../shared/components/ui/NotificationPopover';
import { ParentNotificationPanel } from './notifications/ParentNotificationPanel';
import { useParentNotifications } from './notifications/useParentNotifications';

/**
 * The parent's bell: how many notices are unread, and the list. It opens on a click only, never
 * on hover, because opening it marks the notices read.
 */
export const PetParentNotificationPopover: React.FC = () => {
  const bell = useParentNotifications();
  return (
    <NotificationPopover
      notificationCount={bell.unreadCount}
      popoverId="pet-parent-notification-list"
      openOnHover={false}
    >
      {(close): React.ReactNode => <ParentNotificationPanel bell={bell} onFollow={close} />}
    </NotificationPopover>
  );
};
