import type { ReactElement } from 'react';
import {
  BOOKING_TAB_TO_STATUS,
  MANAGER_REVIEW_LABELS,
  type ManagerBookingTab,
} from '../../types/booking';

const TABS: ManagerBookingTab[] = ['Booking', 'Approve', 'Refuse', 'Cancelled'];

interface BookingTabsProps {
  activeTab: ManagerBookingTab;
  onTabChange: (tab: ManagerBookingTab) => void;
  counts: Record<ManagerBookingTab, number>;
}

export function BookingTabs({ activeTab, onTabChange, counts }: BookingTabsProps): ReactElement {
  return (
    <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-action-dark p-1">
      {TABS.map((tab) => {
        const isActive = tab === activeTab;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={`shrink-0 whitespace-nowrap rounded-lg px-4 py-2 type-body font-semibold transition-colors ${
              isActive
                ? 'bg-surface-card text-action-dark'
                : 'text-on-action-dark/70 hover:text-on-action-dark'
            }`}
          >
            {MANAGER_REVIEW_LABELS[BOOKING_TAB_TO_STATUS[tab]]}
            {counts[tab] > 0 ? ` (${counts[tab]})` : ''}
          </button>
        );
      })}
    </div>
  );
}
