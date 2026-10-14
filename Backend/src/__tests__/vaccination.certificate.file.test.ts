import { describe, expect, it } from 'vitest';
import {
  VACCINATION_CERTIFICATE_MAX_BYTES,
  checkCertificateFile,
  detectCertificateKind,
} from '../services/vaccination.certificate.file.js';

const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ\n', 'latin1');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

/** An ISO media `ftyp` box: size, "ftyp", major brand, minor version, compatible brands. */
const ftyp = (majorBrand: string, compatibleBrands: string[]): Buffer => {
  const size = 16 + compatibleBrands.length * 4;
  const header = Buffer.alloc(8);
  header.writeUInt32BE(size, 0);
  header.write('ftyp', 4, 'latin1');
  return Buffer.concat([
    header,
    Buffer.from(majorBrand, 'latin1'),
    Buffer.alloc(4),
    ...compatibleBrands.map((brand) => Buffer.from(brand, 'latin1')),
    Buffer.alloc(8),
  ]);
};

describe('detectCertificateKind', () => {
  it.each([
    ['a PDF', PDF, 'pdf'],
    ['a PNG', PNG, 'png'],
    ['a JPEG', JPEG, 'jpeg'],
    ['an iPhone HEIC', ftyp('heic', ['mif1', 'heic']), 'heic'],
    ['a HEIF with a generic brand that lists heic', ftyp('mif1', ['mif1', 'heic']), 'heic'],
  ])('reads %s from its first bytes', (_label, bytes, kind) => {
    expect(detectCertificateKind(bytes)).toBe(kind);
  });

  it.each([
    ['an AVIF, which shares the HEIF box', ftyp('avif', ['mif1', 'avif'])],
    ['a generic HEIF that is really AVIF', ftyp('mif1', ['mif1', 'avif'])],
    ['a Windows program', Buffer.from('MZ\x90\x00\x03\x00', 'latin1')],
    ['an HTML page', Buffer.from('<!doctype html><script>alert(1)</script>')],
    ['a GIF', Buffer.from('GIF89a', 'latin1')],
    ['an empty file', Buffer.alloc(0)],
  ])('rejects %s', (_label, bytes) => {
    expect(detectCertificateKind(bytes)).toBeNull();
  });
});

describe('checkCertificateFile', () => {
  it('accepts an allowed extension whose bytes are an allowed kind', () => {
    expect(checkCertificateFile({ originalName: 'Max vaccines.PDF', bytes: PDF })).toEqual({
      ok: true,
      kind: 'pdf',
    });
    expect(checkCertificateFile({ originalName: 'card.heif', bytes: ftyp('heic', []) })).toEqual({
      ok: true,
      kind: 'heic',
    });
  });

  it('stores the kind the bytes show, even when the extension names another allowed kind', () => {
    expect(checkCertificateFile({ originalName: 'scan.jpg', bytes: PNG })).toEqual({
      ok: true,
      kind: 'png',
    });
  });

  it('rejects a renamed file whose bytes are not a certificate kind', () => {
    expect(
      checkCertificateFile({ originalName: 'max.pdf', bytes: Buffer.from('MZ\x90\x00', 'latin1') }),
    ).toEqual({ ok: false, problem: 'unsupported' });
  });

  it('rejects an extension we do not offer, even with PDF bytes', () => {
    expect(checkCertificateFile({ originalName: 'max.html', bytes: PDF })).toEqual({
      ok: false,
      problem: 'unsupported',
    });
    expect(checkCertificateFile({ originalName: 'max', bytes: PDF })).toEqual({
      ok: false,
      problem: 'unsupported',
    });
  });

  it('allows exactly 10 MB and rejects one byte more', () => {
    const atLimit = Buffer.concat([
      PDF,
      Buffer.alloc(VACCINATION_CERTIFICATE_MAX_BYTES - PDF.length),
    ]);
    expect(checkCertificateFile({ originalName: 'max.pdf', bytes: atLimit })).toEqual({
      ok: true,
      kind: 'pdf',
    });
    expect(
      checkCertificateFile({
        originalName: 'max.pdf',
        bytes: Buffer.concat([atLimit, Buffer.alloc(1)]),
      }),
    ).toEqual({ ok: false, problem: 'too_large' });
  });
});
