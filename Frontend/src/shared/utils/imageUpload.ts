/**
 * One definition of "a picture this product will accept", shared by the pet
 * parent profile and the staff profile.
 *
 * The chosen file is kept in memory until the profile save submits it to
 * object storage. The database stores only the returned public asset URL.
 */

export const MAX_IMAGE_BYTES = 30 * 1024 * 1024; // 30MB
export const MAX_IMAGE_LABEL = 'Up to 30MB';

const IMAGE_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;

export interface ImageValidationResult {
  /** A sentence to show the person, or `null` when the file was accepted. */
  error: string | null;
}

/**
 * Validates a picked file. Returns the rejection reason rather than throwing,
 * because every caller wants to show it next to the control.
 */
export const validateImageFile = (file: File): ImageValidationResult => {
  if (!IMAGE_CONTENT_TYPES.includes(file.type as (typeof IMAGE_CONTENT_TYPES)[number])) {
    return { error: 'Please choose a JPEG, PNG, GIF, or WebP image.' };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: 'Image must be smaller than 30MB.' };
  }
  return { error: null };
};
