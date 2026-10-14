import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, validateImageFile } from './imageUpload';

describe('validateImageFile', () => {
  it('accepts the image types supported by the profile media API', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/gif', 'image/webp']) {
      expect(validateImageFile(new File(['bytes'], `photo.${type.slice(6)}`, { type }))).toEqual({
        error: null,
      });
    }
  });

  it('rejects non-image content types and files above the shared limit', () => {
    expect(
      validateImageFile(new File(['bytes'], 'document.pdf', { type: 'application/pdf' })),
    ).toEqual({
      error: 'Please choose a JPEG, PNG, GIF, or WebP image.',
    });

    const oversized = new File(['bytes'], 'large.png', { type: 'image/png' });
    Object.defineProperty(oversized, 'size', { value: MAX_IMAGE_BYTES + 1 });
    expect(validateImageFile(oversized)).toEqual({
      error: 'Image must be smaller than 30MB.',
    });
  });
});
