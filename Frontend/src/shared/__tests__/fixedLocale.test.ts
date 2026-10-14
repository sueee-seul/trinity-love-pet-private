// @vitest-environment node
// The app tsconfig does not load Node types. This test reads the disk, so it asks for them.
/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Dates and numbers must be formatted in a fixed language. With no locale, or with [] or
 * undefined, the browser's own language wins, so a Chinese browser showed "9月28日" on English
 * pages.
 */
const SRC = fileURLToPath(new URL('../../', import.meta.url));

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });

const BROWSER_LOCALE_CALL =
  /(toLocale(?:Date|Time)?String|Intl\.(?:DateTimeFormat|NumberFormat|RelativeTimeFormat))\(\s*(?:\)|\[\]|undefined|\{)/g;

describe('fixed locale formatting', () => {
  it('never formats a date or number in the browser language', () => {
    const offenders = sourceFiles(SRC).flatMap((path) => {
      // Comments may mention the pattern; only code is checked.
      const code = readFileSync(path, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');
      return [...code.matchAll(BROWSER_LOCALE_CALL)].map((match) => `${path}: ${match[0]}`);
    });

    expect(offenders).toEqual([]);
  });
});
