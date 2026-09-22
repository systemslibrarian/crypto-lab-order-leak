import { basename } from 'node:path'
import { expect, test, type Locator, type Page } from '@playwright/test'
import { recordObservation, type MarkerKind } from './marker-observations'

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
 *   - `expectVerdict` / `expectEveryVerdict` -- text, `data-result`, and the
 *     pass/fail class.
 *   - `expectClaim` / `expectEveryClaim` -- rendered text and `data-value`,
 *     which must agree, plus whatever STRUCTURE the caller derives for the
 *     marker: an equality pattern, an occurrence count, values that must not
 *     appear, a total the figures must sum to.
 *
 * Two things enforce that this is more than a convention, and brief decision
 * **D6** is why both of them are at RUNTIME rather than in a source scan:
 *
 * 1. **Every completed assertion is recorded.** Each helper appends its
 *    `(test title, marker)` pair to the run-scoped sink in
 *    `marker-observations.ts` AFTER its assertions have passed, and
 *    `verdict-coverage.spec.ts` requires every recorded mutation's pair to be
 *    in that sink. A commented-out call executes nothing, so it records
 *    nothing; a call in some other test records some other pair. The rule this
 *    replaces matched `expectVerdict(page, '<id>'` as SOURCE TEXT, which a
 *    comment satisfies and an unrelated line elsewhere in the file satisfies.
 *
 * 2. **An expectation read off the page under test is refused.** This lab's
 *    own Fix 1 escape kept the helper call and fed it
 *    `values: await claimValues(page, 'public-value')`, so the helper compared
 *    the page to itself and passed whatever the page said. Every read helper
 *    here taints what it returns, per page and per marker, and the assertion
 *    helpers throw rather than assert a tainted expectation. The limits of
 *    that are stated on `refuseSelfReferentialExpectation` below -- it is not
 *    a proof of independence, it closes the route this lab actually took.
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

export type EveryClaimExpectation = {
  /** every `data-value`, in document order, derived by the caller. */
  values?: string[]
  /** the rendered text when it differs from the value. */
  texts?: string[]
  /** how many occurrences must render. */
  count?: number
  /**
   * The equality pattern the rendered values must reproduce -- position i gets
   * the index of the first position holding the same value. This is how a
   * ciphertext column is asserted without asserting the ciphertexts: the
   * caller derives the pattern from its own stand-in plaintexts and the helper
   * compares. It subsumes "how many distinct values" and "fewer distinct than
   * rows", both of which are readable straight off the pattern.
   */
  pattern?: number[]
  /** values that must NOT appear -- e.g. a plaintext showing up in a cipher cell. */
  excludes?: string[]
  /** the total the rendered figures must add up to, when they are numbers. */
  sumsTo?: number
  scope?: string
}

/** Position i -> the index of the first position holding the same value. */
export const equalityPattern = (values: string[]): number[] => {
  const distinct = [...new Set(values)]
  return values.map((value) => distinct.indexOf(value))
}

/* ------------------------------------------------------------------ *
 * Refusing an expectation that came off the page under test.
 * ------------------------------------------------------------------ */

/** Arrays handed back by a read helper, by object identity. */
const PAGE_SOURCED = new WeakSet<object>()

/** Per page -- and so per test, since the fixture is per test -- what each
 *  marker has already been READ to hold, as whole lists and as single values. */
const READS = new WeakMap<Page, Map<string, { lists: Set<string>; values: Set<string> }>>()

function ledgerFor(page: Page, kind: MarkerKind, id: string) {
  let byMarker = READS.get(page)
  if (!byMarker) READS.set(page, (byMarker = new Map()))
  const key = `${kind}:${id}`
  let entry = byMarker.get(key)
  if (!entry) byMarker.set(key, (entry = { lists: new Set<string>(), values: new Set<string>() }))
  return entry
}

/** Record that this test has now READ the marker, so it cannot be its oracle. */
function noteRead(page: Page, kind: MarkerKind, id: string, values: string[]): string[] {
  const entry = ledgerFor(page, kind, id)
  entry.lists.add(JSON.stringify(values))
  for (const value of values) entry.values.add(value)
  PAGE_SOURCED.add(values)
  return values
}

/**
 * Throw if the expectation about to be asserted is the page's own answer.
 *
 * Caught: an array a read helper returned (by identity, so a read passed
 * straight through is refused however it is spelled), an array whose CONTENT
 * equals what this test already read from the same marker (so `[...values]`,
 * `values.map(String)` and `values.slice()` are refused too), and a scalar
 * this test already read from that marker.
 *
 * NOT caught, and said plainly rather than implied: a value the spec obtains
 * without going through this module -- `locator.textContent()`,
 * `locator.getAttribute('data-value')`, a `page.evaluate` that returns marker
 * content. Playwright offers no hook that would make those observable from
 * here. `verdict-coverage.spec.ts` closes that route separately by requiring
 * `claims.spec.ts` to contain none of those value-reading calls at all, which
 * leaves this module as the only way the spec can learn what the page says.
 * That second rule IS a source scan, with everything D6 says about source
 * scans; it is a bypass guard sitting on top of a runtime rule, not the rule.
 */
function refuseSelfReferentialExpectation(page: Page, kind: MarkerKind, id: string, expected: unknown): void {
  const refuse = (how: string): never => {
    throw new Error(
      `[data-${kind}="${id}"] was handed an expectation ${how}. A helper whose expected values come off ` +
        'the page under test asserts nothing: it compares the page to itself and passes whatever the page ' +
        'says. Derive the expectation in the spec -- a stand-in counter, the equality pattern of the ' +
        'plaintexts, a total from the row count read off the CONTROL -- and pass that instead.',
    )
  }
  const entry = READS.get(page)?.get(`${kind}:${id}`)
  if (Array.isArray(expected)) {
    if (PAGE_SOURCED.has(expected)) refuse('that a read helper returned')
    if (entry?.lists.has(JSON.stringify(expected.map(String)))) refuse('equal to what this test already read from it')
    return
  }
  if (typeof expected === 'string' && entry?.values.has(expected)) {
    refuse('this test already read from it')
  }
}

/* ------------------------------------------------------------------ *
 * Recording what actually ran.
 * ------------------------------------------------------------------ */

/** Called only on the success path: an observation means the assertion HELD. */
function observed(kind: MarkerKind, marker: string): void {
  const info = test.info()
  recordObservation({ test: info.title, kind, marker, file: basename(info.file) })
}

function locate(page: Page, attribute: string, id: string, options: { nth?: number; scope?: string }): Locator {
  const selector = `${options.scope ?? ''} [${attribute}="${id}"]`.trim()
  const all = page.locator(selector)
  return options.nth === undefined ? all.first() : all.nth(options.nth)
}

/* ------------------------------------------------------------------ *
 * The assertions.
 * ------------------------------------------------------------------ */

/** Assert a verdict's words, its state and its paint together. */
export async function expectVerdict(page: Page, id: string, expectation: VerdictExpectation): Promise<void> {
  if (typeof expectation.text === 'string') refuseSelfReferentialExpectation(page, 'verdict', id, expectation.text)
  const marker = locate(page, 'data-verdict', id, expectation)
  const where = `[data-verdict="${id}"]${expectation.nth === undefined ? '' : ` #${expectation.nth}`}`
  await expect(marker, `${where} text`).toHaveText(expectation.text)
  await expect(marker, `${where} state`).toHaveAttribute('data-result', expectation.result)
  const className = (await marker.getAttribute('class')) ?? ''
  expect(className.split(/\s+/).filter(Boolean).join(' '), `${where} paint`).toBe(expectation.className)
  observed('verdict', id)
}

/** Every occurrence of a repeating verdict marker shows the same words, state and paint. */
export async function expectEveryVerdict(
  page: Page,
  id: string,
  expectation: { text: string; result: string; className: string; scope?: string; count?: number },
): Promise<void> {
  refuseSelfReferentialExpectation(page, 'verdict', id, expectation.text)
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
  observed('verdict', id)
}

/** Assert a measurement's rendered text and its `data-value` together. */
export async function expectClaim(page: Page, id: string, expectation: ClaimExpectation): Promise<void> {
  refuseSelfReferentialExpectation(page, 'claim', id, expectation.value)
  if (expectation.text !== undefined) refuseSelfReferentialExpectation(page, 'claim', id, expectation.text)
  const marker = locate(page, 'data-claim', id, expectation)
  const where = `[data-claim="${id}"]${expectation.nth === undefined ? '' : ` #${expectation.nth}`}`
  await expect(marker, `${where} value`).toHaveAttribute('data-value', expectation.value)
  await expect(marker, `${where} text`).toHaveText(expectation.text ?? expectation.value)
  observed('claim', id)
}

/**
 * Every occurrence of a repeating measurement marker, in document order.
 *
 * The text/value agreement is asserted on every call, whether or not the
 * caller supplies `values`: a marker whose rendered figure disagrees with the
 * `data-value` beside it is already two claims and only one of them can be
 * right. Everything else the caller DERIVES -- `values`, `pattern`, `count`,
 * `excludes`, `sumsTo` -- and at least one of them is required, so the call
 * cannot degenerate into one that asserts only that the page agrees with
 * itself.
 */
export async function expectEveryClaim(page: Page, id: string, expectation: EveryClaimExpectation): Promise<void> {
  refuseSelfReferentialExpectation(page, 'claim', id, expectation.values)
  const derived = (['values', 'pattern', 'count', 'excludes', 'sumsTo'] as const).filter(
    (key) => expectation[key] !== undefined,
  )
  expect(derived, `[data-claim="${id}"] was asserted with nothing derived to assert against`).not.toEqual([])

  const markers = page.locator(`${expectation.scope ?? ''} [data-claim="${id}"]`.trim())
  const values = await markers.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-value') ?? ''))
  const texts = (await markers.allTextContents()).map((text) => text.trim())

  expect(values.length, `[data-claim="${id}"] renders nothing to assert`).toBeGreaterThan(0)
  if (expectation.count !== undefined) expect(values.length, `[data-claim="${id}"] occurrences`).toBe(expectation.count)
  if (expectation.values) expect(values, `[data-claim="${id}"] values`).toEqual(expectation.values)
  expect(texts, `[data-claim="${id}"] text`).toEqual(expectation.texts ?? expectation.values ?? values)
  if (expectation.pattern) expect(equalityPattern(values), `[data-claim="${id}"] equality pattern`).toEqual(expectation.pattern)
  if (expectation.excludes) {
    const forbidden = new Set(expectation.excludes)
    expect(
      values.filter((value) => forbidden.has(value)),
      `[data-claim="${id}"] rendered a value it must never render`,
    ).toEqual([])
  }
  if (expectation.sumsTo !== undefined) {
    expect(values.reduce((sum, value) => sum + Number(value), 0), `[data-claim="${id}"] total`).toBe(expectation.sumsTo)
  }
  observed('claim', id)
}

/**
 * Read a repeating marker's `data-value` list without asserting it.
 *
 * Whatever this returns is TAINTED: handing it back to `expectClaim` or
 * `expectEveryClaim` for the same marker is refused, because such an assertion
 * holds for any page. Prefer `expectEveryClaim`'s `pattern` / `sumsTo` /
 * `excludes`, which assert a property of the values INSIDE the helper, so a
 * kill lands on the marker's own assertion rather than on a bare `expect`
 * beside it -- which is how this lab's `sealed-cipher` record came to name a
 * kill the helper never saw.
 */
export async function claimValues(page: Page, id: string, scope = ''): Promise<string[]> {
  const values = await page
    .locator(`${scope} [data-claim="${id}"]`.trim())
    .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-value') ?? ''))
  return noteRead(page, 'claim', id, values)
}

/**
 * The row count currently sealed, read from the control rather than assumed.
 *
 * Every oracle in `claims.spec.ts` derives its expected totals from this, so no
 * expectation is a literal that happens to be right at the default (brief Fix
 * 4's principle, and what makes Fix 6's non-default runs meaningful). This
 * reads a FORM CONTROL, not a marker: it is the input to the run rather than
 * the page's report of it, so nothing it returns is tainted.
 */
export async function rowCount(page: Page): Promise<number> {
  return Number(await page.locator('#row-count').inputValue())
}

/** How many of those rows the two tables actually render. */
export function shownRows(total: number): number {
  return Math.min(total, 18)
}
