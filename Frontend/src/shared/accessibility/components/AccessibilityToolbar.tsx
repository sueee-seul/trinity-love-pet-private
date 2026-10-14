import React, { useEffect, useId, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FONT_SCALE_STEPS } from '../constants';
import { useAppearanceDestination } from '../hooks/useAppearanceDestination';
import { useSpeechReader } from '../hooks/useSpeechReader';
import { useAccessibilityStore } from '../store/accessibilityStore';
import { useSiteCopy, useSiteLanguage, useSwitchSiteLanguage } from '../../i18n/siteLanguage';
import { useBrandThemeStore } from '../../theme/themeStore';
import { ACCESSIBILITY_COPY } from '../accessibilityCopy';
import { THEME_LACE_EDGE_HEIGHT, ThemeLaceEdge } from '../../theme/decorations/ThemeLaceEdge';
import { AppearancePanel } from './AppearancePanel';
import { ToolbarButton } from './ToolbarButton';
import {
  CloseIcon,
  GlobeIcon,
  MinusIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  PreviousIcon,
  PaletteIcon,
  ResetIcon,
  RulerIcon,
  SpacingIcon,
  StopIcon,
} from './ToolbarIcons';

interface AccessibilityToolbarProps {
  onClose: () => void;
  toolbarRef: React.RefObject<HTMLDivElement | null>;
}

const MIN_FONT_SCALE = FONT_SCALE_STEPS[0];
const MAX_FONT_SCALE = FONT_SCALE_STEPS[FONT_SCALE_STEPS.length - 1];

/**
 * Clear bar colour between the controls and the lace, on top of the trim's own height.
 *
 * Without it the scallops start immediately under the button row: the trim reads as something
 * resting on the buttons rather than as the bottom edge of the bar, and the picots hanging below
 * each scallop come close enough to the first control to look like they are touching it.
 */
const LACE_CLEARANCE_PX = 10;

/**
 * Quiet text on the bar: the shell ink at 85%, not the palette's secondary text colour.
 *
 * The secondary colour is chosen for cards, and Royal's shell is dark emerald, where it measured
 * 2.06:1. The shell ink is always paired with the shell, and at 85% it still clears 5.6:1 on every
 * theme while reading as a step down from the controls.
 */
const SHELL_MUTED_TEXT =
  'text-[color-mix(in_srgb,var(--brand-shell-ink,var(--color-notice-primary))_85%,transparent)]';

export const AccessibilityToolbar: React.FC<AccessibilityToolbarProps> = ({
  onClose,
  toolbarRef,
}) => {
  const fontScale = useAccessibilityStore((state) => state.fontScale);
  const isSpacingRelaxed = useAccessibilityStore((state) => state.isSpacingRelaxed);
  const isRulerVisible = useAccessibilityStore((state) => state.isRulerVisible);
  const increaseFontScale = useAccessibilityStore((state) => state.increaseFontScale);
  const decreaseFontScale = useAccessibilityStore((state) => state.decreaseFontScale);
  const toggleRelaxedSpacing = useAccessibilityStore((state) => state.toggleRelaxedSpacing);
  const toggleRuler = useAccessibilityStore((state) => state.toggleRuler);
  const resetPreferences = useAccessibilityStore((state) => state.resetPreferences);

  const resetBrandTheme = useBrandThemeStore((state) => state.resetToRouteDefault);
  const { pathname } = useLocation();

  const reader = useSpeechReader();
  const { toolbar: copy } = useSiteCopy(ACCESSIBILITY_COPY);
  const language = useSiteLanguage();
  const switchLanguage = useSwitchSiteLanguage();
  const otherLanguage = language === 'en' ? 'zh' : 'en';
  const firstControlRef = useRef<HTMLDivElement | null>(null);

  const [isAppearanceOpen, setIsAppearanceOpen] = useState(false);
  const appearancePanelId = useId();

  const appearanceDestination = useAppearanceDestination();
  const navigate = useNavigate();

  // Opening the bar moves focus into it, so a keyboard visitor lands on the controls they just
  // asked for instead of continuing from the launcher's position in the tab order.
  useEffect(() => {
    firstControlRef.current?.querySelector('button')?.focus();
  }, []);

  // Escape closes the panel before the bar. Collapsing both at once would take away the controls a
  // visitor was in the middle of using, and leave them nothing to reopen it with but the launcher.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') {
        return;
      }
      if (isAppearanceOpen) {
        setIsAppearanceOpen(false);
        return;
      }
      onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return (): void => document.removeEventListener('keydown', handleKeyDown);
  }, [isAppearanceOpen, onClose]);

  /**
   * Reset undoes everything this bar can do, not just the reading aids.
   *
   * The theme is included because the bar is where it was changed from, so a visitor who wants
   * "put it back how it was" and presses the one control named Reset should not be left on a
   * palette they picked here with no obvious way back. It returns to the page's own default,
   * Strawberry Cream on customer pages and Simple under `/admin`, and forgets the stored choice.
   *
   * It also stops the reader and collapses the bar. Leaving a full-width toolbar open over a page
   * that has just returned to normal is the one piece of the state it would not have undone.
   */
  const handleReset = (): void => {
    reader.stop();
    resetPreferences();
    resetBrandTheme(pathname);
    onClose();
  };

  const handleClose = (): void => {
    reader.stop();
    onClose();
  };

  /**
   * A pet parent is taken to Account Settings, where the theme picker and the reading colours
   * live alongside the rest of their preferences. Everyone else opens the panel, because the
   * route that page sits behind would bounce them straight back out.
   *
   * Navigating collapses the bar. Leaving it open would park a full-width toolbar over the page
   * it just opened, on top of the section the visitor was sent there to use.
   */
  const handleAppearance = (): void => {
    if (appearanceDestination === null) {
      setIsAppearanceOpen((isOpen) => !isOpen);
      return;
    }

    reader.stop();
    onClose();
    navigate(appearanceDestination);
  };

  return (
    <div
      ref={toolbarRef}
      role="region"
      aria-label={copy.region}
      data-a11y-ui="toolbar"
      data-testid="accessibility-toolbar"
      /*
       * The trim is padding inside the bar rather than a strip hanging below it. The widget sizes
       * the page offset from this element's `offsetHeight`, so anything positioned outside the box
       * would end up covering the first rows of the page.
       */
      style={{
        paddingBottom: THEME_LACE_EDGE_HEIGHT + LACE_CLEARANCE_PX,
        backgroundColor: 'var(--brand-shell, var(--color-surface-deep))',
        color: 'var(--brand-shell-ink, var(--color-notice-primary))',
      }}
      className="fixed inset-x-0 top-0 z-[60] px-3 pt-2 shadow-card"
    >
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-2">
        <div ref={firstControlRef} className="flex items-center gap-1.5">
          <ToolbarButton
            onClick={reader.toggle}
            isDisabled={!reader.isSupported}
            label={reader.status === 'playing' ? copy.pauseReading : copy.readAloud}
            isPressed={reader.status !== 'idle'}
          >
            {reader.status === 'playing' ? <PauseIcon /> : <PlayIcon />}
            <span className="hidden sm:inline">{copy.read}</span>
          </ToolbarButton>
          <ToolbarButton
            onClick={reader.goToPrevious}
            isDisabled={!reader.isSupported || reader.status === 'idle'}
            label={copy.previousSentence}
          >
            <PreviousIcon />
          </ToolbarButton>
          <ToolbarButton
            onClick={reader.goToNext}
            isDisabled={!reader.isSupported || reader.status === 'idle'}
            label={copy.nextSentence}
          >
            <NextIcon />
          </ToolbarButton>
          <ToolbarButton
            onClick={reader.stop}
            isDisabled={!reader.isSupported || reader.status === 'idle'}
            label={copy.stopReading}
          >
            <StopIcon />
          </ToolbarButton>
        </div>

        <div className="flex items-center gap-1.5 border-l border-control-border/30 pl-2">
          <ToolbarButton
            onClick={decreaseFontScale}
            isDisabled={fontScale === MIN_FONT_SCALE}
            label={copy.decreaseText}
          >
            <MinusIcon />
          </ToolbarButton>
          <span aria-live="polite" className={`min-w-12 text-center type-meta ${SHELL_MUTED_TEXT}`}>
            {fontScale}%
          </span>
          <ToolbarButton
            onClick={increaseFontScale}
            isDisabled={fontScale === MAX_FONT_SCALE}
            label={copy.increaseText}
          >
            <PlusIcon />
          </ToolbarButton>
        </div>

        <div className="flex items-center gap-1.5 border-l border-control-border/30 pl-2">
          <ToolbarButton
            onClick={toggleRelaxedSpacing}
            isPressed={isSpacingRelaxed}
            label={copy.spacingLabel}
          >
            <SpacingIcon />
            <span className="hidden sm:inline">{copy.spacing}</span>
          </ToolbarButton>
          <ToolbarButton onClick={toggleRuler} isPressed={isRulerVisible} label={copy.rulerLabel}>
            <RulerIcon />
            <span className="hidden sm:inline">{copy.ruler}</span>
          </ToolbarButton>
        </div>

        {/*
         * The language lives here, with the other reading aids, rather than in every header: one
         * place to find it on every page, and the headers keep their room for the page's own
         * actions. The button names the other language in the current one: the owner's rule is
         * that no Chinese character shows in English mode.
         */}
        <div className="flex items-center gap-1.5 border-l border-control-border/30 pl-2">
          <ToolbarButton onClick={() => switchLanguage(otherLanguage)} label={copy.languageLabel}>
            <GlobeIcon />
            <span>{copy.language}</span>
          </ToolbarButton>
        </div>

        {/*
         * Every theme and every reading colour mode, behind one control. The bar used to carry
         * two theme shortcuts beside this, which cost the widest row in the product two slots to
         * show two of seven options - and the panel behind this button already shows all of them
         * with their names and swatches.
         *
         * A pet parent is sent to Account Settings, which keeps one home for their preferences
         * instead of a second copy in the bar. Anyone else opens the sheet below, because that
         * page's route guard would bounce them - see `useAppearanceDestination`.
         *
         * The expanded/controls pair is only meaningful on the panel branch. Announcing a button
         * as controlling a panel it will never open tells a screen reader the wrong thing.
         */}
        <div className="flex items-center gap-1.5 border-l border-control-border/30 pl-2">
          <ToolbarButton
            onClick={handleAppearance}
            isPressed={appearanceDestination === null ? isAppearanceOpen : undefined}
            ariaExpanded={appearanceDestination === null ? isAppearanceOpen : undefined}
            ariaControls={appearanceDestination === null ? appearancePanelId : undefined}
            label={copy.appearanceLabel}
          >
            <PaletteIcon />
            <span className="hidden sm:inline">{copy.appearance}</span>
          </ToolbarButton>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <ToolbarButton onClick={handleReset} label={copy.resetLabel}>
            <ResetIcon />
            <span className="hidden sm:inline">{copy.reset}</span>
          </ToolbarButton>
          <ToolbarButton onClick={handleClose} label={copy.close}>
            <CloseIcon />
          </ToolbarButton>
        </div>
      </div>

      {!reader.isSupported && (
        <p className={`mx-auto mt-1 max-w-[1240px] type-meta ${SHELL_MUTED_TEXT}`}>
          {copy.noSpeech}
        </p>
      )}

      {reader.currentSegment && (
        <p
          aria-live="polite"
          className={`mx-auto mt-1 max-w-[1240px] truncate type-meta ${SHELL_MUTED_TEXT}`}
        >
          {reader.currentSegment}
        </p>
      )}

      {/* Scalloped bottom edge in place of a plain border, in the active theme's motif. */}
      <ThemeLaceEdge className="absolute inset-x-0 bottom-0" />

      {isAppearanceOpen && (
        <AppearancePanel panelId={appearancePanelId} onClose={() => setIsAppearanceOpen(false)} />
      )}
    </div>
  );
};
