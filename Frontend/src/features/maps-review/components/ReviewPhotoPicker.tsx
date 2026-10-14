import React, { useEffect, useRef, useState } from 'react';
import { ReviewIcon } from './ReviewIcon';

const MAX_IMAGE_COUNT = 9;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif'] as const;
const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(',');
const ACCEPTED_IMAGE_TYPE_SET = new Set<string>(ACCEPTED_IMAGE_TYPES);

interface PendingImage {
  id: string;
  file: File;
  previewUrl: string;
  isLoaded: boolean;
}

interface ReviewPhotoPickerProps {
  onFilesChange?: (files: File[]) => void;
}

const getValidationMessage = (
  hasUnsupportedFiles: boolean,
  hasExcessFiles: boolean,
): string | null => {
  const messages: string[] = [];

  if (hasUnsupportedFiles) {
    messages.push('Only JPEG, PNG, and GIF images are supported.');
  }
  if (hasExcessFiles) {
    messages.push('You can upload up to 9 images.');
  }

  return messages.length > 0 ? messages.join(' ') : null;
};

export const ReviewPhotoPicker: React.FC<ReviewPhotoPickerProps> = ({ onFilesChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingImagesRef = useRef<PendingImage[]>([]);
  const nextImageIdRef = useRef(0);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    return (): void => {
      pendingImagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, []);

  const handleChooseImages = (): void => {
    inputRef.current?.click();
  };

  const handleFilesChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = '';

    if (selectedFiles.length === 0) {
      return;
    }

    const supportedFiles = selectedFiles.filter((file) => ACCEPTED_IMAGE_TYPE_SET.has(file.type));
    const remainingSlots = Math.max(MAX_IMAGE_COUNT - pendingImagesRef.current.length, 0);
    const filesToAdd = supportedFiles.slice(0, remainingSlots);
    const hasUnsupportedFiles = supportedFiles.length !== selectedFiles.length;
    const hasExcessFiles = supportedFiles.length > remainingSlots;

    setValidationMessage(getValidationMessage(hasUnsupportedFiles, hasExcessFiles));

    const newImages = filesToAdd.map((file): PendingImage => {
      const id = `${file.name}-${file.lastModified}-${nextImageIdRef.current}`;
      nextImageIdRef.current += 1;

      return {
        id,
        file,
        previewUrl: URL.createObjectURL(file),
        isLoaded: false,
      };
    });

    const nextImages = [...pendingImagesRef.current, ...newImages];
    pendingImagesRef.current = nextImages;
    setPendingImages(nextImages);
    onFilesChange?.(nextImages.map((image) => image.file));
  };

  const handleRemoveImage = (imageId: string): void => {
    const imageToRemove = pendingImagesRef.current.find((image) => image.id === imageId);
    if (!imageToRemove) {
      return;
    }

    URL.revokeObjectURL(imageToRemove.previewUrl);
    const nextImages = pendingImagesRef.current.filter((image) => image.id !== imageId);
    pendingImagesRef.current = nextImages;
    setPendingImages(nextImages);
    onFilesChange?.(nextImages.map((image) => image.file));
    setValidationMessage(null);
  };

  const handleImageLoad = (imageId: string): void => {
    const nextImages = pendingImagesRef.current.map((image) =>
      image.id === imageId ? { ...image, isLoaded: true } : image,
    );

    pendingImagesRef.current = nextImages;
    setPendingImages(nextImages);
  };

  return (
    <div className="maps-review-photo-picker">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        multiple
        className="maps-review-sr-only"
        aria-label="Choose images to upload"
        onChange={handleFilesChange}
      />

      <button
        type="button"
        className="maps-review-modal-photo-button"
        aria-label="Add photos"
        onClick={handleChooseImages}
      >
        <ReviewIcon name="add_photo_alternate" />
        <span>Add photos</span>
      </button>

      {validationMessage && (
        <p className="maps-review-photo-picker__message" role="alert">
          {validationMessage}
        </p>
      )}

      {pendingImages.length > 0 && (
        <div className="maps-review-photo-previews" role="list" aria-label="Selected photos">
          {pendingImages.map((image) => (
            <div
              className="maps-review-photo-preview"
              role="listitem"
              aria-busy={!image.isLoaded}
              key={image.id}
            >
              {!image.isLoaded && (
                <img
                  className="maps-review-photo-preview__loader"
                  src="/maps-review/loading_image.png"
                  alt=""
                  aria-hidden="true"
                />
              )}
              <img
                className={`maps-review-photo-preview__image ${image.isLoaded ? 'maps-review-photo-preview__image--loaded' : ''}`}
                src={image.previewUrl}
                alt={image.file.name}
                onLoad={() => handleImageLoad(image.id)}
              />
              <button
                type="button"
                className="maps-review-photo-remove"
                aria-label={`Remove ${image.file.name}`}
                onClick={() => handleRemoveImage(image.id)}
              >
                <ReviewIcon name="close" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
