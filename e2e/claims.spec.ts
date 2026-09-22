import { expect, test, type Page } from '@playwright/test'
import {
  equalityPattern,
  expectClaim,
  expectEveryClaim,
  expectEveryVerdict,
  expectVerdict,
  rowCount,
  shownRows,
} from './expect-marker'

/**
 * Every rendered marker is asserted here through `expectVerdict` /
 * `expectClaim`, which check the words and the state as ONE claim. The
 * coverage gate enforces that at RUNTIME (brief decision D6): each helper
 * records the `(test title, marker)` pair it actually executed, and
 * `verdict-coverage.spec.ts` requires every recorded mutation's pair to have
 * been observed. A call that is commented out, or that lives in some other
 * test, satisfies nothing.
 *
 * Nothing in this file reads a marker's value off the page. That is a rule, not
 * a habit: an expectation read from the page under test compares the page to
 * itself, which is how this lab's Fix 1 escape worked, and both
 * `expect-marker.ts` (at runtime) and `verdict-coverage.spec.ts` (over this
 * file's source) now refuse it.
 *
 * The oracles derive their expected totals from the row count the page is
 * actually running (`rowCount(page)`) and from stand-in counters written here.
 * Nothing is a literal that happens to be right at the default, which is what
 * makes the non-default runs below mean anything.
 */

/** The table's department cycle, restated here so the oracle does not import
 *  the module it is judging (cf. fold-gate's `chain-ops` stand-in counter). */
const DEPARTMENT_CYCLE = ['Support', 'Support', 'Support', 'Finance', 'Finance', 'Research', 'Research', 'Sales']

/** The public department histogram, recounted independently of src/data/public.ts. */
function expectedDepartmentHistogram(rows: number): { labels: string[]; counts: number[] } {
  const labels = [...new Set(DEPARTMENT_CYCLE)]
  const counts = new Map(labels.map((label) => [label, 0]))
  for (let index = 0; index < rows; index++) {
    const label = DEPARTMENT_CYCLE[index % DEPARTMENT_CYCLE.length]
    counts.set(label, counts.get(label)! + 1)
  }
  return { labels, counts: labels.map((label) => counts.get(label)!) }
}

/** The sealed plaintexts of the rows the tables actually show. */
const shownDepartments = (rows: number) =>
  Array.from({ length: shownRows(rows) }, (_, index) => DEPARTMENT_CYCLE[index % DEPARTMENT_CYCLE.length])
const shownAges = (rows: number) => Array.from({ length: shownRows(rows) }, (_, index) => 20 + (index % 46))

/** A column with no repeated value has this equality pattern and no other. */
const allDistinct = (count: number) => Array.from({ length: count }, (_, index) => index)

async function selectRows(page: Page, rows: number) {
  await page.locator('#row-count').selectOption(String(rows))
  await expect(page.locator('[data-verdict="run-status"]')).toContainText(`Dataset reshuffled to ${rows} rows`)
}

test('OPE sorting recovers dense age but fails explicitly on sparse salary', async ({ page }) => {
  await page.goto('/')
  const rows = await rowCount(page)
  await page.getByRole('button', { name: 'Age', exact: true }).click()
  await page.getByRole('button', { name: 'Order-preserving (OPE)', exact: true }).click()
  await page.getByRole('button', { name: 'Run recovery' }).click()
  await page.getByRole('button', { name: 'Reveal sealed truth' }).click()
  await expectVerdict(page, 'recovery-score', {
    text: `${rows} MATCHED · 0 MISMATCHED · 0 AMBIGUOUS`,
    result: 'recovered',
    className: 'alarm-text',
  })
  await expect(page.locator('[data-verdict="recovery-score"]')).toHaveAttribute('data-score', `${rows}/${rows}`)

  await page.getByRole('button', { name: 'Salary', exact: true }).click()
  await page.getByRole('button', { name: 'Run recovery' }).click()
  await expectVerdict(page, 'run-status', {
    text: /^RECOVERY REJECTED: Sorting attack incomplete: sparse support has \d+ observed values across \d+ possible integers\.$/,
    result: 'rejected',
    className: 'status neutral',
  })
  await expect(page.getByRole('button', { name: 'Reveal sealed truth' })).toBeDisabled()
})

test('changing auxiliary data retires recovery while a no-op scheme selection does not', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Run recovery' }).click()
  await page.getByRole('button', { name: 'Department', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Reveal sealed truth' })).toBeEnabled()
  await page.getByLabel('Public population').selectOption('shifted')
  await expectVerdict(page, 'run-status', {
    text: 'Auxiliary population changed to shifted. Previous recovery retired.',
    result: 'retired',
    className: 'status neutral',
  })
  await expect(page.getByRole('button', { name: 'Reveal sealed truth' })).toBeDisabled()
})

test('tiny datasets warn, the warning names the sample it judges, and hidden content stays unpainted', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-verdict="sample-warning"]')).toHaveCount(0)

  await selectRows(page, 24)
  await expectVerdict(page, 'sample-warning', {
    text: 'SAMPLE WARNING: 24 rows is fewer than the 30 that make frequency statistics stable. Treat this result as an illustration, not evidence.',
    result: 'unstable',
    className: 'warning',
  })

  // It is a judgement about the sample size, so it has to go away when the
  // sample is big enough -- a banner that always renders asserts nothing.
  await selectRows(page, 240)
  await expect(page.locator('[data-verdict="sample-warning"]')).toHaveCount(0)

  await page.evaluate(() => {
    const probe = document.createElement('div')
    probe.id = 'hidden-probe'
    probe.hidden = true
    document.body.append(probe)
  })
  await expect(page.locator('#hidden-probe')).toBeHidden()
})

test('the randomized control survives a query and a recovery that both really run', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await page.getByRole('button', { name: 'Randomized control' }).click()

  // Run the control at the default row count AND at the largest the UI offers.
  // Every aggregate in its two sentences is derived here from the row count the
  // page is actually running, so no literal in the page can be right at both.
  //
  // Brief Fix 4, this lab's instance: the ORE comparison count was already
  // derived as n(n-1)/2 and already run at two counts, but the control's
  // aggregates had exactly one oracle and it ran at the default only. A page
  // holding the literals `240 of 240` and `240 rows into 240 ... largest 1`
  // rendered "matched 0 of 1000 sealed rows ... and 240 of 240 stored
  // ciphertexts are distinct" -- 1000 and 240 in one sentence -- with all
  // sixteen tests green.
  //
  // `largest 1` is the one figure here that is constant across every row count
  // by construction, and it is not asserted on its own credit: a control whose
  // largest bucket exceeded one would have fewer distinct ciphertexts than
  // rows, which the bucket count in the same sentence forbids. Hard-coding
  // both is what the second row count kills.
  for (const target of [240, 1000]) {
    if (target !== (await rowCount(page))) await selectRows(page, target)
    const rows = await rowCount(page)
    const shown = shownRows(rows)

    // The query is executed against the control column, not skipped. Both
    // numbers are measurements: a fresh encryption of the search value matches
    // nothing, and every stored ciphertext is distinct.
    await page.getByRole('button', { name: 'Try a query' }).click()
    await expectVerdict(page, 'run-status', {
      text: new RegExp(
        `^Equality query for Finance matched 0 of ${rows} sealed rows\\..*${rows} of ${rows} stored ciphertexts are distinct`,
      ),
      result: 'control-held',
      className: 'status neutral',
    })

    // Every ciphertext the panel renders is distinct too, so the leak the DTE
    // column shows in these very cells is absent here.
    await expectEveryClaim(page, 'sealed-cipher', { count: shown, pattern: allDistinct(shown) })

    // The frequency attack is executed against the control column too, and is
    // defeated by bucket sizes rather than by an early return.
    await page.getByRole('button', { name: 'Run recovery' }).click()
    await expectVerdict(page, 'run-status', {
      text: new RegExp(
        `^Frequency matching grouped ${rows} rows into ${rows} ciphertext buckets, largest 1\\. No bucket holds more than one row`,
      ),
      result: 'control-held',
      className: 'status neutral',
    })

    await page.getByRole('button', { name: 'Reveal sealed truth' }).click()
    await expect(page.locator('[data-verdict="recovery-score"]')).toHaveAttribute('data-score', `0/${rows}`)
    await expectVerdict(page, 'recovery-score', {
      text: `NOTHING RECOVERED · ${rows} of ${rows} AMBIGUOUS`,
      result: 'none',
      className: 'control-ok',
    })
    await expectEveryClaim(page, 'attack-guess', { values: Array(shown).fill('ambiguous') })
  }
})

test('authenticated deterministic ciphertexts can still be recovered', async ({ page }) => {
  await page.goto('/')
  const rows = await rowCount(page)
  await expect(page.getByRole('heading', { name: 'Authenticated, never decrypted, and recovered' })).toBeVisible()
  await expectVerdict(page, 'dte-tags', { text: 'TAGS VERIFIED', result: 'pass', className: '' })
  await expect(page.getByText('The query module holds no key')).toBeVisible()
  await page.getByRole('button', { name: 'Run query on ciphertexts' }).click()
  await page.getByRole('button', { name: 'Run recovery' }).click()
  await page.getByRole('button', { name: 'Reveal sealed truth' }).click()
  await expect(page.locator('[data-verdict="recovery-score"]')).not.toHaveAttribute('data-score', `0/${rows}`)
})

test('the sealed column shows the equality leak under DTE and the two panels stay aligned', async ({ page }) => {
  await page.goto('/')
  const rows = await rowCount(page)
  const shown = shownRows(rows)

  // Both tables number the same rows. `row-outcome` compares the guess for row
  // N against the truth of row N, which means nothing unless they line up.
  const ids = Array.from({ length: shown }, (_, index) => String(index + 1))
  await expectEveryClaim(page, 'row-id', { values: [...ids, ...ids] })

  // The equality pattern of the sealed column reproduces the equality pattern
  // of the plaintexts exactly. That IS the leak, and the pattern is derived
  // from this file's own stand-in table, never read off the page.
  //
  // It is asserted INSIDE the helper on purpose. The shape this replaces read
  // the ciphertexts with `claimValues`, handed them straight back to
  // `expectEveryClaim` as their own expectation -- which holds for any page --
  // and left the real oracle on a bare `expect(equalityPattern(...))` beside
  // it, so the recorded kill for `sealed-cipher` never reached the helper at
  // all. Pattern equality also subsumes the distinct-count checks that used to
  // sit on that bare `expect`: fewer distinct ciphertexts than rows, and
  // exactly as many as there are distinct plaintexts, are both read straight
  // off the pattern.
  const plaintexts = shownDepartments(rows)
  await expectEveryClaim(page, 'sealed-cipher', {
    count: shown,
    pattern: equalityPattern(plaintexts),
    excludes: [...new Set(plaintexts)],
  })
})

test("the public histogram is the attacker's auxiliary table and it totals the sealed rows", async ({ page }) => {
  await page.goto('/')
  for (const rows of [240, 24, 500]) {
    if (rows !== (await rowCount(page))) await selectRows(page, rows)
    const expected = expectedDepartmentHistogram(rows)
    await expectEveryClaim(page, 'public-value', { values: expected.labels })
    await expectEveryClaim(page, 'public-count', { values: expected.counts.map(String), sumsTo: rows })
  }
})

test('pairwise MSDB tree and cumulative matching recover salary but shifted statistics degrade it', async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto('/')
  await page.getByRole('button', { name: 'Salary', exact: true }).click()
  await page.getByRole('button', { name: 'Order-revealing (ORE)', exact: true }).click()

  // Run it at the default AND at the largest row count the UI offers. The
  // comparison count is derived here as n(n-1)/2, so neither a page holding a
  // literal nor a spec holding one can agree at both (brief Fix 6).
  for (const rows of [240, 1000]) {
    if (rows !== (await rowCount(page))) await selectRows(page, rows)
    await page.getByRole('button', { name: 'Run recovery' }).click()
    await expectVerdict(page, 'run-status', {
      text: new RegExp(`^Cumulative matching used ${((rows * (rows - 1)) / 2).toLocaleString('en-US')} pairwise CLWW comparisons;`),
      result: 'recovered',
      className: 'status neutral',
    })
    await page.getByRole('button', { name: 'Reveal sealed truth' }).click()
    await expect(page.locator('[data-verdict="recovery-score"]')).toHaveAttribute('data-score', `${rows}/${rows}`)
    await expectVerdict(page, 'recovery-score', {
      text: `${rows} MATCHED · 0 MISMATCHED · 0 AMBIGUOUS`,
      result: 'recovered',
      className: 'alarm-text',
    })
  }

  await selectRows(page, 240)
  await page.getByLabel('Public population').selectOption('shifted')
  await page.getByRole('button', { name: 'Run recovery' }).click()
  await page.getByRole('button', { name: 'Reveal sealed truth' }).click()
  await expect(page.locator('[data-verdict="recovery-score"]')).not.toHaveAttribute('data-score', '240/240')
})

test('mismatched auxiliary support is named and recovery fails closed', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Salary', exact: true }).click()
  await page.getByRole('button', { name: 'Order-revealing (ORE)', exact: true }).click()
  await page.getByLabel('Public population').selectOption('mismatch')
  await page.getByRole('button', { name: 'Run recovery' }).click()
  await expectVerdict(page, 'run-status', {
    text: /^RECOVERY REJECTED: Auxiliary support mismatch: sealed column has \d+ distinct values but public data has \d+\.$/,
    result: 'rejected',
    className: 'status neutral',
  })
  await expect(page.getByRole('button', { name: 'Reveal sealed truth' })).toBeDisabled()
})

test('every column is interactive under DTE, OPE, ORE, and randomized control', async ({ page }) => {
  await page.goto('/')
  const rows = await rowCount(page)
  for (const column of ['Department', 'Age', 'Salary']) {
    await page.getByRole('button', { name: column, exact: true }).click()
    for (const scheme of [
      { name: 'Deterministic (DTE)', status: 'Equality query' },
      { name: 'Order-preserving (OPE)', status: 'Range query' },
      { name: 'Order-revealing (ORE)', status: 'Range query' },
      { name: 'Randomized control', status: `matched 0 of ${rows} sealed rows` },
    ]) {
      const choice = page.getByRole('button', { name: scheme.name, exact: true })
      await choice.click()
      await expect(choice, 'the matrix position was not selected').toHaveAttribute('aria-pressed', 'true')
      await page.getByRole('button', { name: scheme.name === 'Randomized control' ? 'Try a query' : 'Run query on ciphertexts' }).click()
      await expect(page.locator('[data-verdict="run-status"]')).toContainText(scheme.status)
    }
  }
})

test('the live tradeoff explains that the database feature is also the attacker signal', async ({ page }) => {
  await page.goto('/')
  const ledger = page.getByRole('region', { name: 'Department under Deterministic AES-GCM-SIV' })
  await expect(ledger).toContainText('Find rows equal to a search value')
  await expect(ledger).toContainText('Equal values always produce equal ciphertexts')
  await expect(ledger).toContainText('Count repeated ciphertexts')

  await page.getByRole('button', { name: 'Randomized control', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Department under AES-GCM randomized control' })).toContainText('No stable pattern remains for a count or a rank to match')
})

test('per-row verdicts follow the guess against the sealed truth', async ({ page }) => {
  await page.goto('/')
  const rows = await rowCount(page)
  const shown = shownRows(rows)

  // Before any recovery has run there is nothing to judge, and every row says
  // exactly that rather than reporting an outcome.
  await expectEveryVerdict(page, 'row-outcome', { text: 'WAITING', result: 'waiting', className: '', count: shown })
  await expectClaim(page, 'attack-guess', { value: 'pending', text: '—', nth: 0 })

  // Dense age under OPE: every visible row is recovered, says so, and shows the
  // value it recovered -- derived here, not read back off the page.
  await page.getByRole('button', { name: 'Age', exact: true }).click()
  await page.getByRole('button', { name: 'Order-preserving (OPE)', exact: true }).click()
  await page.getByRole('button', { name: 'Run recovery' }).click()
  await page.getByRole('button', { name: 'Reveal sealed truth' }).click()
  await expect(page.locator('[data-verdict="recovery-score"]')).toHaveAttribute('data-score', `${rows}/${rows}`)
  await expectEveryVerdict(page, 'row-outcome', { text: '! RECOVERED', result: 'recovered', className: 'alarm-text', count: shown })
  await expectEveryClaim(page, 'attack-guess', { values: shownAges(rows).map(String) })

  // Randomized control: the same attack runs and every row stays ambiguous.
  await page.getByRole('button', { name: 'Randomized control', exact: true }).click()
  await page.getByRole('button', { name: 'Run recovery' }).click()
  await page.getByRole('button', { name: 'Reveal sealed truth' }).click()
  await expect(page.locator('[data-verdict="recovery-score"]')).toHaveAttribute('data-score', `0/${rows}`)
  await expectEveryVerdict(page, 'row-outcome', { text: '? AMBIGUOUS', result: 'ambiguous', className: 'amber-text', count: shown })
})
