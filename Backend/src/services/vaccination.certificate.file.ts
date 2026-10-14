import path from 'node:path';

// What a vaccination certificate upload may be. Pure, so every rule is unit-tested without a disk
// or a request. The browser's MIME type is never trusted (it is often empty for HEIC and anyone can
// set it), so the kind is read from the file's first bytes and the extension only has to be one we
// offer in the picker.

export const VACCINATION_CERTIFICATE_MAX_BYTES = 10 * 1024 * 1024;

export const CERTIFICATE_FILE_KINDS = ['pdf', 'jpeg', 'png', 'heic'] as const;
export type CertificateFileKind = (typeof CERTIFICATE_FILE_KINDS)[number];

export const CERTIFICATE_CONTENT_TYPES: Record<CertificateFileKind, string> = {
  pdf: 'application/pdf',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
};

export const CERTIFICATE_FILE_EXTENSIONS: Record<CertificateFileKind, string> = {
  pdf: '.pdf',
  jpeg: '.jpg',
  png: '.png',
  heic: '.heic',
};

const ACCEPTED_EXTENSIONS = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.heic', '.heif']);

const PDF_SIGNATURE = Buffer.from('%PDF-', 'ascii');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);

// HEIC is an ISO media file: a `ftyp` box at byte 4 names a major brand and compatible brands.
// Phones write `heic` (or a sibling) as the major brand; some tools write the generic HEIF brand
// `mif1` and list `heic` among the compatible ones. AVIF uses the same box with `avif`, so the
// generic brand alone is not enough.
const HEIC_BRANDS = new Set(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'hevm', 'hevs']);
const GENERIC_HEIF_BRANDS = new Set(['mif1', 'msf1']);
const FTYP_BOX_HEADER_BYTES = 16;

const startsWith = (bytes: Buffer, signature: Buffer): boolean =>
  bytes.length >= signature.length && bytes.subarray(0, signature.length).equals(signature);

const brandAt = (bytes: Buffer, offset: number): string =>
  bytes.subarray(offset, offset + 4).toString('latin1');

const isHeic = (bytes: Buffer): boolean => {
  if (bytes.length < FTYP_BOX_HEADER_BYTES || brandAt(bytes, 4) !== 'ftyp') return false;
  const majorBrand = brandAt(bytes, 8);
  if (HEIC_BRANDS.has(majorBrand)) return true;
  if (!GENERIC_HEIF_BRANDS.has(majorBrand)) return false;

  const boxEnd = Math.min(bytes.readUInt32BE(0), bytes.length);
  for (let offset = FTYP_BOX_HEADER_BYTES; offset + 4 <= boxEnd; offset += 4) {
    if (HEIC_BRANDS.has(brandAt(bytes, offset))) return true;
  }
  return false;
};

/** The certificate kind the file's own bytes show, or null for anything else. */
export const detectCertificateKind = (bytes: Buffer): CertificateFileKind | null => {
  if (startsWith(bytes, PDF_SIGNATURE)) return 'pdf';
  if (startsWith(bytes, PNG_SIGNATURE)) return 'png';
  if (startsWith(bytes, JPEG_SIGNATURE)) return 'jpeg';
  if (isHeic(bytes)) return 'heic';
  return null;
};

export type CertificateFileCheck =
  { ok: true; kind: CertificateFileKind } | { ok: false; problem: 'too_large' | 'unsupported' };

/**
 * A photo saved as PNG but named .jpg is still a certificate staff can read, so the extension only
 * has to be one we accept; the bytes decide the kind that is stored and served.
 */
export const checkCertificateFile = (file: {
  originalName: string;
  bytes: Buffer;
}): CertificateFileCheck => {
  if (file.bytes.length > VACCINATION_CERTIFICATE_MAX_BYTES) {
    return { ok: false, problem: 'too_large' };
  }
  const extension = path.extname(file.originalName).toLowerCase();
  const kind = detectCertificateKind(file.bytes);
  if (!ACCEPTED_EXTENSIONS.has(extension) || kind === null) {
    return { ok: false, problem: 'unsupported' };
  }
  return { ok: true, kind };
};
