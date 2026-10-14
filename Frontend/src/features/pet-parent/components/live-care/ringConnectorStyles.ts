/** Named CSS classes (not Tailwind utilities) for the day's progress ring and the line that joins
 * timeline entries. The ring needs a conic gradient driven by the `--pct` custom property, which
 * no utility expresses. Every colour is a theme variable, so both follow the chosen theme.
 * Injected once via a `<style>` tag in LiveCareDashboardPage. The names are specific because a
 * bare `.ring` collided with Tailwind's own `ring` utility. */
export const RING_AND_CONNECTOR_CSS = `
.care-progress-ring {
  --pct: 0;
  width: 64px;
  height: 64px;
  border-radius: 9999px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: conic-gradient(
    var(--color-status-success) calc(var(--pct) * 1%),
    var(--color-border-soft) 0
  );
}
.care-progress-ring-inner {
  width: 50px;
  height: 50px;
  border-radius: 9999px;
  background: var(--color-surface-card);
  display: flex;
  align-items: center;
  justify-content: center;
}
.care-timeline-connector {
  flex: 1;
  width: 2px;
  background: var(--color-border-soft);
  margin: 2px 0;
  min-height: 22px;
}
`;
