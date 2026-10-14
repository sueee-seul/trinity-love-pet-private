import { useRef, type KeyboardEvent, type ReactElement } from 'react';
import { usePortalCopy } from '../../i18n/portalLocale';
import type { StaysTab } from '../../types/stays';
import { STAYS_COPY } from './staysCopy';
import { STAYS_PANEL_ID, staysTabId } from './staysTabIds';

interface StaysTabsProps {
  activeTab: StaysTab;
  /** Written into the Upcoming tab's own label, "Upcoming (2)", so a screen reader hears the
   * count with the tab it belongs to. Past stays only grow, so that tab carries no count. */
  upcomingCount: number;
  onTabChange: (tab: StaysTab) => void;
}

const TAB_ORDER: StaysTab[] = ['upcoming', 'past'];

// Arrow keys, Home and End move between tabs, as in the WAI-ARIA tabs pattern. Returns null for
// any other key so the tab list leaves it alone.
function tabForKey(key: string, current: StaysTab): StaysTab | null {
  const index = TAB_ORDER.indexOf(current);
  const last = TAB_ORDER.length - 1;
  const targets: Record<string, number> = {
    ArrowRight: index === last ? 0 : index + 1,
    ArrowLeft: index === 0 ? last : index - 1,
    Home: 0,
    End: last,
  };
  const target = targets[key];
  return target === undefined ? null : (TAB_ORDER[target] ?? null);
}

export function StaysTabs({ activeTab, upcomingCount, onTabChange }: StaysTabsProps): ReactElement {
  const copy = usePortalCopy(STAYS_COPY).tabs;
  const tabRefs = useRef<Partial<Record<StaysTab, HTMLButtonElement | null>>>({});

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const next = tabForKey(event.key, activeTab);
    if (!next) return;
    event.preventDefault();
    onTabChange(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div
      role="tablist"
      aria-label={copy.listLabel}
      onKeyDown={handleKeyDown}
      className="flex gap-6 border-b border-border-soft"
    >
      {TAB_ORDER.map((tab) => {
        const isSelected = tab === activeTab;
        return (
          <button
            key={tab}
            ref={(element): void => {
              tabRefs.current[tab] = element;
            }}
            type="button"
            role="tab"
            id={staysTabId(tab)}
            aria-selected={isSelected}
            aria-controls={STAYS_PANEL_ID}
            tabIndex={isSelected ? 0 : -1}
            onClick={(): void => onTabChange(tab)}
            className={`type-button -mb-px min-h-11 border-b-2 px-1 transition-colors ${
              isSelected
                ? 'border-accent-foreground text-notice-primary'
                : 'border-transparent text-notice-muted hover:text-notice-primary'
            }`}
          >
            {tab === 'upcoming' ? copy.upcoming(upcomingCount) : copy.past}
          </button>
        );
      })}
    </div>
  );
}
