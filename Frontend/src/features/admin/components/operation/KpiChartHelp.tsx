import { useId, useState } from 'react';

type KpiChartHelpProps = {
  title: string;
  description: string;
};

/** Click or keyboard activated explanation for a KPI chart. */
export function KpiChartHelp({ title, description }: KpiChartHelpProps) {
  const [isOpen, setIsOpen] = useState(false);
  const helpId = useId();

  return (
    <div className="group relative z-10 shrink-0">
      <button
        type="button"
        aria-label={`About ${title}`}
        aria-expanded={isOpen}
        aria-controls={helpId}
        aria-describedby={isOpen ? helpId : undefined}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setIsOpen(false);
        }}
        className="flex h-6 w-6 items-center justify-center rounded-full border border-border-soft text-notice-muted hover:bg-surface-deep hover:text-notice-primary focus:outline-none focus:ring-2 focus:ring-accent"
      >
        <span aria-hidden="true" className="type-meta">?</span>
      </button>
      {isOpen && (
        <div
          id={helpId}
          role="tooltip"
          className="absolute right-0 top-8 w-64 rounded-xl border border-border-soft bg-surface-card p-3 text-notice-secondary shadow-card"
        >
          <p className="type-meta">{description}</p>
        </div>
      )}
      {!isOpen && (
        <div
          id={helpId}
          role="tooltip"
          className="pointer-events-none absolute right-0 top-8 hidden w-64 rounded-xl border border-border-soft bg-surface-card p-3 text-notice-secondary shadow-card group-hover:block group-focus-within:block"
        >
          <p className="type-meta">{description}</p>
        </div>
      )}
    </div>
  );
}
