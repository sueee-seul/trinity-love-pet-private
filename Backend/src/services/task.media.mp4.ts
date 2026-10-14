/**
 * How long an MP4 or MOV clip runs, read from its own header. Both formats are ISO media files: a
 * list of boxes, each a 4-byte size and a 4-byte type. The `moov` box holds an `mvhd` box with a
 * time scale (ticks per second) and the duration in those ticks. Phones often write `moov` after
 * the media data, so the whole upload (already in memory) is walked, not just its first bytes.
 */

const BOX_HEADER_BYTES = 8;
const LARGE_BOX_HEADER_BYTES = 16;
/** A size of 1 means a 64-bit size follows the type; 0 means the box runs to the end. */
const LARGE_SIZE_MARKER = 1;
const TO_END_MARKER = 0;

interface Box {
  type: string;
  bodyStart: number;
  end: number;
}

const readBox = (bytes: Buffer, offset: number, limit: number): Box | null => {
  if (offset + BOX_HEADER_BYTES > limit) return null;
  const size = bytes.readUInt32BE(offset);
  const type = bytes.toString('latin1', offset + 4, offset + 8);
  if (size === TO_END_MARKER) return { type, bodyStart: offset + BOX_HEADER_BYTES, end: limit };
  if (size === LARGE_SIZE_MARKER) {
    if (offset + LARGE_BOX_HEADER_BYTES > limit) return null;
    const largeSize = Number(bytes.readBigUInt64BE(offset + BOX_HEADER_BYTES));
    if (largeSize < LARGE_BOX_HEADER_BYTES) return null;
    return { type, bodyStart: offset + LARGE_BOX_HEADER_BYTES, end: offset + largeSize };
  }
  if (size < BOX_HEADER_BYTES) return null;
  return { type, bodyStart: offset + BOX_HEADER_BYTES, end: offset + size };
};

const findBox = (bytes: Buffer, type: string, start: number, limit: number): Box | null => {
  let offset = start;
  while (offset < limit) {
    const box = readBox(bytes, offset, limit);
    if (!box || box.end > limit) return null;
    if (box.type === type) return box;
    offset = box.end;
  }
  return null;
};

/**
 * Seconds from the `mvhd` box, or null when the header cannot be read. Version 0 keeps 32-bit
 * times; version 1 keeps 64-bit creation, modification and duration fields.
 */
const durationFromMovieHeader = (bytes: Buffer, mvhd: Box): number | null => {
  if (mvhd.bodyStart >= mvhd.end) return null;
  const version = bytes.readUInt8(mvhd.bodyStart);
  const timescaleAt = mvhd.bodyStart + (version === 1 ? 20 : 12);
  const durationAt = timescaleAt + 4;
  const durationBytes = version === 1 ? 8 : 4;
  if (durationAt + durationBytes > mvhd.end) return null;
  const timescale = bytes.readUInt32BE(timescaleAt);
  const duration =
    version === 1 ? Number(bytes.readBigUInt64BE(durationAt)) : bytes.readUInt32BE(durationAt);
  return timescale > 0 ? duration / timescale : null;
};

/** The clip's running time in seconds, or null when the file carries no readable movie header. */
export const mp4DurationSeconds = (bytes: Buffer): number | null => {
  const moov = findBox(bytes, 'moov', 0, bytes.length);
  if (!moov) return null;
  const mvhd = findBox(bytes, 'mvhd', moov.bodyStart, moov.end);
  return mvhd ? durationFromMovieHeader(bytes, mvhd) : null;
};
