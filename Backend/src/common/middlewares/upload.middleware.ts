import multer from 'multer';

// Keep the upload in memory until the parent feedback service writes it to local storage.
const storage = multer.memoryStorage();

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for audio files
  },
});
