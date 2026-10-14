import type { StaysTab } from '../../types/stays';

/** The one panel both stays tabs control. StaysTabs points at it and MyStaysPage renders it. */
export const STAYS_PANEL_ID = 'stays-panel';

/** The id of a stays tab, so the panel can name the tab that labels it. */
export function staysTabId(tab: StaysTab): string {
  return `stays-tab-${tab}`;
}
