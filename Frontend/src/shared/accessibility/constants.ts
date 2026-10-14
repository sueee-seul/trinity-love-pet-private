export const ACCESSIBILITY_STORAGE_KEY = 'tlp.accessibility.v1';

/**
 * Percentage steps for the page zoom control. The toolbar never lets a visitor land between
 * steps, so every stored scale is guaranteed to be one of these values.
 */
export const FONT_SCALE_STEPS = [100, 115, 130, 145, 160] as const;
export const DEFAULT_FONT_SCALE = FONT_SCALE_STEPS[0];

/**
 * All five live in Account Settings under "Reading colours"; none are in the toolbar.
 *
 * The bar is the widest thing on the page and already wraps on a laptop, so every control it holds
 * costs the ones beside it. Five colour modes is more than the bar can carry, and a visitor who
 * needs one of them sets it once and leaves it. Text size and the ruler are different, because
 * a reader reaches for them again and again. The bar keeps a link to where the colour modes live.
 */
export const CONTRAST_THEMES = ['default', 'dark', 'light', 'yellow', 'grayscale'] as const;
export type ContrastTheme = (typeof CONTRAST_THEMES)[number];

/**
 * The modes a visitor can actually pick. `default` is not among them: it is the absence of a
 * reading colour, not a colour of its own.
 *
 * It used to have a button, labelled first "Default" and then "Apricot", and both were wrong for
 * the same reason - the button claimed to be a mode while doing nothing, so with a brand theme
 * active it read as a broken control. Every button here now applies one appearance, and pressing
 * the active one returns to `default`, which is how a visitor turns the override back off.
 */
export const SELECTABLE_CONTRAST_THEMES = ['dark', 'light', 'yellow', 'grayscale'] as const;
export type SelectableContrastTheme = (typeof SELECTABLE_CONTRAST_THEMES)[number];

/**
 * Sentence-ish segmentation for the screen reader. Kept deliberately simple: the reader only
 * needs chunks short enough to pause between, not linguistically correct sentences. Chinese puts
 * no space after a full stop, so its stops end a chunk on their own.
 */
export const SENTENCE_SPLIT_PATTERN = /(?<=[.!?])\s+|(?<=[。！？])\s*/;
export const MIN_SPOKEN_SEGMENT_LENGTH = 2;
