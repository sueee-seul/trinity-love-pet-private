/**
 * Regenerates src/shared/theme/brand-theme-legacy-colours.css.
 *
 * Most of the application already paints with semantic tokens, which follow a theme for free. What
 * does not are two older habits: Tailwind arbitrary colours such as `bg-[#f1ece7]`, where the value
 * lives in the class name, and plain stylesheets that write hex straight into declarations. Neither
 * can be reached by token work, and rewriting every call site would mean editing 50-odd files owned
 * around the team.
 *
 * So this maps each of them onto the semantic token closest to the role it was filling, and emits
 * one stylesheet of overrides that only apply while a theme is active.
 *
 * Run: node scripts/generate-theme-legacy-colours.mjs
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'src';
const OUT = 'src/shared/theme/brand-theme-legacy-colours.css';

/*
 * A TypeScript manifest of what the stylesheet covers. The drift test needs to read that list, and
 * it cannot read the CSS: Vite's stylesheet pipeline intercepts `?raw` and hands back an empty
 * string, so a test importing the CSS would assert against nothing and always pass.
 */
const MANIFEST = 'src/shared/theme/legacyColourManifest.ts';

/** The theme's own files define the palette; they must not be rewritten in terms of it. */
const SKIP = ['src/shared/theme'];

/**
 * Stylesheets whose colours must not follow a theme. The reading colours in accessibility.css are
 * there for people who need high contrast, so a theme must never remap them. Its components are
 * still scanned for arbitrary classes like any other.
 */
const STYLESHEET_SKIP = ['src/shared/accessibility'];

/**
 * Tailwind bakes the variant, the colour and the opacity into one class name, so all three have to
 * be read off the source to reproduce the selector it generates. The colour is a hex value or an
 * rgb(), rgba(), hsl() or hsla() function; Tailwind writes spaces inside it as underscores.
 */
const CLASS_PATTERN =
  /(?:([a-z-]+):)?\b(bg|text|border|ring|divide|fill|stroke|outline|decoration|placeholder|caret)-\[(#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?)\([^\s\]()'"`]*\))\](?:\/(\d{1,3}))?/g;

/** Variants whose selector is a plain pseudo-class. Anything else is reported, never guessed. */
const VARIANT_PSEUDO = {
  hover: ':hover',
  focus: ':focus',
  'focus-visible': ':focus-visible',
  'focus-within': ':focus-within',
  active: ':active',
  disabled: ':disabled',
  visited: ':visited',
  checked: ':checked',
};

const PROPERTY = {
  bg: 'background-color',
  text: 'color',
  border: 'border-color',
  fill: 'fill',
  stroke: 'stroke',
  outline: 'outline-color',
  decoration: 'text-decoration-color',
  caret: 'caret-color',
};

const TEXTISH = new Set(['text', 'fill', 'stroke', 'placeholder', 'decoration', 'caret']);
const EDGEISH = new Set(['border', 'divide', 'ring', 'outline']);

/**
 * The brand is apricot, so every neutral in this product carries a warm cast. Warm is therefore no
 * evidence of intent; a green, blue or pink is. Warm needs far more chroma before it counts as an
 * accent than anything off the warm axis does.
 */
const isWarm = (hue) => hue >= 15 && hue < 65;
const WARM_ACCENT_CHROMA = 0.3;
const COOL_ACCENT_CHROMA = 0.18;
const WARM_TINT_CHROMA = 0.12;
const COOL_TINT_CHROMA = 0.03;

function metrics(hex) {
  let value = hex.replace('#', '');
  if (value.length === 3) {
    value = [...value].map((c) => c + c).join('');
  }
  value = value.slice(0, 6);

  const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const lum = (max + min) / 2;

  let hue = 0;
  if (chroma !== 0) {
    if (max === r) hue = ((g - b) / chroma) % 6;
    else if (max === g) hue = (b - r) / chroma + 2;
    else hue = (r - g) / chroma + 4;
    hue = (hue * 60 + 360) % 360;
  }

  return { hue, lum, chroma };
}

const FUNCTIONAL_COLOUR = /^(rgba?|hsla?)\((.*)\)$/;

/** An rgb() channel: `50%` is half of 255, a bare number is already 0 to 255. */
const rgbChannel = (text) =>
  text.endsWith('%') ? (parseFloat(text) / 100) * 255 : parseFloat(text);

/** hsl() saturation and lightness are percentages, written with or without the `%` sign. */
const hslFraction = (text) => parseFloat(text) / 100;

/** Alpha is 0 to 1, or a percentage. */
const alphaFraction = (text) => (text.endsWith('%') ? parseFloat(text) / 100 : parseFloat(text));

function hslToRgb(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = (((hue % 360) + 360) % 360) / 60;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const offset = lightness - chroma / 2;
  const sectors = [
    [chroma, second, 0],
    [second, chroma, 0],
    [0, chroma, second],
    [0, second, chroma],
    [second, 0, chroma],
    [chroma, 0, second],
  ];
  return sectors[Math.floor(sector)].map((value) => (value + offset) * 255);
}

const toHex = (channels) =>
  '#' +
  channels
    .map((value) =>
      Math.round(Math.min(255, Math.max(0, value)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');

/**
 * Reads the colour inside an arbitrary class: a 6-digit hex for the classifier to measure, and the
 * alpha the emitted token has to carry. A value it cannot read stops the run and is named, rather
 * than being mapped onto a guessed role.
 */
function parseColour(value) {
  if (value.startsWith('#')) {
    let digits = value.slice(1).toLowerCase();
    if (digits.length === 3 || digits.length === 4) {
      digits = [...digits].map((c) => c + c).join('');
    }
    const alpha = digits.length === 8 ? parseInt(digits.slice(6), 16) / 255 : 1;
    return { hex: '#' + digits.slice(0, 6), alpha };
  }

  const match = FUNCTIONAL_COLOUR.exec(value);
  const parts = match
    ? match[2]
        .replace(/_/g, ' ')
        .replace(/deg/g, '')
        .split(/[\s,/]+/)
        .filter(Boolean)
    : [];
  if (!match || parts.length < 3 || parts.some((part) => Number.isNaN(parseFloat(part)))) {
    throw new Error('Cannot read the colour in the class value "' + value + '"');
  }

  const channels = match[1].startsWith('rgb')
    ? parts.slice(0, 3).map(rgbChannel)
    : hslToRgb(parseFloat(parts[0]), hslFraction(parts[1]), hslFraction(parts[2]));
  const alpha = parts.length > 3 ? alphaFraction(parts[3]) : 1;
  return { hex: toHex(channels), alpha };
}

/** `0.15` as `15%`, which is how Tailwind writes an opacity modifier into color-mix. */
const asPercent = (share) => Math.round(share * 10000) / 100 + '%';

/** Gold and amber are this product's own accent, not a warning state. */
function family(hue) {
  if (hue >= 75 && hue < 175) return 'status-success';
  if (hue >= 330 || hue < 15) return 'status-danger';
  return 'accent-foreground';
}

function accentFamily(hue, chroma) {
  const floor = isWarm(hue) ? WARM_ACCENT_CHROMA : COOL_ACCENT_CHROMA;
  return chroma >= floor ? family(hue) : null;
}

function tintFamily(hue, chroma) {
  const floor = isWarm(hue) ? WARM_TINT_CHROMA : COOL_TINT_CHROMA;
  return chroma >= floor ? family(hue) : null;
}

function token(role, hex) {
  const { hue, lum, chroma } = metrics(hex);

  if (TEXTISH.has(role)) {
    const fam = lum <= 0.82 ? accentFamily(hue, chroma) : null;
    if (fam) return 'var(--color-' + fam + ')';
    if (lum > 0.86) return 'var(--color-title)';
    if (lum > 0.6) return 'var(--color-notice-muted)';
    if (lum > 0.34) return 'var(--color-notice-secondary)';
    return 'var(--color-notice-primary)';
  }

  if (EDGEISH.has(role)) {
    const fam = lum <= 0.78 ? accentFamily(hue, chroma) : null;
    if (fam) return 'var(--color-' + fam + ')';
    return lum > 0.72 ? 'var(--color-border-soft)' : 'var(--color-control-border)';
  }

  if (lum > 0.82) {
    const fam = tintFamily(hue, chroma);
    // A pale tinted panel is a status banner. Keep the meaning, take the theme's hue, and stay a
    // tint rather than turning into a solid block of colour.
    if (fam) {
      return 'color-mix(in srgb, var(--color-' + fam + ') 14%, var(--color-surface-card))';
    }
  } else {
    const fam = accentFamily(hue, chroma);
    if (fam) return 'var(--color-' + fam + ')';
    // A dark warm fill is a button or badge in the brand colour, not page chrome.
    if (isWarm(hue) && chroma >= 0.12 && lum <= 0.62) return 'var(--color-accent-foreground)';
  }

  if (lum > 0.95) return 'var(--color-surface-card)';
  if (lum > 0.9) return 'var(--color-surface-cream)';
  if (lum > 0.82) return 'var(--color-surface-deep)';
  if (lum > 0.68) return 'var(--color-surface-bubbles)';
  if (lum > 0.4) return 'var(--color-notice-muted)';
  return 'var(--color-action-dark)';
}

const isUnder = (path, directories) =>
  directories.some((directory) => path === directory || path.startsWith(directory + '/'));

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry).split('\\').join('/');
    if (isUnder(path, SKIP)) continue;
    if (statSync(path).isDirectory()) walk(path, files);
    else if (/\.(tsx?|css)$/.test(entry)) files.push(path);
  }
  return files;
}

/**
 * Plain stylesheets hold colours in ordinary declarations rather than in class names, including
 * inside shorthands such as `border: 1px solid #c7c7c7`. Each declaration is therefore re-emitted
 * with every hex swapped for the token matching its role, which also carries custom properties.
 * That is what themes the maps-review page through its own `--maps-review-*` layer.
 */
const HEX_IN_CSS = /#[0-9a-fA-F]{3,8}\b/g;
const CSS_RULE = /([^{}]+)\{([^{}]*)\}/g;

function cssPropertyRole(property) {
  if (property === 'color' || property === 'fill' || property === 'stroke') return 'text';
  if (property === 'border-color' || property === 'outline-color') return 'border';
  if (property.startsWith('background')) return 'bg';
  if (property.startsWith('border') || property.startsWith('outline')) return 'border';
  if (property.endsWith('shadow')) return 'border';
  if (property.endsWith('color')) return 'text';
  return 'bg';
}

/**
 * Inline SVG presentation attributes, e.g. `stroke="#eee3da"` on a chart gridline. A CSS rule beats
 * a presentation attribute, so an attribute selector reaches these without touching the component,
 * and it matches only the elements carrying that exact value.
 */
const SVG_ATTRIBUTE = /\b(fill|stroke)="(#[0-9a-fA-F]{3,8})"/g;

/**
 * Third-party brand marks. A logo's colours identify someone else's product, so they are left
 * exactly as they are on every theme.
 */
const BRAND_MARK_COLOURS = new Set([
  '#4285f4', // Google blue
  '#34a853', // Google green
  '#fbbc05', // Google yellow
  '#ea4335', // Google red
  '#1877f2', // Facebook blue
  '#000000', // wordmarks that must stay black
  '#ffffff', // wordmarks that must stay white
]);

function customPropertyRole(name) {
  if (/border|outline|divider|rule|stroke/.test(name)) return 'border';
  if (/ink|copy|text|muted|label|heading|title|fg|foreground/.test(name)) return 'text';
  return 'bg';
}

const CSS_COMMENT = /\/\*[\s\S]*?\*\//g;

/**
 * A selector that starts at the document root. Prefixing `html[data-theme] ` onto it asks for an
 * `html` inside `html`, which never matches, so such a rule is reported instead of emitted.
 */
const ROOT_SELECTOR = /^(?:html|:root)(?![\w-])/;

/**
 * Returns the themed rules, plus the selectors of any colour-bearing rule that had to be left out
 * because it starts at the document root.
 */
function stylesheetRulesFor(source) {
  const rules = [];
  const rootSelectors = [];

  // Comments go first. Otherwise a comment above a rule is captured as part of its selector, and
  // any comma in the comment splits it into bogus selector parts.
  for (const match of source.replace(CSS_COMMENT, '').matchAll(CSS_RULE)) {
    // The capture runs back to wherever the previous rule ended, so it can carry a preceding
    // at-statement such as `@import url(...);`. Only the part after the last `;` is the selector,
    // and selectors never contain one.
    const selector = match[1].split(';').pop().trim();
    const body = match[2];

    // @media / @supports wrappers arrive as their own "selector"; the rules nested inside them are
    // matched separately by this same pass, so the wrapper itself is skipped rather than emitted.
    if (!selector || selector.startsWith('@')) continue;

    const parts = selector.split(',').map((part) => part.trim());
    const declarations = [];
    for (const declaration of body.split(';')) {
      const separator = declaration.indexOf(':');
      if (separator === -1) continue;

      const property = declaration.slice(0, separator).trim();
      const value = declaration.slice(separator + 1).trim();
      HEX_IN_CSS.lastIndex = 0;
      if (!property || !HEX_IN_CSS.test(value)) continue;
      HEX_IN_CSS.lastIndex = 0;

      // A custom property has no property name to read a role from, but these are self-describing
      // (`--maps-review-ink`, `--maps-review-border`), so the name is the next best signal.
      const role = property.startsWith('--')
        ? customPropertyRole(property)
        : cssPropertyRole(property);
      const themed = value.replace(HEX_IN_CSS, (hex) => token(role, hex.toLowerCase()));
      declarations.push('  ' + property + ': ' + themed + ';');
    }

    if (declarations.length === 0) continue;

    if (parts.some((part) => ROOT_SELECTOR.test(part))) {
      rootSelectors.push(parts.join(', '));
      continue;
    }

    const scoped = parts.map((part) => 'html[data-theme] ' + part).join(',\n');
    rules.push(scoped + ' {\n' + declarations.join('\n') + '\n}');
  }

  return { rules, rootSelectors };
}

const found = new Map();
const skipped = new Map();
const stylesheetRules = [];
const rootRules = [];
const svgAttributes = new Map();
const brandMarks = new Map();

for (const file of walk(SRC)) {
  const source = readFileSync(file, 'utf8');

  if (file.endsWith('.css') && !isUnder(file, STYLESHEET_SKIP)) {
    const { rules, rootSelectors } = stylesheetRulesFor(source);
    stylesheetRules.push(...rules);
    rootRules.push(...rootSelectors.map((selector) => file + ': ' + selector));
  }

  for (const [, attribute, hex] of source.matchAll(SVG_ATTRIBUTE)) {
    const lower = hex.toLowerCase();
    if (BRAND_MARK_COLOURS.has(lower)) {
      brandMarks.set(hex, (brandMarks.get(hex) ?? 0) + 1);
      continue;
    }
    const key = attribute + '|' + hex;
    svgAttributes.set(key, (svgAttributes.get(key) ?? 0) + 1);
  }

  for (const match of source.matchAll(CLASS_PATTERN)) {
    const [, variant, prefix, colour, opacity] = match;

    if (variant && !(variant in VARIANT_PSEUDO)) {
      const label = variant + ':' + prefix + '-[' + colour + ']';
      skipped.set(label, (skipped.get(label) ?? 0) + 1);
      continue;
    }

    // The colour keeps its original spelling: Tailwind's class names are case-sensitive, so
    // `#0CA30C` and `#0ca30c` are two different selectors even though they are one colour.
    const key = [variant ?? '', prefix, colour, opacity ?? ''].join('|');
    found.set(key, (found.get(key) ?? 0) + 1);
  }
}

/**
 * Every character outside a plain identifier is escaped, which covers the brackets, `#`, `/`, `:`
 * and `.` of a hex class as well as the `(`, `,` and `%` of an rgb() or hsl() one.
 */
const escape = (cls) => cls.replace(/[^a-zA-Z0-9_-]/g, '\\$&');

/** The class name as written in the source, rebuilt from a `found` key. */
const classNameFor = (key) => {
  const [variant, prefix, colour, opacity] = key.split('|');
  return (
    (variant ? variant + ':' : '') + prefix + '-[' + colour + ']' + (opacity ? '/' + opacity : '')
  );
};

const classRules = [...found.keys()].sort().map((key) => {
  const [variant, prefix, colour, opacity] = key.split('|');

  const selector =
    'html[data-theme] .' + escape(classNameFor(key)) + (variant ? VARIANT_PSEUDO[variant] : '');

  const { hex, alpha } = parseColour(colour);
  let value = token(prefix, hex);
  // Tailwind folds both the colour's own alpha and the opacity modifier into the colour, so the
  // token has to carry them too.
  const share = alpha * (opacity ? Number(opacity) / 100 : 1);
  if (share < 1) {
    value = 'color-mix(in srgb, ' + value + ' ' + asPercent(share) + ', transparent)';
  }

  if (prefix === 'divide') return selector + ' > * {\n  border-color: ' + value + ';\n}';
  if (prefix === 'ring') return selector + ' {\n  --tw-ring-color: ' + value + ';\n}';
  if (prefix === 'placeholder') return selector + '::placeholder {\n  color: ' + value + ';\n}';
  return selector + ' {\n  ' + PROPERTY[prefix] + ': ' + value + ';\n}';
});

const callSites = [...found.values()].reduce((total, count) => total + count, 0);

const header = [
  '/*',
  ' * GENERATED FILE. Do not hand-edit.',
  ' * Regenerate with: node scripts/generate-theme-legacy-colours.mjs',
  ' *',
  ' * Maps the colours this application still hard-codes onto semantic theme tokens, so every page',
  ' * follows the brand theme without each call site being rewritten. Two sources: Tailwind',
  ' * arbitrary colour classes (hex, rgb() or hsl()), where the value is part of the class name,',
  ' * and plain stylesheets that write hex into declarations. The reading colours in',
  ' * accessibility.css are left out on purpose: a theme must never remap them.',
  ' *',
  ' * Colours are classified by chroma and lightness rather than by name. Near-neutrals fall onto',
  ' * the surface, text or border scale by lightness; saturated colours keep their meaning through',
  ' * the status tokens; a pale off-axis panel stays a tint by mixing its status colour into the',
  " * card surface. Because this product's palette is warm, a warm cast is not treated as intent,",
  ' * but a green, blue or pink is.',
  ' *',
  ' * Variants and opacity modifiers are part of a Tailwind class name, so they are reproduced: a',
  ' * hover rule carries :hover, and an opacity modifier or an rgba() alpha is folded into the',
  ' * token with color-mix.',
  ' *',
  ' * Deliberately no !important. html[data-theme] .cls already outranks Tailwind own .cls, and',
  ' * staying non-important is what lets the accessibility high-contrast modes (which do use',
  ' * !important) keep overriding the theme, as they must.',
  ' *',
  ' * Rules apply only under a theme, so the default apricot palette renders exactly as before.',
  ' *',
  ' * ' +
    found.size +
    ' class rules over ' +
    callSites +
    ' call sites, plus ' +
    stylesheetRules.length +
    ' stylesheet rules.',
  ' */',
  '',
  '',
].join('\n');

const svgRules = [...svgAttributes.keys()].sort().map((key) => {
  const [attribute, hex] = key.split('|');
  const role = attribute === 'stroke' ? 'border' : 'text';
  const value = token(role, hex.toLowerCase());

  return (
    'html[data-theme] [' + attribute + '="' + hex + '"] {\n  ' + attribute + ': ' + value + ';\n}'
  );
});

const sections = [header + classRules.join('\n\n')];

if (stylesheetRules.length) {
  sections.push(
    '/* Plain stylesheets: declarations re-emitted with their colours mapped onto theme tokens. */\n\n' +
      stylesheetRules.join('\n\n'),
  );
}

if (svgRules.length) {
  sections.push(
    '/*\n' +
      ' * Inline SVG presentation attributes. A CSS rule outranks a presentation attribute, so these\n' +
      ' * reach chart gridlines and the like without editing the component. Third-party brand marks\n' +
      ' * are excluded by value and keep their own colours.\n' +
      ' */\n\n' +
      svgRules.join('\n\n'),
  );
}

writeFileSync(OUT, sections.join('\n\n') + '\n');

const manifest = [
  '/*',
  ' * GENERATED FILE. Do not hand-edit.',
  ' * Regenerate with: node scripts/generate-theme-legacy-colours.mjs',
  ' *',
  ' * The arbitrary Tailwind colour classes that brand-theme-legacy-colours.css overrides. Exported',
  ' * for the drift test, which cannot read the stylesheet itself. Vite returns an empty string for',
  ' * `?raw` on CSS.',
  ' */',
  '',
  '/** The pattern the generator matched with, so the drift test looks for exactly the same classes. */',
  'export const COLOUR_CLASS_PATTERN = /' + CLASS_PATTERN.source + '/' + CLASS_PATTERN.flags + ';',
  '',
  'export const COVERED_COLOUR_CLASSES: readonly string[] = [',
  ...[...found.keys()].sort().map((key) => "  '" + classNameFor(key) + "',"),
  '];',
  '',
].join('\n');

writeFileSync(MANIFEST, manifest);

console.log(
  found.size +
    ' class rules (' +
    callSites +
    ' call sites) + ' +
    stylesheetRules.length +
    ' stylesheet rules + ' +
    svgRules.length +
    ' inline-SVG rules -> ' +
    OUT,
);

if (brandMarks.size > 0) {
  const total = [...brandMarks.values()].reduce((sum, count) => sum + count, 0);
  console.log(
    '\nLeft untouched - third-party brand marks (' +
      total +
      ' attributes): ' +
      [...brandMarks.keys()].join(', '),
  );
}

if (rootRules.length > 0) {
  console.log(
    '\nSkipped - rule starts at the document root, so a html[data-theme] prefix can never match it:',
  );
  for (const rule of rootRules) {
    console.log('  ' + rule);
  }
}

if (skipped.size > 0) {
  console.log(
    '\nSkipped - variant has no plain pseudo-class selector, so it needs a hand-written rule:',
  );
  for (const [label, count] of [...skipped].sort((a, b) => b[1] - a[1])) {
    console.log('  ' + count + '  ' + label);
  }
}
