// @vitest-environment node
// The app tsconfig does not load Node types. This test reads the disk, so it asks for them.
/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The font rules the product owner set: the four families stay, text that names no font of its
 * own is Times New Roman, and Microsoft YaHei never renders. None of the four families has Chinese
 * glyphs, so each stack must end with a Chinese serif, or Chinese text falls back to YaHei.
 */

const SRC = fileURLToPath(new URL('../../../', import.meta.url));
const indexCss = readFileSync(join(SRC, 'index.css'), 'utf8');
const themeFontsCss = readFileSync(join(SRC, 'shared/theme/theme-fonts.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);
const CHINESE_SERIF = "'Noto Serif SC'";
const FORBIDDEN_FACE = /yahei|微软雅黑|pingfang|system-ui/i;

const filesUnder = (dir: string, pattern: RegExp): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : filesUnder(path, pattern);
    return pattern.test(name) ? [path] : [];
  });

const fontToken = (name: string): string => {
  const match = new RegExp(`--font-${name}:\\s*([^;]+);`).exec(indexCss);
  if (!match?.[1]) throw new Error(`--font-${name} is missing from index.css`);
  return match[1];
};

describe('font stacks', () => {
  it('keeps all four families, the theme faces and a Chinese serif', () => {
    const fontImport = indexCss.split('\n')[0] ?? '';
    for (const family of [
      'Agbalumo',
      'Fraunces',
      'Freckle+Face',
      'Inter',
      'Noto+Serif+SC',
      'Nunito',
      'Cormorant+Garamond',
    ]) {
      expect(fontImport).toContain(`family=${family}`);
    }
  });

  it.each(['agbalumo', 'fraunces', 'freckle', 'inter', 'body', 'logo', 'nunito', 'cormorant'])(
    'ends the %s stack with a Chinese serif and never names YaHei',
    (name) => {
      const stack = fontToken(name);
      expect(stack).toContain(CHINESE_SERIF);
      expect(stack).not.toMatch(FORBIDDEN_FACE);
    },
  );

  // A theme may change the heading face, but the wordmark is Agbalumo in every theme.
  it('keeps the logo in Agbalumo and out of reach of the themes', () => {
    expect(fontToken('logo').startsWith("'Agbalumo'")).toBe(true);
    expect(themeFontsCss).not.toMatch(/--font-logo\s*:/);
  });

  // The theme overrides may only point at stacks declared, and checked, above.
  it('only points theme faces at stacks declared in index.css', () => {
    const overrides = [...themeFontsCss.matchAll(/--font-[\w-]+\s*:\s*([^;]+);/g)].map(
      ([, value]) => value.trim(),
    );

    expect(overrides.length).toBeGreaterThan(0);
    for (const value of overrides) {
      expect(value).toMatch(/^var\(--font-(fraunces|nunito|cormorant)\)$/);
    }
  });

  it('uses Times New Roman for text that names no font', () => {
    expect(fontToken('body').startsWith("'Times New Roman'")).toBe(true);
    // A bare Times alias mixed two Chinese faces in one sentence on Windows Chrome.
    expect(fontToken('body')).not.toMatch(/(^|,)\s*Times\s*(,|$)/);
    expect(indexCss).toMatch(/body\s*\{\s*@apply font-body/);
  });

  it('names no forbidden face in any font declaration in the source', () => {
    // Comments may explain the rule and name the face; only real declarations are checked. A
    // declaration can wrap over lines, so it is read up to its semicolon.
    const declaration =
      /(font-family\s*:|--font-[\w-]+\s*:|fontFamily\s*[:=]|family\s*[:=])[^;]*/gi;
    const offenders = filesUnder(SRC, /\.(css|ts|tsx)$/)
      .filter((path) => !path.endsWith('fontStacks.test.ts'))
      .filter((path) => {
        const declarations = readFileSync(path, 'utf8').match(declaration) ?? [];
        return declarations.some((line) => /yahei|微软雅黑|pingfang/i.test(line));
      });

    expect(offenders).toEqual([]);
  });
});
