import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { usePortalCopy } from '../../i18n/portalLocale';
import type { QuickAction } from '../../utils/home';
import { HOME_COPY } from './homeCopy';
import { HomeIcon } from './HomeIcons';
import { SECTION_TITLE } from './homeStyles';

// At least 56px, and taller when a label such as "Today's updates" wraps onto a second line in a
// phone-width cell. In the side column from `lg` the icon sits above the label, so a two-word
// label keeps the tile's whole width and the four tiles stay two short rows.
const CELL =
  'flex h-full min-h-14 items-center gap-3 rounded-xl border border-border-soft bg-surface-card px-4 py-2 transition-colors hover:border-action-dark lg:flex-col lg:items-start lg:gap-1.5 lg:px-3.5 lg:py-3';

// A 2 x 2 grid for four actions, one column for two, stretched to the height of the cards
// beside it so both columns end level. Only the labels change by state.
export function QuickActions({ actions }: { actions: QuickAction[] }): ReactElement {
  const copy = usePortalCopy(HOME_COPY);
  return (
    <section aria-labelledby="quick-actions" className="flex h-full flex-col">
      <h2 id="quick-actions" className={`${SECTION_TITLE} mb-3`}>
        {copy.quickActions}
      </h2>
      {/* Two actions stack in one column, so they never stretch into two tall tiles. */}
      <ul
        className={`grid flex-1 auto-rows-fr gap-2.5 ${actions.length > 2 ? 'grid-cols-2' : 'grid-cols-1'}`}
      >
        {actions.map((action) => (
          <li key={action.key}>
            <Link to={action.to} className={CELL}>
              <HomeIcon name={action.icon} className="h-5 w-5 shrink-0 text-accent-foreground" />
              <span className="type-button leading-tight text-notice-primary">{action.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
