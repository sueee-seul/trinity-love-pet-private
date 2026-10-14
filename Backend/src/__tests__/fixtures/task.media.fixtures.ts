// Tiny files with real headers, built in memory so the media tests carry no sample video.

const box = (type: string, body: Buffer): Buffer => {
  const header = Buffer.alloc(8);
  header.writeUInt32BE(8 + body.length, 0);
  header.write(type, 4, 'latin1');
  return Buffer.concat([header, body]);
};

/** A version 0 movie header: 1000 ticks per second, so the duration is in milliseconds. */
const movieHeader = (seconds: number): Buffer => {
  const body = Buffer.alloc(100);
  body.writeUInt32BE(1000, 12);
  body.writeUInt32BE(Math.round(seconds * 1000), 16);
  return box('mvhd', body);
};

/**
 * An MP4 (brand `isom`) or MOV (brand `qt  `) file whose movie header comes after the media data,
 * as phones write it.
 */
export const isoVideoBytes = ({
  brand = 'isom',
  seconds = 12,
  mediaBytes = 64,
}: { brand?: string; seconds?: number; mediaBytes?: number } = {}): Buffer => {
  const ftypBody = Buffer.alloc(12);
  ftypBody.write(brand, 0, 'latin1');
  ftypBody.write('isom', 8, 'latin1');
  return Buffer.concat([
    box('ftyp', ftypBody),
    box('mdat', Buffer.alloc(mediaBytes, 7)),
    box('moov', movieHeader(seconds)),
  ]);
};

export const mp4Bytes = (seconds = 12, mediaBytes = 64): Buffer =>
  isoVideoBytes({ brand: 'isom', seconds, mediaBytes });

export const movBytes = (seconds = 12): Buffer => isoVideoBytes({ brand: 'qt  ', seconds });

/** An EBML header whose DocType is `webm`. */
export const webmBytes = (): Buffer =>
  Buffer.concat([
    Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84]),
    Buffer.from('webm', 'latin1'),
    Buffer.alloc(32),
  ]);

export const jpegBytes = (size = 64): Buffer =>
  Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(size)]);

/** A HEIC photo: the same `ftyp` box as a video, with a photo brand. */
export const heicBytes = (): Buffer => isoVideoBytes({ brand: 'heic' });
