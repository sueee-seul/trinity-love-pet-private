import type { ChangeEvent, ReactElement } from 'react';
import { hasOversizedVideo, TASK_MEDIA_ACCEPT, TASK_VIDEO_TOO_LARGE_MESSAGE } from './taskMedia';

type TaskMediaInputProps = {
  /** Called with the chosen photos and videos once they pass the size check. */
  onFiles: (files: File[]) => void;
};

/**
 * The hidden picker inside a task's upload button: photos or short videos. A video over 30 MB is
 * refused here with a message, so staff do not wait for the upload to hear it.
 */
export function TaskMediaInput({ onFiles }: TaskMediaInputProps): ReactElement {
  const onChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    if (hasOversizedVideo(files)) {
      window.alert(TASK_VIDEO_TOO_LARGE_MESSAGE);
      return;
    }
    onFiles(files);
  };
  return (
    <input
      type="file"
      accept={TASK_MEDIA_ACCEPT}
      multiple
      aria-label="Upload photos or a short video"
      className="hidden"
      onChange={onChange}
    />
  );
}
