import { useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { taskPhotoUrl, type Task, type TaskPhoto } from '../../types/task.types';
import { taskMediaKindOf, type TaskMediaKind } from './taskMedia';

type MediaPreview = { url: string; kind: TaskMediaKind; x: number; y: number };

const PREVIEW_CLASS =
  'pointer-events-none fixed z-50 max-h-48 max-w-[220px] rounded border border-border-soft bg-surface-card p-1 shadow-xl';

type TaskPhotoLinksProps = {
  task: Task;
  /** When given, each photo gets an × that removes just that one. */
  onDelete?: (storedName: string) => void;
};

/**
 * Every photo and short video on a task, each shown as its original filename: click downloads
 * it, hovering pops a transient preview near the cursor (a video shows its first frame, muted).
 * Renders nothing when the task has no media, so callers own the empty-state fallback.
 */
export function TaskPhotoLinks({ task, onDelete }: TaskPhotoLinksProps): ReactElement | null {
  const [preview, setPreview] = useState<MediaPreview | null>(null);
  const photos = task.photos ?? [];
  if (photos.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5">
      {photos.map((photo: TaskPhoto) => {
        const url = taskPhotoUrl(task.id, photo);
        const kind = taskMediaKindOf(photo.stored_name);
        const showPreview = (event: { clientX: number; clientY: number }): void =>
          setPreview({ url, kind, x: event.clientX, y: event.clientY });
        return (
          <span key={photo.stored_name} className="flex items-center gap-1">
            {kind === 'video' && (
              <span className="rounded bg-surface-cream px-1 type-eyebrow text-notice-secondary">
                Video
              </span>
            )}
            <a
              href={url}
              title={photo.name}
              className="block max-w-28 truncate text-notice-secondary underline"
              onMouseEnter={showPreview}
              onMouseMove={showPreview}
              onMouseLeave={() => setPreview(null)}
            >
              {photo.name}
            </a>
            {onDelete && (
              <button
                type="button"
                title={kind === 'video' ? 'Delete video' : 'Delete photo'}
                onClick={() => onDelete(photo.stored_name)}
                className="rounded px-1 font-bold leading-none text-status-danger hover:bg-status-danger-soft"
              >
                ×
              </button>
            )}
          </span>
        );
      })}
      {preview &&
        createPortal(
          preview.kind === 'video' ? (
            <video
              src={preview.url}
              muted
              playsInline
              preload="metadata"
              aria-hidden="true"
              className={PREVIEW_CLASS}
              style={{ left: preview.x + 16, top: preview.y + 16 }}
            />
          ) : (
            <img
              src={preview.url}
              alt=""
              className={PREVIEW_CLASS}
              style={{ left: preview.x + 16, top: preview.y + 16 }}
            />
          ),
          document.body,
        )}
    </div>
  );
}
