import { expect, type Locator, type Page } from '@playwright/test'

/**
 * The one way this lab is allowed to assert a rendered marker.
 *
 * Brief Fix 1: **a marker's text and its state are ONE claim**, so a mutation
 * that flips the words must flip the state with them. A test that only checks
 * `toContainText` records a kill while the page goes on claiming the opposite
 * in every way a reader can see except the sentence -- the `data-result` and
 * the pass/fail paint stay put.
 *
 * So there is exactly one helper per marker family and it asserts everything
 * in a single call:
 *
 *   - `expectVerdict`  -- text, `data-result`, and the pass/fail class.
 *   - `expectClaim`    -- rendered text and `data-value`, which must agree.
 *
 * `verdict-coverage.spec.ts` then requires that EVERY recorded mutation's
 * marker is asserted through one of these, not merely mentioned. A text-only
 * assertion fails the build rather than being filed as evidence.
 */

export type VerdictExpectation = {
  /** the rendered words, in full. */
  text: string | RegExp
  /** the machine-readable state the same expression chose. */
  result: string
  /** the class that paints the outcome. Pass '' for a marker that paints none. */
  className: string
  /** which occurrence, when the marker repeats (per-row verdicts). */
  nth?: number
  /** narrow to one panel when the same marker renders in both. */
  scope?: string
}

export type ClaimExpectation = {
  /** the `data-value` the page computed. */
  value: string
  /** the rendered text, when it differs from the value (e.g. '—' for pending). */
  text?: string
  nth?: number
  scope?: string
}

function locate(page: Page, attribute: string, id: string, options: { nth?: number; scope?: string }): Locator {
  const selector = `${options.scope ?? ''} [${attribute}="${id}"]`.trim()
  const all = page.locator(selector)
  return options.nth === undefined ? all.first() : all.nth(options.nth)
}

/** Assert a verdict's words, its state and its paint together. */
export async function expectVerdict(page: Page, id: string, expectation: VerdictExpectation): Promise<void> {
  const marker = locate(page, 'data-verdict', id, expectation)
  const where = `[data-verdict="${id}"]${expectation.nth === undefined ? '' : ` #${expectation.nth}`}`
  await expect(marker, `${where} text`).toHaveText(expectation.text)
  await expect(marker, `${where} state`).toHaveAttribute('data-result', expectation.result)
  const className = (await marker.getAttribute('class')) ?? ''
  expect(className.split(/\s+/).filter(Boolean).join(' '), `${where} paint`).toBe(expectation.className)
}

/** Every occurrence of a repeating verdict marker shows the same words, state and paint. */
export async function expectEveryVerdict(
  page: Page,
  id: string,
  expectation: { text: string; result: string; className: string; scope?: string; count?: number },
): Promise<void> {
  const markers = page.locator(`${expectation.scope ?? ''} [data-verdict="${id}"]`.trim())
  const total = await markers.count()
  expect(total, `[data-verdict="${id}"] renders nothing to assert`).toBeGreaterThan(0)
  if (expectation.count !== undefined) expect(total, `[data-verdict="${id}"] occurrences`).toBe(expectation.count)
  expect(await markers.allTextContents(), `[data-verdict="${id}"] text`).toEqual(Array(total).fill(expectation.text))
  expect(
    await markers.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-result'))),
    `[data-verdict="${id}"] state`,
  ).toEqual(Array(total).fill(expectation.result))
  expect(
    await markers.evaluateAll((nodes) => nodes.map((node) => (node.getAttribute('class') ?? '').trim())),
    `[data-verdict="${id}"] paint`,
  ).toEqual(Array(total).fill(expectation.className))
}

/** Assert a measurement's rendered text and its `data-value` together. */
export async function expectClaim(page: Page, id: string, expectation: ClaimExpectation): Promise<void> {
  const marker = locate(page, 'data-claim', id, expectation)
  const where = `[data-claim="${id}"]${expectation.nth === undefined ? '' : ` #${expectation.nth}`}`
  await expect(marker, `${where} value`).toHaveAttribute('data-value', expectation.value)
  await expect(marker, `${where} text`).toHaveText(expectation.text ?? expectation.value)
}

/** Every occurrence of a repeating measurement marker, in document order. */
export async function expectEveryClaim(
  page: Page,
  id: string,
  expectation: { values: string[]; texts?: string[]; scope?: string },
): Promise<void> {
  const markers = page.locator(`${expectation.scope ?? ''} [data-claim="${id}"]`.trim())
  expect(
    await markers.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-value'))),
    `[data-claim="${id}"] values`,
  ).toEqual(expectation.values)
  expect(
    (await markers.allTextContents()).map((text) => text.trim()),
    `[data-claim="${id}"] text`,
  ).toEqual(expectation.texts ?? expectation.values)
}

/** Read a repeating marker's `data-value` list without asserting it. */
export async function claimValues(page: Page, id: string, scope = ''): Promise<string[]> {
  return page
    .locator(`${scope} [data-claim="${id}"]`.trim())
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-value') ?? ''))
}

/**
 * The row count currently sealed, read from the control rather than assumed.
 *
 * Every oracle in `claims.spec.ts` derives its expected totals from this, so no
 * expectation is a literal that happens to be right at the default (brief Fix
 * 4's principle, and what makes Fix 6's non-default runs meaningful).
 */
export async function rowCount(page: Page): Promise<number> {
  return Number(await page.locator('#row-count').inputValue())
}

/** How many of those rows the two tables actually render. */
export function shownRows(total: number): number {
  return Math.min(total, 18)
}
