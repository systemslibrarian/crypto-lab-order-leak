import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
import { claimValues, expectClaim, expectEveryClaim } from './expect-marker'
import { observedPairs, pairKey } from './marker-observations'
import { COVERED_CLAIMS, COVERED_VERDICTS, MARKER_MUTATIONS } from './verdict-mutations'

/**
 * Template §0 / §4.1c coverage gate.
 *
 * Coverage is derived by WALKING THE RENDERED PAGE, never from a list an author
 * maintained by hand. Four independent checks:
 *
 *   1. every `data-verdict` marker the page can render has a mutation recorded
 *      for it in verdict-mutations.ts (and every recorded mutation still has a
 *      marker, so the record cannot rot into fiction);
 *   2. every `data-claim` MEASUREMENT marker is in that same loop on the same
 *      terms -- a rendered number with no mutation record fails the build, and
 *      a record naming a claim the page no longer renders fails too (Fix 2);
 *   3. no verdict word, no verdict styling and no unmarked measurement is
 *      rendered outside a marker -- which catches a later contributor pasting
 *      in a raw banner, or painting a number nothing is asserting (Fix 3);
 *   4. every recorded mutation's marker was asserted through `expectVerdict` /
 *      `expectClaim` AT RUNTIME, by the test the record names, so text and
 *      state are checked as one claim (Fix 1) and the check is over what ran
 *      rather than over what the source says ran (D6). Two further rules serve
 *      it: `claims.spec.ts` may not read page content by any route but
 *      `expect-marker.ts`, and a helper handed the page's own answer throws.
 *
 * Three tests prove checks 3 and 4 can actually fail.
 *
 * The denominator for checks 1-3 is `driveEveryState`, and brief Fix 6 makes
 * that the load-bearing part: it visits **every option of every control that
 * changes what renders**. A marker that appears only at 24 rows, or only under
 * a mismatched auxiliary population, is otherwise outside the set these rules
 * judge, and stays outside however carefully the rules are written.
 */

/** Uppercase outcome tokens. Case-sensitive on purpose: prose says "recovered". */
const VERDICT_WORDS =
  /\b(NOTHING RECOVERED|TAGS VERIFIED|TAG FAILURE|SAMPLE WARNING|RECOVERED|MISMATCHED|MISMATCH|AMBIGUOUS|MATCHED|VERIFIED|REJECTED|WAITING)\b/

/** Classes that paint an outcome. Excludes danger-fact/safe-fact, which label the
 *  selected scheme rather than a result. */
const VERDICT_CLASSES = ['alarm-text', 'amber-text', 'control-ok']

/**
 * A rendered number is a claim too, and it is the easier one to leave unmarked,
 * because a number does not look like a claim. In the result regions -- the two
 * panels, the evidence paragraph and the sample warning -- any leaf that is a
 * bare integer, or a figure carrying one of this lab's units, must sit inside a
 * marker. The units are this lab's own: it counts rows, buckets, ciphertexts
 * and comparisons, not bytes and milliseconds.
 *
 * Up to three words may sit between the figure and its unit, because this lab
 * writes them that way -- `28,680 pairwise CLWW comparisons`. A pattern that
 * demanded the unit adjacent would walk straight past the very sentence the
 * ORE exhibit rests on.
 */
const RESULT_REGIONS = '#app .lab-grid, #app .evidence, #app .warning'
const MEASUREMENT =
  /\d[\d,.]*(?:\s+[A-Za-z][\w-]*){0,3}\s*(?:rows?|buckets?|ciphertexts?|comparisons?|categories|values|ops?|operations?|bits?|bytes?|B|KB|MB|ms)\b/i

async function markersOnPage(page: Page): Promise<{ verdicts: string[]; claims: string[] }> {
  return page.evaluate(() => ({
    verdicts: [...document.querySelectorAll('[data-verdict]')].map((element) => element.getAttribute('data-verdict')!),
    claims: [...document.querySelectorAll('[data-claim]')].map((element) => element.getAttribute('data-claim')!),
  }))
}

/** Verdict text, verdict styling, or a measurement, that is not inside a marker. */
async function unmarkedClaims(page: Page, wordSource: string, classes: string[], regions: string, measurementSource: string) {
  return page.evaluate(
    ({ wordSource, classes, regions, measurementSource }) => {
      const words = new RegExp(wordSource)
      const measurement = new RegExp(measurementSource, 'i')
      const bareInteger = /^[\d,]+$/
      const offenders: string[] = []

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement
        if (!parent) continue
        // Column headers label a table, they do not report an outcome.
        if (parent.closest('thead')) continue
        const raw = node.textContent ?? ''
        const text = raw.trim()
        if (!parent.closest('[data-verdict]') && words.test(raw)) {
          offenders.push(`text: ${parent.tagName}.${parent.className} :: ${text.slice(0, 120)}`)
        }
        if (!parent.closest(regions) || parent.closest('[data-verdict], [data-claim]')) continue
        if (measurement.test(text) || bareInteger.test(text)) {
          offenders.push(`number: ${parent.tagName}.${parent.className} :: ${text.slice(0, 120)}`)
        }
      }
      classes.forEach((name) => {
        document.querySelectorAll(`.${name}`).forEach((element) => {
          if (!element.closest('[data-verdict]')) offenders.push(`style: .${name} on ${element.tagName} :: ${(element.textContent ?? '').trim().slice(0, 120)}`)
        })
      })
      return offenders
    },
    { wordSource, classes, regions, measurementSource },
  )
}

/**
 * Every control this lab renders, and what each one changes.
 *
 * Walked: the column segment, the scheme segment, the row-count select and the
 * public-population select. Not walked, with reason: the `Method notes and
 * limits` `<details>` -- its prose is in the DOM whether it is open or closed,
 * so both page checks above already see it and toggling renders nothing new;
 * and the two `.table-wrap` scrollers, which move a viewport rather than change
 * what the page renders.
 */
const COLUMNS = ['department', 'age', 'salary'] as const
const SCHEMES = ['dte', 'ope', 'ore', 'control'] as const
const ROW_COUNTS = ['24', '240', '500', '1000'] as const
const POPULATIONS = ['matching', 'shifted', 'mismatch'] as const

/** Query, recover, and reveal from whatever state the page is in. */
async function exercise(page: Page, visit: () => Promise<void>) {
  await page.locator('#query').click()
  await expect(page.locator('[data-verdict="run-status"]')).not.toBeEmpty()
  await visit()
  await page.locator('#recover').click()
  await visit()
  const reveal = page.locator('#reveal')
  if (await reveal.isEnabled()) {
    await reveal.click()
    await expect(page.locator('[data-verdict="recovery-score"]')).toBeVisible()
    await visit()
  }
}

/**
 * Brief Fix 6: every option of every control that changes what renders.
 *
 * Column x scheme x population is crossed rather than walked per-control, and
 * that is deliberate rather than an oversight. The population select's rendered
 * effect is decided JOINTLY with the column and the scheme: `RECOVERY REJECTED:
 * Auxiliary support mismatch` exists only at a mismatched population on a
 * column and scheme whose recovery can reject it, so a strictly per-control
 * walk from the default state would leave that verdict unreachable by the
 * denominator -- the exact defect this rule exists to close. The row-count
 * select IS walked on its own, per the rule, because its effect (the
 * `sample-warning` verdict at 24 rows, and the totals everywhere else) does not
 * depend on the other three.
 *
 * Buttons are located by id and by data attribute, never by label: `#query`
 * reads 'Try a query' under the randomized control and 'Run query on
 * ciphertexts' everywhere else, so a name-based locator silently stops matching
 * as soon as the walk moves.
 */
async function driveEveryState(page: Page, visit: () => Promise<void>) {
  await visit()

  for (const rowCount of ROW_COUNTS) {
    await page.locator('#row-count').selectOption(rowCount)
    await expect(page.locator('[data-verdict="run-status"]')).toContainText(`Dataset reshuffled to ${Number(rowCount)} rows`)
    await visit()
    await exercise(page, visit)
  }
  await page.locator('#row-count').selectOption('240')
  await expect(page.locator('[data-verdict="run-status"]')).toContainText('Dataset reshuffled to 240 rows')

  for (const column of COLUMNS) {
    await page.locator(`[data-column="${column}"]`).click()
    await visit()
    for (const scheme of SCHEMES) {
      await page.locator(`[data-scheme="${scheme}"]`).click()
      await visit()
      for (const population of POPULATIONS) {
        await page.locator('#population').selectOption(population)
        await expect(page.locator('[data-verdict="run-status"]')).toContainText(`Auxiliary population changed to ${population}`)
        await visit()
        await exercise(page, visit)
      }
      await page.locator('#population').selectOption('matching')
    }
  }
}

test('every rendered marker has a recorded mutation, and every record still renders', async ({ page }) => {
  test.setTimeout(300_000)
  await page.goto('/')
  const seenVerdicts = new Set<string>()
  const seenClaims = new Set<string>()
  await driveEveryState(page, async () => {
    const { verdicts, claims } = await markersOnPage(page)
    for (const marker of verdicts) seenVerdicts.add(marker)
    for (const marker of claims) seenClaims.add(marker)
  })

  const uncoveredVerdicts = [...seenVerdicts].filter((marker) => !COVERED_VERDICTS.has(marker)).sort()
  expect(uncoveredVerdicts, `rendered verdict markers with no §4.1c mutation recorded in e2e/verdict-mutations.ts: ${uncoveredVerdicts.join(', ')}`).toEqual([])

  const uncoveredClaims = [...seenClaims].filter((marker) => !COVERED_CLAIMS.has(marker)).sort()
  expect(uncoveredClaims, `rendered measurement markers with no §4.1c mutation recorded in e2e/verdict-mutations.ts: ${uncoveredClaims.join(', ')}`).toEqual([])

  const unrendered = MARKER_MUTATIONS
    .filter((entry) => !(entry.kind === 'verdict' ? seenVerdicts : seenClaims).has(entry.marker))
    .map((entry) => `${entry.kind}:${entry.marker}`)
    .sort()
  expect(unrendered, `mutations recorded for markers the page never renders as that kind: ${unrendered.join(', ')}`).toEqual([])

  // A lab with no markers would otherwise pass every check above vacuously.
  expect(seenVerdicts.size).toBeGreaterThan(0)
  expect(seenClaims.size).toBeGreaterThan(0)
})

test('no verdict word, verdict styling, or unmarked measurement is rendered outside a marker', async ({ page }) => {
  test.setTimeout(300_000)
  await page.goto('/')
  const offenders: string[] = []
  await driveEveryState(page, async () => {
    for (const offender of await unmarkedClaims(page, VERDICT_WORDS.source, VERDICT_CLASSES, RESULT_REGIONS, MEASUREMENT.source)) offenders.push(offender)
  })
  expect([...new Set(offenders)], 'verdict or measurement rendered outside a marker').toEqual([])
})

test('the outside-marker check catches a raw unmarked banner and a raw unmarked number', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-verdict="run-status"]')).toBeVisible()
  expect(await unmarkedClaims(page, VERDICT_WORDS.source, VERDICT_CLASSES, RESULT_REGIONS, MEASUREMENT.source)).toEqual([])

  // Exactly what a careless builder adds: an outcome banner with no marker, and
  // a measurement painted straight into a result panel.
  await page.evaluate(() => {
    const banner = document.createElement('p')
    banner.className = 'alarm-text'
    banner.textContent = 'ALL 240 ROWS RECOVERED'
    document.querySelector('#app')!.append(banner)
    const number = document.createElement('p')
    number.textContent = '28,680 pairwise comparisons'
    document.querySelector('.panel.attacker')!.append(number)
  })

  const offenders = await unmarkedClaims(page, VERDICT_WORDS.source, VERDICT_CLASSES, RESULT_REGIONS, MEASUREMENT.source)
  expect(offenders.some((offender) => offender.startsWith('text:'))).toBe(true)
  expect(offenders.some((offender) => offender.startsWith('style:'))).toBe(true)
  expect(offenders.some((offender) => offender.startsWith('number:'))).toBe(true)
  expect(offenders.some((offender) => offender.includes('28,680 pairwise comparisons'))).toBe(true)
})

/**
 * Brief decision D6: a mention is still not an assertion, one level down.
 *
 * What stood here until now matched `expectVerdict(page, '<id>'` as SOURCE
 * TEXT across `claims.spec.ts`, and enforced that a string is present rather
 * than that an assertion ran. Three auditors defeated that shape three ways
 * across the fleet, and this lab's own escape was the middle one:
 *
 *   - comment the call out, and the text still matches;
 *   - keep the call and feed it `values: await claimValues(page, ...)`, and it
 *     runs but compares the page to itself -- the recorded `public-value`
 *     mutation shipped the attacker's histogram as ["0","1","2","3"] with this
 *     rule green at 16 passed;
 *   - satisfy the FILE-granular match from an unrelated line in another test,
 *     and the killing assertion can be rewritten to anything.
 *
 * So the denominator comes from what RAN. `expect-marker.ts` appends its
 * `(test title, marker)` pair to a run-scoped sink after each assertion
 * passes, and every mutation record names the test whose assertion killed it.
 * A commented-out call executes nothing; a call in another test records
 * another pair; a tautological call throws before it can record anything.
 *
 * This test runs in its own Playwright project, which `dependencies: ['claims']`
 * puts AFTER the whole claims project, because the pairs do not exist until
 * those tests have run -- and they run in separate worker processes, so a
 * module-level Set would aggregate nothing.
 */
test('every recorded mutation was asserted at RUNTIME, by the test its record names', () => {
  const { pairs, tests, lines } = observedPairs()

  expect(
    lines,
    'no marker assertion was observed at all. This check reads what `claims.spec.ts` actually executed, so it ' +
      'is only meaningful when that project has run: use `npm run test:verdicts` (or `--project=verdict-coverage`, ' +
      'which pulls the claims project in as a dependency) rather than naming this file directly.',
  ).toBeGreaterThan(0)

  const unobserved = MARKER_MUTATIONS.filter((entry) => !pairs.has(pairKey(entry.killedByTest, entry.kind, entry.marker))).map(
    (entry) =>
      `${entry.kind}:${entry.marker} -- record names "${entry.killedByTest}", which ${
        tests.has(entry.killedByTest) ? 'RAN but never asserted this marker through the helper' : 'asserted nothing / never ran'
      }`,
  )

  expect(
    unobserved,
    'these recorded mutations name a killing assertion that did not happen. Nothing in the run went through ' +
      `expectVerdict/expectClaim for that marker in that test, so the record is evidence about a check nobody made:\n  ${unobserved.join('\n  ')}`,
  ).toEqual([])

  // Prove this check can fail: a pair nothing executed must not be observed.
  expect(pairs.has(pairKey('no such test', 'verdict', 'no-such-marker'))).toBe(false)
})

/**
 * The bypass guard for the tautology rule, and it is a source scan on purpose.
 *
 * `expect-marker.ts` refuses an expectation that came back from one of ITS read
 * helpers, which is a runtime rule and the real one. It cannot see a value the
 * spec reads by some other route -- `locator.textContent()`,
 * `getAttribute('data-value')`, an `evaluateAll` of its own -- because
 * Playwright exposes no hook that would make those observable. This closes that
 * route by requiring the spec to contain none of them, which leaves
 * `expect-marker.ts` as the only way `claims.spec.ts` can learn what the page
 * says. It is a bypass guard sitting on top of a runtime rule, never the rule.
 */
test('claims.spec.ts learns what the page says only through expect-marker.ts', () => {
  const specSource = readFileSync(fileURLToPath(new URL('./claims.spec.ts', import.meta.url)), 'utf8')
  const readCalls = [
    '.textContent(',
    '.allTextContents(',
    '.allInnerTexts(',
    '.innerText(',
    '.innerHTML',
    '.getAttribute(',
    '.inputValue(',
    '.evaluateAll(',
    '= await page.evaluate(',
    '=await page.evaluate(',
  ]
  const found = readCalls.filter((call) => specSource.includes(call))
  expect(
    found,
    'claims.spec.ts reads page content directly. An expectation obtained that way is outside the tautology check ' +
      `in expect-marker.ts, so it can be handed straight back to a helper as its own oracle: ${found.join(', ')}`,
  ).toEqual([])

  // Prove this check can fail: the banned spellings are the ones searched for.
  expect(readCalls.some((call) => `${specSource}\nawait locator.textContent()`.includes(call))).toBe(true)
})

test("a helper fed the page's own answer refuses to assert it", async ({ page }) => {
  await page.goto('/')
  const read = await claimValues(page, 'public-value')
  expect(read.length, 'nothing was read, so nothing is being refused').toBeGreaterThan(0)

  // This lab's Fix 1 escape, executed: keep the helper call, feed it what the
  // page just said. It passed for any page, including one whose auxiliary
  // histogram had lost every label.
  await expect(expectEveryClaim(page, 'public-value', { values: read })).rejects.toThrow(
    /was handed an expectation that a read helper returned/,
  )

  // A copy is refused too: the check is on content as well as identity, so
  // `[...values]`, `.slice()` and `.map(String)` do not launder it.
  await expect(expectEveryClaim(page, 'public-value', { values: [...read] })).rejects.toThrow(
    /equal to what this test already read from it/,
  )

  // An expectation the spec derives still asserts normally -- a rule that
  // refused everything would pass the two checks above and protect nothing.
  await expectClaim(page, 'row-id', { value: '1', nth: 0 })
})
