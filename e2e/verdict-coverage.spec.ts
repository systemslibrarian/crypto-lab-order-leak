import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test, type Page } from '@playwright/test'
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
 *   4. every recorded mutation's marker is asserted through `expectVerdict` /
 *      `expectClaim`, so text and state are checked as one claim (Fix 1). A
 *      spec that merely MENTIONS the id no longer counts.
 *
 * The last two tests prove checks 3 and 4 can actually fail.
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

test('every recorded mutation is asserted through the text-and-state helper', () => {
  const specSource = readFileSync(fileURLToPath(new URL('./claims.spec.ts', import.meta.url)), 'utf8')
  const helper = { verdict: '(?:expectVerdict|expectEveryVerdict)', claim: '(?:expectClaim|expectEveryClaim)' }

  const unasserted = MARKER_MUTATIONS.filter((entry) => {
    const call = new RegExp(`${helper[entry.kind]}\\(\\s*page,\\s*'${entry.marker}'`)
    return !call.test(specSource)
  }).map((entry) => `${entry.kind}:${entry.marker}`)

  expect(
    unasserted,
    'these markers have a recorded mutation but claims.spec.ts never asserts them through expectVerdict/expectClaim, ' +
      `so their text could be flipped while data-result and the pass/fail class go on claiming the opposite: ${unasserted.join(', ')}`,
  ).toEqual([])

  // Prove this check can fail: a marker nothing asserts must not satisfy it.
  expect(new RegExp(`${helper.verdict}\\(\\s*page,\\s*'no-such-marker'`).test(specSource)).toBe(false)
})
