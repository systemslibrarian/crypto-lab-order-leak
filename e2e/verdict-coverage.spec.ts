import { expect, test, type Page } from '@playwright/test'
import { COVERED_MARKERS, VERDICT_MUTATIONS } from './verdict-mutations'

/**
 * Template §0 / §4.1c coverage gate.
 *
 * Coverage is derived by WALKING THE RENDERED PAGE, never from a list an author
 * maintained by hand. Two independent checks:
 *
 *   1. every `data-verdict` marker the page can render has a mutation recorded
 *      for it in verdict-mutations.ts (and every recorded mutation still has a
 *      marker, so the record cannot rot into fiction);
 *   2. no verdict word and no verdict styling is rendered OUTSIDE a marker --
 *      which is what catches a later contributor pasting in a raw banner.
 *
 * The third test proves check 2 can actually fail, by adding exactly the kind of
 * unmarked banner a careless builder would.
 */

/** Uppercase outcome tokens. Case-sensitive on purpose: prose says "recovered". */
const VERDICT_WORDS =
  /\b(NOTHING RECOVERED|TAGS VERIFIED|TAG FAILURE|RECOVERED|MISMATCHED|MISMATCH|AMBIGUOUS|MATCHED|VERIFIED|REJECTED|WAITING)\b/

/** Classes that paint an outcome. Excludes danger-fact/safe-fact, which label the
 *  selected scheme rather than a result. */
const VERDICT_CLASSES = ['alarm-text', 'amber-text', 'control-ok']

async function markersOnPage(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-verdict]')].map((element) => element.getAttribute('data-verdict')!),
  )
}

/** Verdict text or verdict styling that is not inside a `[data-verdict]`. */
async function unmarkedVerdicts(page: Page, wordSource: string, classes: string[]) {
  return page.evaluate(
    ({ wordSource, classes }) => {
      const words = new RegExp(wordSource)
      const offenders: string[] = []
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement
        if (!parent || parent.closest('[data-verdict]')) continue
        // Column headers label a table, they do not report an outcome.
        if (parent.closest('thead')) continue
        const text = node.textContent ?? ''
        if (words.test(text)) offenders.push(`text: ${parent.tagName}.${parent.className} :: ${text.trim().slice(0, 120)}`)
      }
      classes.forEach((name) => {
        document.querySelectorAll(`.${name}`).forEach((element) => {
          if (!element.closest('[data-verdict]')) offenders.push(`style: .${name} on ${element.tagName} :: ${(element.textContent ?? '').trim().slice(0, 120)}`)
        })
      })
      return offenders
    },
    { wordSource, classes },
  )
}

const COLUMNS = ['Department', 'Age', 'Salary'] as const
const SCHEMES = ['Deterministic (DTE)', 'Order-preserving (OPE)', 'Order-revealing (ORE)', 'Randomized control'] as const

/** Drive every column x scheme through query, recovery and reveal. */
async function driveEveryState(page: Page, visit: () => Promise<void>) {
  await visit()
  for (const column of COLUMNS) {
    await page.getByRole('button', { name: column, exact: true }).click()
    for (const scheme of SCHEMES) {
      await page.getByRole('button', { name: scheme, exact: true }).click()
      await page.getByRole('button', { name: scheme === 'Randomized control' ? 'Try a query' : 'Run query on ciphertexts' }).click()
      await expect(page.locator('[data-verdict="run-status"]')).not.toBeEmpty()
      await visit()
      await page.getByRole('button', { name: 'Run recovery' }).click()
      await visit()
      const reveal = page.getByRole('button', { name: 'Reveal sealed truth' })
      if (await reveal.isEnabled()) {
        await reveal.click()
        await expect(page.locator('[data-verdict="recovery-score"]')).toBeVisible()
        await visit()
      }
    }
  }
}

test('every rendered verdict marker has a recorded mutation, and every record still renders', async ({ page }) => {
  await page.goto('/')
  const seen = new Set<string>()
  await driveEveryState(page, async () => {
    for (const marker of await markersOnPage(page)) seen.add(marker)
  })

  const uncovered = [...seen].filter((marker) => !COVERED_MARKERS.has(marker)).sort()
  expect(uncovered, `rendered verdict markers with no §4.1c mutation recorded in e2e/verdict-mutations.ts: ${uncovered.join(', ')}`).toEqual([])

  const unrendered = VERDICT_MUTATIONS.map((entry) => entry.marker).filter((marker) => !seen.has(marker)).sort()
  expect(unrendered, `mutations recorded for markers the page never renders: ${unrendered.join(', ')}`).toEqual([])

  // A lab with no verdicts would otherwise pass both checks above vacuously.
  expect(seen.size).toBeGreaterThan(0)
})

test('no verdict word or verdict styling is rendered outside a marker', async ({ page }) => {
  await page.goto('/')
  const offenders: string[] = []
  await driveEveryState(page, async () => {
    for (const offender of await unmarkedVerdicts(page, VERDICT_WORDS.source, VERDICT_CLASSES)) offenders.push(offender)
  })
  expect([...new Set(offenders)], 'verdict rendered outside a data-verdict marker').toEqual([])
})

test('the outside-marker check catches a raw unmarked banner', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-verdict="run-status"]')).toBeVisible()
  expect(await unmarkedVerdicts(page, VERDICT_WORDS.source, VERDICT_CLASSES)).toEqual([])

  // Exactly what a careless builder adds: an outcome banner with no marker.
  await page.evaluate(() => {
    const banner = document.createElement('p')
    banner.className = 'alarm-text'
    banner.textContent = 'ALL 240 ROWS RECOVERED'
    document.querySelector('#app')!.append(banner)
  })

  const offenders = await unmarkedVerdicts(page, VERDICT_WORDS.source, VERDICT_CLASSES)
  expect(offenders.some((offender) => offender.startsWith('text:'))).toBe(true)
  expect(offenders.some((offender) => offender.startsWith('style:'))).toBe(true)
})
