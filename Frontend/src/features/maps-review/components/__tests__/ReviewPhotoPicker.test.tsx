import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewPhotoPicker } from '../ReviewPhotoPicker';

const createObjectUrl = vi.fn((file: File): string => `blob:${file.name}`);
const revokeObjectUrl = vi.fn();

const createImageFile = (name: string, type: string): File => {
  return new File(['image-content'], name, { type, lastModified: 1725100000000 });
};

beforeEach(() => {
  vi.stubGlobal('URL', {
    createObjectURL: createObjectUrl,
    revokeObjectURL: revokeObjectUrl,
  });
  createObjectUrl.mockClear();
  revokeObjectUrl.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ReviewPhotoPicker', () => {
  it('hands selected files to the parent while previews use temporary blob URLs', async () => {
    const user = userEvent.setup();
    const onFilesChange = vi.fn();
    const file = createImageFile('review.jpg', 'image/jpeg');
    render(<ReviewPhotoPicker onFilesChange={onFilesChange} />);

    await user.upload(screen.getByLabelText('Choose images to upload'), file);

    expect(onFilesChange).toHaveBeenLastCalledWith([file]);
    expect(screen.getByRole('img', { name: 'review.jpg' })).toHaveAttribute(
      'src',
      'blob:review.jpg',
    );
  });

  it('accepts one or multiple supported images and preserves selection order', async () => {
    const user = userEvent.setup();
    render(<ReviewPhotoPicker />);

    const input = screen.getByLabelText('Choose images to upload');
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/gif');
    expect(input).toHaveAttribute('multiple');

    await user.upload(input, createImageFile('first.jpg', 'image/jpeg'));
    await user.upload(input, [
      createImageFile('second.png', 'image/png'),
      createImageFile('third.gif', 'image/gif'),
    ]);

    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.getAllByRole('img').map((image) => image.getAttribute('alt'))).toEqual([
      'first.jpg',
      'second.png',
      'third.gif',
    ]);
    expect(createObjectUrl).toHaveBeenCalledTimes(3);
  });

  it('shows the loading asset until the selected image finishes loading', async () => {
    const user = userEvent.setup();
    render(<ReviewPhotoPicker />);

    await user.upload(
      screen.getByLabelText('Choose images to upload'),
      createImageFile('loading.jpg', 'image/jpeg'),
    );

    const preview = screen.getByRole('listitem');
    const image = screen.getByRole('img', { name: 'loading.jpg' });

    expect(preview).toHaveAttribute('aria-busy', 'true');
    expect(preview.querySelector('img[alt=""]')).toHaveAttribute(
      'src',
      '/maps-review/loading_image.png',
    );

    fireEvent.load(image);

    expect(preview).toHaveAttribute('aria-busy', 'false');
    expect(preview.querySelector('img[alt=""]')).not.toBeInTheDocument();
    expect(image).toHaveClass('maps-review-photo-preview__image--loaded');
  });

  it('rejects unsupported files and shows a local validation message', async () => {
    render(<ReviewPhotoPicker />);

    const input = screen.getByLabelText('Choose images to upload');
    fireEvent.change(input, {
      target: {
        files: [
          createImageFile('photo.jpg', 'image/jpeg'),
          createImageFile('clip.mp4', 'video/mp4'),
        ],
      },
    });

    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Only JPEG, PNG, and GIF images are supported.',
    );
  });

  it('caps the local cache at nine images and reports excess files', async () => {
    const user = userEvent.setup();
    render(<ReviewPhotoPicker />);

    const files = Array.from({ length: 10 }, (_, index) =>
      createImageFile(`photo-${index + 1}.jpg`, 'image/jpeg'),
    );
    await user.upload(screen.getByLabelText('Choose images to upload'), files);

    expect(screen.getAllByRole('img')).toHaveLength(9);
    expect(screen.getByRole('alert')).toHaveTextContent('You can upload up to 9 images.');
    expect(createObjectUrl).toHaveBeenCalledTimes(9);
  });

  it('removes one preview and revokes only that preview URL', async () => {
    const user = userEvent.setup();
    render(<ReviewPhotoPicker />);

    await user.upload(screen.getByLabelText('Choose images to upload'), [
      createImageFile('first.jpg', 'image/jpeg'),
      createImageFile('second.jpg', 'image/jpeg'),
    ]);
    await user.click(screen.getByRole('button', { name: 'Remove first.jpg' }));

    expect(screen.getAllByRole('img')).toHaveLength(1);
    expect(screen.getByRole('img')).toHaveAttribute('alt', 'second.jpg');
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:first.jpg');
  });

  it('keeps other loaded previews loaded when one preview is removed', async () => {
    const user = userEvent.setup();
    render(<ReviewPhotoPicker />);

    await user.upload(screen.getByLabelText('Choose images to upload'), [
      createImageFile('first.jpg', 'image/jpeg'),
      createImageFile('second.jpg', 'image/jpeg'),
    ]);

    fireEvent.load(screen.getByRole('img', { name: 'first.jpg' }));
    fireEvent.load(screen.getByRole('img', { name: 'second.jpg' }));
    await user.click(screen.getByRole('button', { name: 'Remove first.jpg' }));

    const remainingPreview = screen.getByRole('listitem');
    expect(remainingPreview).toHaveAttribute('aria-busy', 'false');
    expect(
      remainingPreview.querySelector('.maps-review-photo-preview__loader'),
    ).not.toBeInTheDocument();
  });

  it('revokes all remaining preview URLs when the picker unmounts', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ReviewPhotoPicker />);

    await user.upload(screen.getByLabelText('Choose images to upload'), [
      createImageFile('first.jpg', 'image/jpeg'),
      createImageFile('second.png', 'image/png'),
    ]);
    unmount();

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:first.jpg');
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:second.png');
  });
});
