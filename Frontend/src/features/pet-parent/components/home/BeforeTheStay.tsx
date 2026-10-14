import { type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { usePortalCopy } from '../../i18n/portalLocale';
import type { ChecklistItem } from '../../types/home';
import { checklistLink } from '../../utils/home';
import { HOME_COPY } from './homeCopy';
import { HomeIcon } from './HomeIcons';
import { PortalIllustration as Illustration } from '../illustrations/PortalIllustration';
import { GROUPED_CARD, SECTION_EYEBROW } from './homeStyles';

function Badge({ done }: { done: boolean }): ReactElement {
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
        done ? 'bg-status-success/10 text-status-success' : 'bg-theme-sun/20 text-accent-foreground'
      }`}
    >
      <HomeIcon name={done ? 'check' : 'alert'} className="h-3.5 w-3.5" />
    </span>
  );
}

const ROW =
  'flex min-h-11 items-center gap-3 px-4 py-2.5 border-b border-border-soft last:border-b-0 lg:rounded-xl lg:border lg:border-b lg:bg-surface-card lg:last:border-b';

// English shows the server's wording for the item; Chinese names it in its own words.
function ChecklistRow({ item }: { item: ChecklistItem }): ReactElement {
  const copy = usePortalCopy(HOME_COPY);
  const done = item.status === 'done';
  const to = checklistLink(item);
  const label = (
    <span className={`type-meta ${done ? 'text-notice-muted' : 'font-bold text-notice-primary'}`}>
      {copy.checklistLabels[item.key] ?? item.label}
      <span className="sr-only">{done ? copy.checklistDone : copy.checklistOutstanding}</span>
    </span>
  );

  // Done items are not tappable; outstanding ones open the page that fixes them.
  // Admission verification has no page yet, so it renders as plain text.
  if (!to) {
    return (
      <li className={ROW}>
        <Badge done={done} />
        {label}
      </li>
    );
  }
  return (
    <li className="contents">
      <Link
        to={to}
        className={`${ROW} justify-between transition-colors hover:border-action-dark hover:bg-surface-cream/60`}
      >
        <span className="flex items-center gap-3">
          <Badge done={false} />
          {label}
        </span>
        <HomeIcon name="chevron" className="h-4 w-4 text-notice-muted" />
      </Link>
    </li>
  );
}

// Always all four items in a fixed order, so the list never reorders or changes
// length as items are completed. A grouped list card on mobile, a 2 × 2 grid of
// individually bordered rows from `lg`. A group inside the hero card, so its
// label is an h3 under the hero's h2.
export function BeforeTheStay({ checklist }: { checklist: ChecklistItem[] }): ReactElement {
  const copy = usePortalCopy(HOME_COPY);
  return (
    <section aria-labelledby="before-the-stay" className="mt-5">
      <h3 id="before-the-stay" className={`${SECTION_EYEBROW} m-0 mb-2`}>
        {copy.beforeTheStay}
      </h3>
      <Illustration
        name="get-ready"
        className="mb-4 max-w-sm"
        imageClassName="aspect-[21/9] w-full rounded-xl object-cover"
      />
      {/* From `lg` the list itself is no card, so its shadow goes too. A theme sets the card
          shadow with a stronger rule (`html[data-theme] .shadow-card`), which only `!` outranks;
          without it a band of shadow showed under the grid. Equal rows keep the four tiles one
          height when a label wraps. */}
      <ul
        className={`${GROUPED_CARD} lg:grid lg:auto-rows-fr lg:grid-cols-2 lg:gap-2 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:!shadow-none`}
      >
        {checklist.map((item) => (
          <ChecklistRow key={item.key} item={item} />
        ))}
      </ul>
    </section>
  );
}
