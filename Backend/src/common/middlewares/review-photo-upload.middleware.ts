import multer from 'multer';

const REVIEW_PHOTO_MAX_COUNT = 9;
const REVIEW_PHOTO_MAX_SIZE = 10 * 1024 * 1024;
const REVIEW_PHOTO_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif']);

export const reviewPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: REVIEW_PHOTO_MAX_COUNT,
    fileSize: REVIEW_PHOTO_MAX_SIZE,
  },
  fileFilter: (_request, file, callback) => {
    if (!REVIEW_PHOTO_MIME_TYPES.has(file.mimetype)) {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'photos'));
      return;
    }
    callback(null, true);
  },
});
