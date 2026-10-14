// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../../../types/task.types';
import { TaskMediaInput } from '../TaskMediaInput';
import { TaskPhotoLinks } from '../TaskPhotoLinks';
import { TASK_VIDEO_MAX_BYTES, TASK_VIDEO_TOO_LARGE_MESSAGE } from '../taskMedia';

const clip = (name: string, type: string, size?: number): File => {
  const file = new File(['clip'], name, { type });
  // A real 30 MB clip is not built in memory; the picker only reads the reported size.
  if (size !== undefined) Object.defineProperty(file, 'size', { value: size });
  return file;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('task media picker', () => {
  it('offers short videos as well as photos', () => {
    render(<TaskMediaInput onFiles={vi.fn()} />);
    const input = screen.getByLabelText('Upload photos or a short video');
    expect(input).toHaveAttribute('accept', expect.stringContaining('image/*'));
    expect(input).toHaveAttribute('accept', expect.stringContaining('video/mp4'));
    expect(input).toHaveAttribute('accept', expect.stringContaining('video/quicktime'));
  });

  it('hands a chosen MP4 and a photo on for upload', async () => {
    const onFiles = vi.fn();
    render(<TaskMediaInput onFiles={onFiles} />);
    const video = clip('walk.mp4', 'video/mp4');
    const photo = clip('dog.jpg', 'image/jpeg');
    await userEvent.upload(screen.getByLabelText('Upload photos or a short video'), [video, photo]);
    expect(onFiles).toHaveBeenCalledWith([video, photo]);
  });

  it('refuses a video over 30 MB with a message and uploads nothing', () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const onFiles = vi.fn();
    render(<TaskMediaInput onFiles={onFiles} />);
    fireEvent.change(screen.getByLabelText('Upload photos or a short video'), {
      target: { files: [clip('long.mov', 'video/quicktime', TASK_VIDEO_MAX_BYTES + 1)] },
    });
    expect(alert).toHaveBeenCalledWith(TASK_VIDEO_TOO_LARGE_MESSAGE);
    expect(onFiles).not.toHaveBeenCalled();
  });
});

describe('task media list', () => {
  const task = {
    id: 'task-1',
    photos: [
      { stored_name: 'a.jpg', name: 'dog.jpg', at: '20261213080000' },
      { stored_name: 'b.mp4', name: 'walk.mp4', at: '20261213090000' },
    ],
  } as Task;

  it('marks a video and previews it as a muted video, a photo as an image', () => {
    render(<TaskPhotoLinks task={task} onDelete={vi.fn()} />);
    expect(screen.getAllByText('Video')).toHaveLength(1);
    expect(screen.getByTitle('Delete video')).toBeInTheDocument();
    expect(screen.getByTitle('Delete photo')).toBeInTheDocument();

    fireEvent.mouseEnter(screen.getByText('walk.mp4'), { clientX: 10, clientY: 10 });
    const preview = document.body.querySelector('video');
    expect(preview).not.toBeNull();
    expect(preview?.muted).toBe(true);
    expect(preview?.getAttribute('src')).toContain('/api/tasks/task-1/photos/b.mp4');

    fireEvent.mouseLeave(screen.getByText('walk.mp4'));
    fireEvent.mouseEnter(screen.getByText('dog.jpg'), { clientX: 10, clientY: 10 });
    expect(document.body.querySelector('video')).toBeNull();
    expect(document.body.querySelector('img')).not.toBeNull();
  });
});
