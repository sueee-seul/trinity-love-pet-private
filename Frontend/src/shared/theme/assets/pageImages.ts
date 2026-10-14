import gardenHero from './garden-hero.webp';
import milkHero from './milk-hero.webp';
import moonlightHero from './moonlight-hero.webp';
import noirHero from './noir-hero.webp';
import royalHero from './royal-hero.webp';
import strawberryHero from './strawberry-hero.webp';
import type { BrandTheme } from '../constants';

/**
 * The picture each romantic and luxury theme paints behind its pages, one per theme and never
 * shared, so choosing one of those themes always changes the picture as well as the colours.
 *
 * - Strawberry Cream, Moonlight, Garden and Le Petit Palais use the illustrations from the design
 *   package.
 * - Milk Cream (a toy poodle and a blue-eyed cat among cream desserts) and Maison Noir (a dog and
 *   a cat on a black velvet chaise under a gold fan) are AI illustrations made on Topview in
 *   September 2026, in the package's hand-drawn style. Neither shows the real rooms or staff.
 *
 * The minimal themes (Simple, Paper and Slate) map to null: they are plain colours with no
 * picture, as the product owner decided in September 2026.
 *
 * WebP only, and static imports rather than a computed path, so Vite fingerprints and emits each
 * file as its own URL and a visitor downloads only the picture for the theme they are using.
 */
export const THEME_PAGE_IMAGES: Record<BrandTheme, string | null> = {
  strawberry: strawberryHero,
  'milk-cream': milkHero,
  moonlight: moonlightHero,
  garden: gardenHero,
  royal: royalHero,
  noir: noirHero,
  simple: null,
  'plain-light': null,
  'plain-dark': null,
};
