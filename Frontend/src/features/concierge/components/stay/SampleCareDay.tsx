import { useId, type ReactElement } from 'react';
import type { ConciergeCopy } from '../../copy';
import { ConciergeCareIllustrations } from '../ConciergeIllustration';

/** A labelled care example stays folded until the guest asks to see it. */
export function SampleCareDay({ copy }: { copy: ConciergeCopy }): ReactElement {
  const panelId = useId();
  return (
    <details className="rounded-2xl border border-dashed border-control-border bg-surface-cream/60 p-4">
      <summary className="cursor-pointer type-body font-semibold">
        {copy.packages.sampleToggle}
      </summary>
      <div className="mt-4">
        <ConciergeCareIllustrations />
      </div>
      <figure className="m-0 mt-4" aria-labelledby={panelId}>
        <h3 id={panelId} className="m-0 type-card-title font-normal">
          {copy.packages.sampleTitle}
        </h3>
        <span className="mt-1 block type-meta text-notice-muted">{copy.packages.sampleLabel}</span>
        <ol className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
          {copy.packages.sampleEntries.map((entry) => (
            <li key={entry.time} className="flex gap-3 type-meta">
              <span className="w-20 shrink-0 tabular-nums text-notice-muted">{entry.time}</span>
              <span className="min-w-0 text-notice-primary">{entry.text}</span>
            </li>
          ))}
        </ol>
        <figcaption className="mt-3 type-meta text-notice-secondary">
          {copy.packages.sampleCaption}
        </figcaption>
      </figure>
    </details>
  );
}
