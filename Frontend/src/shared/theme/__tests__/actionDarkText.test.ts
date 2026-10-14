// @vitest-environment node
// The app tsconfig does not load Node types. This test reads the disk, so it asks for them.
/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

/**
 * A static guard for text on the dark fill.
 *
 * On a dark theme `bg-action-dark` is a light accent, so the text on it has to be dark.
 * `text-on-action-dark` follows the theme; `text-surface-card` and `text-white` stay light and
 * vanish on that fill. The contrast test proves the token pair is legible in every theme. This
 * test proves the components use the pair.
 *
 * One string literal is one class string. A template literal is one class string for each branch
 * inside it: in `text-white ${active ? 'bg-action-dark' : 'bg-white'}` the fixed text is checked
 * with each branch in turn, because only one branch is ever applied at a time. Joining both
 * branches would report pairs that never reach the screen.
 */

const SOURCE_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const TEST_DIRECTORY = '__tests__';
const SOURCE_FILE = /\.tsx?$/;

/** A whole class token, with any variant prefix (`hover:`) and opacity modifier (`/90`). */
const DARK_FILL = /(?:^|[\s:!])bg-action-dark(?:\/\d+)?(?=$|\s)/;
const FIXED_LIGHT_TEXT = /(?:^|[\s:!])text-(?:surface-card|white)(?:\/\d+)?(?=$|\s)/;

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return entry.name === TEST_DIRECTORY ? [] : sourceFiles(path);
    }
    return SOURCE_FILE.test(entry.name) ? [path] : [];
  });

const isPlainString = (
  node: ts.Node,
): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral =>
  ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);

/** Every plain string anywhere inside `node`, such as the branches of a ternary. */
const nestedStrings = (node: ts.Node): string[] => {
  const found: string[] = [];
  const visit = (child: ts.Node): void => {
    if (isPlainString(child)) {
      found.push(child.text);
    }
    ts.forEachChild(child, visit);
  };
  visit(node);
  return found;
};

const templateClassStrings = (template: ts.TemplateExpression): string[] => {
  const fixed = [template.head.text, ...template.templateSpans.map((span) => span.literal.text)];
  const fixedText = fixed.join(' ');
  const branches = template.templateSpans.flatMap((span) => nestedStrings(span.expression));
  return [fixedText, ...branches.map((branch) => `${fixedText} ${branch}`)];
};

const classStrings = (path: string): string[] => {
  const scriptKind = path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const file = ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    false,
    scriptKind,
  );
  const strings: string[] = [];

  // A plain string inside a template was already checked joined to the template's fixed text,
  // so it is not checked again on its own.
  const visit = (node: ts.Node, insideTemplate: boolean): void => {
    if (isPlainString(node)) {
      if (!insideTemplate) {
        strings.push(node.text);
      }
      return;
    }
    if (ts.isTemplateExpression(node)) {
      strings.push(...templateClassStrings(node));
    }
    const childInsideTemplate = insideTemplate || ts.isTemplateExpression(node);
    ts.forEachChild(node, (child) => visit(child, childInsideTemplate));
  };

  visit(file, false);
  return strings;
};

const displayPath = (path: string): string => relative(SOURCE_ROOT, path).split(sep).join('/');

describe('text on the dark fill', () => {
  const files = sourceFiles(SOURCE_ROOT);

  it('reads the application sources', () => {
    // An empty walk would make the assertion below pass vacuously.
    expect(files.length).toBeGreaterThan(100);
  });

  it('pairs bg-action-dark with text-on-action-dark, never text-surface-card or text-white', () => {
    const offenders = files.flatMap((path) =>
      classStrings(path)
        .filter((classes) => DARK_FILL.test(classes) && FIXED_LIGHT_TEXT.test(classes))
        .map((classes) => `${displayPath(path)}: ${classes.trim().replace(/\s+/g, ' ')}`),
    );

    expect(offenders).toEqual([]);
  });
});
