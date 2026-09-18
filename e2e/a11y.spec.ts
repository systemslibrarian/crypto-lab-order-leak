import { expect, test } from '@playwright/test';
import {
  boot,
  driveAllStates,
  expectBaselineNotStale,
  NARROW,
  reportCollected,
  watchPageErrors,
} from './gate';

/**
 * WCAG A/AA regression gate.
 *
 * The lab is scanned on arrival and after each department, age, salary, and
 * randomized-control query, recovery, and reveal. The drive also covers a
 * shifted auxiliary population retiring prior recovery, the 24-row warning
 * and 240-row restoration, the method disclosure, the skip link, hover states,
 * and focus on commands, selects, summary, and both table scrollers. Every
 * state is measured in the lab's dark theme at desktop and 380px.
 *
 * See `gate.ts` for the independent WCAG and landmark axe runs, arithmetic
 * text contrast, aria-hidden contrast, non-text contrast ratchet, keyboard
 * scroller/focus checks, reflow, reduced-motion, and blank-render assertions.
 */

for (const theme of ['dark'] as const) {
  test(`no WCAG A/AA violations in ${theme} theme`, async ({ page }) => {
    test.setTimeout(1_800_000);
    const errors = watchPageErrors(page);
    await boot(page, theme);
    await driveAllStates(page, theme);
    expect(errors, errors.join('\n')).toEqual([]);
    expectBaselineNotStale();
    reportCollected();
  });

  test(`no WCAG A/AA violations in ${theme} theme at 380px`, async ({ page }) => {
    test.setTimeout(1_800_000);
    const errors = watchPageErrors(page);
    await page.setViewportSize(NARROW);
    await boot(page, theme);
    await driveAllStates(page, `${theme} @380px`);
    expect(errors, errors.join('\n')).toEqual([]);
    expectBaselineNotStale();
    reportCollected();
  });
}
