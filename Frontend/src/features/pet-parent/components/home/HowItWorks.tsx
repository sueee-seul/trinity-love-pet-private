import { type ReactElement } from 'react';
import { usePortalCopy } from '../../i18n/portalLocale';
import { HOME_COPY } from './homeCopy';
import { SECTION_TITLE } from './homeStyles';

function StepNumber({ n }: { n: number }): ReactElement {
  return (
    <span className="type-numeral flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[1.5px] border-accent-foreground bg-surface-card text-meta text-accent-foreground">
      {n}
    </span>
  );
}

// State A. A vertical stepper on mobile and four bordered cards in a row from `lg`.
export function HowItWorks(): ReactElement {
  const { howItWorks, steps } = usePortalCopy(HOME_COPY);
  return (
    <section aria-labelledby="how-it-works">
      <h2 id="how-it-works" className={`${SECTION_TITLE} mb-3`}>
        {howItWorks}
      </h2>
      <ol className="flex flex-col lg:grid lg:grid-cols-4 lg:gap-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="relative flex gap-3 pb-5 last:pb-0 lg:flex-col lg:rounded-2xl lg:border lg:border-border-soft lg:bg-surface-card lg:p-4 lg:pb-4"
          >
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className="absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-0.5 bg-border-soft lg:hidden"
              />
            )}
            <StepNumber n={index + 1} />
            <div>
              <h3 className="type-normal m-0 text-body">{step.title}</h3>
              <p className="type-meta m-0 mt-0.5">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
