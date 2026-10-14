// The app tsconfig does not load Node types. This test reads the disk, so it asks for them.
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PORTAL_SOURCE = '../PetParentPortal.tsx';

const panelClasses = (): string => {
  const source = readFileSync(fileURLToPath(new URL(PORTAL_SOURCE, import.meta.url)), 'utf8');
  const match = /className="(parent-content-panel[^"]*)"/.exec(source);
  if (!match) throw new Error('The portal panel was not found');
  return match[1];
};

/**
 * A backdrop filter, a transform or a filter on the panel makes it the containing block of every
 * `fixed` element inside it and gives it its own stacking layer. The account dialogs are `fixed`
 * inside the panel, so they were placed in the panel and slid under the sticky header.
 */
describe('pet parent content panel', () => {
  it('keeps fixed dialogs relative to the screen', () => {
    expect(panelClasses()).not.toMatch(/(^|\s)(backdrop-|transform|filter|blur|will-change)/);
  });
});
