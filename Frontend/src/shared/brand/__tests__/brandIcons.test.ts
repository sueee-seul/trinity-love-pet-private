// @vitest-environment node
// The app tsconfig does not load Node types. This test reads the disk, so it asks for them.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BRAND_ICON_VERSION, BRAND_MARK_SRC } from '../BrandMark';

/**
 * The Wagstay paw is the only brand icon. The page, the tab, Google Search and an iPhone home
 * screen must all show the same mark, so the files and the links that name them are checked here.
 */

// Named paths, not literals inside `new URL()`: Vite rewrites a literal there into an asset URL,
// which node fs cannot open.
const FRONTEND_ROOT = '../../../../';
const readFromFrontend = (relativePath: string): Buffer =>
  readFileSync(fileURLToPath(new URL(`${FRONTEND_ROOT}${relativePath}`, import.meta.url)));

const INDEX_HTML = readFromFrontend('index.html').toString('utf8');
const PNG_SIGNATURE = '89504e470d0a1a0a';

/** Width and height from a PNG's IHDR chunk. */
const pngSize = (png: Buffer): { width: number; height: number } => ({
  width: png.readUInt32BE(16),
  height: png.readUInt32BE(20),
});

describe('brand icons', () => {
  it('names the SVG, the ICO and the touch icon in index.html', () => {
    expect(INDEX_HTML).toContain(
      `<link rel="icon" type="image/svg+xml" href="${BRAND_MARK_SRC}" />`,
    );
    expect(INDEX_HTML).toContain(
      `<link rel="icon" href="/favicon.ico?v=${BRAND_ICON_VERSION}" sizes="32x32" />`,
    );
    expect(INDEX_HTML).toContain(
      `<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=${BRAND_ICON_VERSION}" />`,
    );
  });

  // Regression: /favicon.svg once held Vite's logo, and a browser keeps a tab icon by its
  // address, so a returning visitor still saw the purple bolt. Every icon link needs the version.
  it('versions every icon address so a cached old icon is not reused', () => {
    const iconLinks = INDEX_HTML.match(/<link rel="(icon|apple-touch-icon)"[^>]*>/g) ?? [];

    expect(iconLinks).toHaveLength(3);
    iconLinks.forEach((link) => expect(link).toContain(`?v=${BRAND_ICON_VERSION}"`));
  });

  // Google Search does not show SVG favicons, so the ICO is what search results use.
  it('ships a 32 px PNG inside favicon.ico', () => {
    const ico = readFromFrontend('public/favicon.ico');
    const imageOffset = ico.readUInt32LE(18);
    const png = ico.subarray(imageOffset);

    expect(ico.readUInt16LE(2)).toBe(1);
    expect(ico.readUInt16LE(4)).toBe(1);
    expect(png.subarray(0, 8).toString('hex')).toBe(PNG_SIGNATURE);
    expect(pngSize(png)).toEqual({ width: 32, height: 32 });
  });

  it('ships a 180 px apple-touch-icon.png', () => {
    const png = readFromFrontend('public/apple-touch-icon.png');

    expect(png.subarray(0, 8).toString('hex')).toBe(PNG_SIGNATURE);
    expect(pngSize(png)).toEqual({ width: 180, height: 180 });
  });
});
