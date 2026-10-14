import { useId, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { usePortalCopy, usePortalLocale } from '../../i18n/portalLocale';
import type { GetReadyTask } from '../../types/getReady';
import { GROUPED_CARD, SECTION_EYEBROW, STATUS_PILL, STATUS_TONE } from '../home/homeStyles';
import { GET_READY_COPY } from './getReadyCopy';
import {
  dropOffChecks,
  getReadyTaskViews,
  type GetReadyTarget,
  type GetReadyTaskView,
} from './getReadyTasks';

// A GOV.UK task list (design-system.service.gov.uk/components/task-list): the tasks can be done in
// any order, each names its status in words, and the whole row opens the page that holds it. A
// finished task stays a link, so a parent can still check or change the detail. A task only our
// team can finish is plain text, as GOV.UK shows a task the user cannot act on.

function TaskStatus({ task, id }: { task: GetReadyTaskView; id: string }): ReactElement {
  const { statuses } = usePortalCopy(GET_READY_COPY);
  if (task.status === 'completed') {
    return (
      <span id={id} className="type-meta shrink-0 text-notice-secondary">
        {statuses.completed}
      </span>
    );
  }
  return (
    <span id={id} className={`${STATUS_PILL} ${STATUS_TONE.attention}`}>
      {statuses.not_started}
    </span>
  );
}

function TaskRow({ task, idPrefix }: { task: GetReadyTaskView; idPrefix: string }): ReactElement {
  const hintId = `${idPrefix}-${task.key}-hint`;
  const statusId = `${idPrefix}-${task.key}-status`;
  const rowHover = task.to !== null ? 'transition-colors hover:bg-surface-cream/60' : '';
  return (
    <li
      className={`relative flex items-start justify-between gap-3 border-b border-border-soft px-4 py-3 last:border-b-0 sm:px-5 ${rowHover}`}
    >
      <div className="min-w-0">
        {task.to !== null ? (
          // The link's box covers the row, so the status and the hint open the task too.
          <Link
            to={task.to}
            aria-describedby={`${hintId} ${statusId}`}
            className="type-body font-semibold text-accent-foreground underline underline-offset-4 after:absolute after:inset-0 hover:text-accent-foreground-hover focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-focus"
          >
            {task.label}
          </Link>
        ) : (
          <span className="type-body font-semibold text-notice-primary">{task.label}</span>
        )}
        <p id={hintId} className="type-meta m-0 mt-0.5">
          {task.hint}
        </p>
      </div>
      <TaskStatus task={task} id={statusId} />
    </li>
  );
}

/** Said plainly under every list: what staff check at the desk, and what is signed there. */
function DropOffChecks({ petName }: { petName: string }): ReactElement {
  const locale = usePortalLocale();
  return (
    <div className="mt-3">
      <p className={`${SECTION_EYEBROW} m-0`}>{GET_READY_COPY[locale].atDropOff}</p>
      <ul className="type-meta m-0 mt-1 list-disc pl-5 text-notice-secondary">
        {dropOffChecks(petName, locale).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

/** The tasks, then what happens at drop-off. The caller gives the heading and the count. */
export function GetReadyTaskList({
  tasks,
  target,
}: {
  tasks: GetReadyTask[];
  target: GetReadyTarget;
}): ReactElement {
  // The same stay's list can be on the page twice (its My stays card and the details dialog).
  const idPrefix = useId();
  const locale = usePortalLocale();
  return (
    <div>
      <ul className={`${GROUPED_CARD} m-0 list-none p-0`}>
        {getReadyTaskViews(tasks, target, locale).map((task) => (
          <TaskRow key={task.key} task={task} idPrefix={idPrefix} />
        ))}
      </ul>
      <DropOffChecks petName={target.petName} />
    </div>
  );
}
