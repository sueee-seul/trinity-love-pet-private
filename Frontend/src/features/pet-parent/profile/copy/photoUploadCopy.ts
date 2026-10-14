import type { PortalCopy, PortalLocale } from '../../i18n/portalLocale';
import { MAX_IMAGE_BYTES, MAX_IMAGE_LABEL } from '../../../../shared/utils/imageUpload';

const BYTES_PER_MEGABYTE = 1024 * 1024;
const MAX_IMAGE_MEGABYTES = MAX_IMAGE_BYTES / BYTES_PER_MEGABYTE;

/** The words of the photo picker both profile forms use. */
export interface PhotoUploadCopy {
  upload: string;
  remove: string;
  sizeLimit: string;
}

export const PHOTO_UPLOAD_COPY: PortalCopy<PhotoUploadCopy> = {
  en: { upload: 'Upload photo', remove: 'Remove', sizeLimit: MAX_IMAGE_LABEL },
  zh: { upload: '上传照片', remove: '移除', sizeLimit: `最大 ${MAX_IMAGE_MEGABYTES}MB` },
};

/**
 * Chinese for the reasons shared/utils/imageUpload.ts gives for refusing a file. That module is
 * shared with the staff profile and words its reasons in English, so they are matched here by
 * sentence; a reason not listed is shown as it came.
 */
const IMAGE_ERRORS_IN_CHINESE: Readonly<Record<string, string>> = {
  'Please choose a JPEG, PNG, GIF, or WebP image.': '请选择 JPEG、PNG、GIF 或 WebP 格式的图片。',
  [`Image must be smaller than ${MAX_IMAGE_MEGABYTES}MB.`]: `图片必须小于 ${MAX_IMAGE_MEGABYTES}MB。`,
};

/** The image rejection reason in the reader's language. */
export function localizeImageError(reason: string, locale: PortalLocale): string {
  return locale === 'zh' ? (IMAGE_ERRORS_IN_CHINESE[reason] ?? reason) : reason;
}
