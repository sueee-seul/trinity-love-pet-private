import { describe, expect, it } from 'vitest';

/**
 * Guards the colour pairings that broke on the dark themes.
 *
 * On Slate and Moonlight the filled "action" colour is a light accent, so card-coloured text on it
 * vanished, and shadows or veils mixed from the text colour glowed instead of darkening. Class
 * names cannot be checked in a rendered page under jsdom, because the stylesheet is not applied,
 * so this reads the concierge sources directly.
 *
 * Each source is cut at every quote mark, so a class string inside a template literal is checked
 * on its own and a ternary's two branches are never mixed together.
 */

const sources = import.meta.glob('/src/features/concierge/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const componentSources = Object.entries(sources).filter(([path]) => !path.includes('/__tests__/'));

const FILL = 'bg-action-dark';
const TEXT_ON_FILL = 'text-on-action-dark';
const TEXT_THAT_VANISHES_ON_A_LIGHT_FILL = ['text-surface-card', 'text-white'];

/** Every class list that paints the fill, with the variant prefix each fill is written under. */
const fillsIn = (source: string): { classes: string[]; prefix: string }[] =>
  source.split(/['"`]/).flatMap((chunk) => {
    const classes = chunk.split(/\s+/);
    return classes
      .filter((name) => name.endsWith(FILL))
      .map((name) => ({ classes, prefix: name.slice(0, -FILL.length) }));
  });

describe('concierge theme tokens', () => {
  it('reads the concierge sources', () => {
    // An empty glob would make every assertion below pass without checking anything.
    expect(componentSources.length).toBeGreaterThan(20);
    expect(componentSources.flatMap(([, source]) => fillsIn(source)).length).toBeGreaterThan(5);
  });

  it('puts the on-action text colour on every action fill, under the same variant', () => {
    const problems = componentSources.flatMap(([path, source]) =>
      fillsIn(source)
        .filter(
          ({ classes, prefix }) =>
            !classes.includes(`${prefix}${TEXT_ON_FILL}`) ||
            TEXT_THAT_VANISHES_ON_A_LIGHT_FILL.some((name) => classes.includes(`${prefix}${name}`)),
        )
        .map(({ prefix }) => `${path}: ${prefix}${FILL}`),
    );

    expect(problems).toEqual([]);
  });

  it('mixes shadows and the dialog veil from the shadow tint, not the text colour', () => {
    const fromText =
      /shadow-\[[^\s'"`]*--color-notice-primary|backdrop:bg-(notice-primary|\[[^\s'"`]*--color-notice-primary)/;
    const problems = componentSources
      .filter(([, source]) => fromText.test(source))
      .map(([path]) => path);

    expect(problems).toEqual([]);
  });
});
