import type { ReactElement, ReactNode } from 'react';

/**
 * The content widths of the staff console pages, the admin counterpart of the pet parent
 * `PortalPage`. Every page picks one, so a line of text and the space around a card are the same
 * from page to page:
 * - `reading` (896px): one column of forms or a feed, such as Bookings and Inquiries.
 * - `standard` (1152px): a column with a sidebar, such as a pet's dashboard or the team page.
 * - `wide`: the whole console, for dashboards and tables (Operation, Tasks, Staff).
 *
 * `AdminPortal` already pads the console and draws the translucent panel, so a page adds no side
 * padding of its own; it is the opaque plate (`parent-plate`, shared with the pet parent pages)
 * that holds the title and the cards, and it only picks its width and the gap between sections.
 */
export type AdminPageWidth = 'reading' | 'standard' | 'wide';

const WIDTH_CLASS: Record<AdminPageWidth, string> = {
  reading: 'max-w-4xl',
  standard: 'max-w-6xl',
  wide: 'max-w-none',
};

export function AdminPage({
  width,
  children,
  className = '',
}: {
  width: AdminPageWidth;
  children: ReactNode;
  /** Extra classes for a page that needs them, such as a bottom margin above a sticky bar. */
  className?: string;
}): ReactElement {
  return (
    <div
      className={`parent-plate mx-auto flex w-full min-w-0 flex-col gap-6 animate-in fade-in duration-300 ${WIDTH_CLASS[width]} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

interface AdminPageHeaderProps {
  title: ReactNode;
  /** A small uppercase label above the title, such as the area of the console. */
  eyebrow?: ReactNode;
  /** One short sentence under the title. */
  lead?: ReactNode;
  /** Buttons that act on the whole page, beside the title from `sm`. */
  actions?: ReactNode;
  titleId?: string;
}

/**
 * The one page title of a staff console page: the display role, in the editorial face, the same
 * size on every page. Sections inside the page use `type-card-title`, never another `h1`.
 */
export function AdminPageHeader({
  title,
  eyebrow,
  lead,
  actions,
  titleId,
}: AdminPageHeaderProps): ReactElement {
  return (
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="type-eyebrow m-0 mb-1 text-notice-muted">{eyebrow}</p>}
        <h1 id={titleId} className="type-display m-0 text-balance">
          {title}
        </h1>
        {lead && <p className="type-body m-0 mt-2 max-w-[62ch] text-notice-secondary">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
    </header>
  );
}
