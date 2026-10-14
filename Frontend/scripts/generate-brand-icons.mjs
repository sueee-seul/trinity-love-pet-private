/**
 * Regenerates public/favicon.ico and public/apple-touch-icon.png from public/favicon.svg.
 *
 * The SVG is the one Wagstay mark. Two raster copies are needed beside it: Google Search does not
 * show SVG favicons, and iOS uses apple-touch-icon.png for a home screen shortcut. Both come from
 * the SVG so the three can never drift apart.
 *
 * - favicon.ico: 32 px, the tile with its rounded corners, stored as a PNG inside the ICO file.
 * - apple-touch-icon.png: 180 px with square corners and no transparency. iOS rounds the corners
 *   itself and fills transparent pixels with black.
 *
 * The SVG is drawn by the Chromium that Playwright already installs for the end-to-end tests.
 *
 * Run: node scripts/generate-brand-icons.mjs
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const SOURCE = 'public/favicon.svg';
const FAVICON = { out: 'public/favicon.ico', size: 32 };
const TOUCH_ICON = { out: 'public/apple-touch-icon.png', size: 180 };

const svg = readFileSync(SOURCE, 'utf8');

/** The mark at `size` pixels. `squareCorners` drops the tile's corner radius. */
const markAt = (size, squareCorners) => {
  const sized = svg.replace(/width="\d+" height="\d+"/, `width="${size}" height="${size}"`);
  return squareCorners ? sized.replace(/ rx="[\d.]+"/, '') : sized;
};

const renderPng = async (page, markup, size) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent">${markup}</body></html>`,
  );
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
};

/**
 * An ICO file holding one PNG image: a 6-byte header, one 16-byte directory entry, then the PNG.
 * Every current browser reads PNG data inside an ICO.
 */
const icoFromPng = (png, size) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);

  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0);
  entry.writeUInt8(size, 1);
  entry.writeUInt8(0, 2);
  entry.writeUInt8(0, 3);
  entry.writeUInt16LE(1, 4);
  entry.writeUInt16LE(32, 6);
  entry.writeUInt32LE(png.length, 8);
  entry.writeUInt32LE(header.length + entry.length, 12);

  return Buffer.concat([header, entry, png]);
};

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const faviconPng = await renderPng(page, markAt(FAVICON.size, false), FAVICON.size);
  writeFileSync(FAVICON.out, icoFromPng(faviconPng, FAVICON.size));
  const touchPng = await renderPng(page, markAt(TOUCH_ICON.size, true), TOUCH_ICON.size);
  writeFileSync(TOUCH_ICON.out, touchPng);
} finally {
  await browser.close();
}

console.log(`${SOURCE} -> ${FAVICON.out}, ${TOUCH_ICON.out}`);
