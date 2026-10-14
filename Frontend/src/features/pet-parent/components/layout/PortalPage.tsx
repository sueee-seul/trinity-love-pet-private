import { type ReactElement, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

/**
 * The three content widths of the pet parent pages. Every page picks one, so a line of text and
 * the space around a card are the same from page to page:
 * - `narrow` (768px): one reading column, such as Stays, Live care, Feedback and Vaccination.
 * - `standard` (1024px): a column with a sidebar, such as Profile and a pet's page.
 * - `wide`: the whole panel, for dashboards and two-pane tools (Home, Booking, Chat).
 */
export type PortalPageWidth = 'narrow' | 'standard' | 'wide';

const WIDTH_CLASS: Record<PortalPageWidth, string> = {
  narrow: 'max-w-3xl',
  standard: 'max-w-5xl',
  wide: 'max-w-none',
};

export function PortalPage({
  width,
  children,
}: {
  width: PortalPageWidth;
  children: ReactNode;
}): ReactElement {
  // The page sits on a plate: the portal panel around it is glass, and text needs an opaque ground.
  return (
    <div
      className={`parent-plate mx-auto flex w-full min-w-0 flex-col gap-6 sm:gap-8 ${WIDTH_CLASS[width]}`}
    >
      {children}
    </div>
  );
}

interface PageHeaderProps {
  title: ReactNode;
  /** One short sentence under the title. */
  lead?: ReactNode;
  /** A way back up, drawn above the title. */
  back?: { to: string; label: string };
  /** Buttons that act on the whole page, beside the title from `sm`. */
  actions?: ReactNode;
  titleId?: string;
}

/**
 * The one page title of a pet parent page. Customer page titles are set in the logo font,
 * Agbalumo, which has a single weight, so the title is never asked to be bold.
 */
export function PageHeader({ title, lead, back, actions, titleId }: PageHeaderProps): ReactElement {
  return (
    <header className="flex flex-col gap-3">
      {back && (
        <Link
          to={back.to}
          className="type-button inline-flex min-h-11 items-center gap-1.5 self-start text-accent-foreground transition-colors hover:text-accent-foreground-hover"
        >
          <span aria-hidden="true">←</span>
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1
            id={titleId}
            className="m-0 text-balance font-agbalumo text-display font-normal text-notice-primary"
          >
            {title}
          </h1>
          {lead && <p className="type-body m-0 mt-2 max-w-[62ch] text-notice-secondary">{lead}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-3">{actions}</div>}
      </div>
    </header>
  );
}
