import { type ReactElement } from 'react';
import { initialOf } from '../../utils/home';
import { AVATAR } from './homeStyles';

// The pet's photo, or their initial in the dark accent on `surface-bubbles` (see AVATAR).
export function PetAvatarCircle({
  name,
  photoUrl,
  sizeClass,
}: {
  name: string;
  photoUrl?: string | undefined;
  sizeClass: string;
}): ReactElement {
  return (
    <span className={`${AVATAR} ${sizeClass}`}>
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
        />
      ) : (
        initialOf(name)
      )}
    </span>
  );
}
