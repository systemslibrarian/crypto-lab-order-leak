/**
 * The §4.1c mutation record for every rendered marker in this lab.
 *
 * A verdict is real only when it has been forced false and something went red.
 * A rendered MEASUREMENT is no different, and it is the easier one to leave
 * unchecked, because a number does not look like a claim. This file is the
 * evidence for both families, and `verdict-coverage.spec.ts` fails if the page
 * renders a `data-verdict` or `data-claim` marker that does not appear here --
 * so coverage is derived from the rendered DOM rather than from anybody's
 * enumeration of it.
 *
 * `killedBy` names the assertion that failed. It must be the marker's OWN
 * assertion: a build error, a blank page, a timeout, or the whole suite going
 * red does not count as a kill.
 *
 * Every entry is also required to be asserted through `expectVerdict` /
 * `expectClaim` (see `expect-marker.ts`), which check a marker's text and its
 * state in ONE call. A text-only kill fails the build rather than being filed
 * here as evidence.
 */
export type MarkerMutation = {
  /** `verdict` for a `data-verdict` outcome, `claim` for a `data-claim` measurement. */
  kind: 'verdict' | 'claim'
  /** the marker value this covers. */
  marker: string
  /** what the marker shows, and where it is computed. */
  computedBy: string
  /** the edit that forces the marker false. */
  mutation: string
  /** the unmutated baseline, recorded from the same run. */
  baseline: string
  /** the assertion that failed, verbatim. */
  killedBy: string
}

export const MARKER_MUTATIONS: MarkerMutation[] = [
  {
    kind: 'verdict',
    marker: 'run-status',
    computedBy:
      'src/app.ts query()/recover(): every branch interpolates a value measured from the sealed column -- matched rows, distinct ciphertexts, bucket sizes, pairwise CLWW comparisons -- or reports the thrown auxiliary-support error, and picks its `result` state in the same expression. The randomized-control branch runs the same equality query and the same frequency attack as the leaky schemes instead of returning a literal.',
    mutation:
      'src/ppe/control.ts randomizedEncrypt(): replace `crypto.getRandomValues(new Uint8Array(12))` with `new Uint8Array(12)`, so the randomized control reuses one nonce and becomes deterministic.',
    baseline:
      'PASS in the same session -- `CI=1 npx playwright test e2e/claims.spec.ts --grep \'randomized control survives\'` -> "1 passed (1.5s)".',
    killedBy:
      'Error: [data-verdict="run-status"] text / expect(locator).toHaveText(expected) failed / Expected pattern: /^Equality query for Finance matched 0 of 240 sealed rows\\..*240 of 240 stored ciphertexts are distinct/ / Received string: "Equality query for Finance matched 60 of 240 sealed rows, and only 4 of 240 stored ciphertexts are distinct. This column is NOT behaving as a randomized control: equal values are producing equal ciphertexts." -- and the marker\'s state moved with its words: the resolved element carried data-result="control-broken".',
  },
  {
    kind: 'verdict',
    marker: 'recovery-score',
    computedBy:
      'src/app.ts render(): compareRecovery() scores the recovered map against the plaintext column; the wording, the `data-result` state, the pass/fail paint and `data-score` all branch on scorecard.matched/mismatched/unresolved in one expression. It does not branch on which scheme is selected.',
    mutation:
      'src/attack/sorting.ts sortingRecover(): drop the `.sort((a, b) => a.ciphertext - b.ciphertext)` so ciphertext ranks are no longer aligned to public ranks.',
    baseline:
      'PASS in the same session -- `CI=1 npx playwright test e2e/claims.spec.ts --grep \'OPE sorting recovers\'` -> "1 passed (1.5s)".',
    killedBy:
      'Error: [data-verdict="recovery-score"] text / expect(locator).toHaveText(expected) failed / Expected: "240 MATCHED · 0 MISMATCHED · 0 AMBIGUOUS" / Received: "6 MATCHED · 234 MISMATCHED · 0 AMBIGUOUS", on <strong class="alarm-text" data-score="6/240" data-result="recovered" data-verdict="recovery-score">.',
  },
  {
    kind: 'verdict',
    marker: 'row-outcome',
    computedBy:
      'src/app.ts render() rowOutcome(): per row, compares the attacker guess against the sealed truth once revealed, emitting ! RECOVERED, ! MISMATCH, ? AMBIGUOUS, or WAITING before a recovery has run -- each with its `data-result` and its paint chosen in the same branch.',
    mutation:
      "src/app.ts rowOutcome(): return the literal `{ text: '! RECOVERED', result: 'recovered', className: 'alarm-text' }` from the revealed comparison, so every revealed row claims recovery.",
    baseline:
      'PASS in the same session -- `CI=1 npx playwright test e2e/claims.spec.ts --grep \'per-row verdicts\'` -> "1 passed (2.9s)".',
    killedBy:
      'Error: [data-verdict="row-outcome"] text / expect(received).toEqual(expected) // deep equality / - Expected - 18 -> eighteen "? AMBIGUOUS" / + Received + 18 -> eighteen "! RECOVERED", at expect-marker.ts:71 (expectEveryVerdict). The randomized control\'s rows claimed recovery while recovery-score still read 0/240.',
  },
  {
    kind: 'verdict',
    marker: 'row-outcome',
    computedBy:
      'src/app.ts render() rowOutcome(): the same branch that picks the words also picks `data-result` and the paint. This second record exists to prove the Fix 1 helper is load-bearing rather than decorative.',
    mutation:
      "src/app.ts rowOutcome(): move the revealed AMBIGUOUS branch's STATE ONLY -- `{ text: '? AMBIGUOUS', result: 'recovered', className: 'alarm-text' }` -- leaving the rendered words untouched. This is the exact defect Fix 1 describes: the page goes on saying the right sentence while claiming the opposite in every other way a reader can see.",
    baseline:
      'PASS in the same session -- `CI=1 npx playwright test e2e/claims.spec.ts --grep \'per-row verdicts\'` -> "1 passed (8.6s)".',
    killedBy:
      'Error: [data-verdict="row-outcome"] state / expect(received).toEqual(expected) // deep equality / - Expected: eighteen "ambiguous" / + Received: eighteen "recovered", at expect-marker.ts:75. NOTE: no text assertion failed in this run -- the words still read "? AMBIGUOUS" for all eighteen rows, so the text-only oracle this harness used before Fix 1 would have recorded the page as correct.',
  },
  {
    kind: 'verdict',
    marker: 'dte-tags',
    computedBy:
      'src/app.ts render(): sealed.every(row => dteTagVerifies(...)) AES-GCM-SIV-decrypts every department ciphertext and reports TAGS VERIFIED / pass or TAG FAILURE / fail.',
    mutation: 'src/ppe/dte.ts dteTagVerifies(): return false on the success path so no tag verifies.',
    baseline:
      'PASS in the same session -- `CI=1 npx playwright test e2e/claims.spec.ts --grep \'authenticated deterministic\'` -> "1 passed (3.0s)".',
    killedBy:
      'Error: [data-verdict="dte-tags"] text / expect(locator).toHaveText(expected) failed / Expected: "TAGS VERIFIED" / Received: "TAG FAILURE", on <strong data-result="fail" data-verdict="dte-tags">TAG FAILURE</strong>.',
  },
  {
    kind: 'verdict',
    marker: 'sample-warning',
    computedBy:
      'src/app.ts render(): rendered only while `rows.length < 30`, and it names the row count it is judging. Found by brief Fix 6 -- it renders at exactly one option of the row-count select, which `driveEveryState` never visited, so it sat outside the denominator both coverage rules enumerate over.',
    mutation: 'src/app.ts render(): change the guard `rows.length < 30` to `rows.length < 0`, so a 24-row sample is never flagged as unstable.',
    baseline:
      'PASS in the same session -- `CI=1 npx playwright test e2e/claims.spec.ts --grep \'tiny datasets warn\'` -> "1 passed (4.1s)".',
    killedBy:
      'Error: [data-verdict="sample-warning"] text / expect(locator).toHaveText(expected) failed / Expected: "SAMPLE WARNING: 24 rows is fewer than the 30 that make frequency statistics stable. Treat this result as an illustration, not evidence." / Error: element(s) not found -- a 24-row sample rendered no warning at all.',
  },
  {
    kind: 'claim',
    marker: 'public-value',
    computedBy:
      "src/app.ts render(): the auxiliary histogram's bar labels, keyed from publicValues() -- the attacker's public table, not the sealed column.",
    mutation: 'src/app.ts render() publicBars: render the bar index instead of the value name.',
    baseline:
      'PASS in the same session -- `CI=1 npx playwright test e2e/claims.spec.ts --grep \'public histogram\'` -> "1 passed (5.2s)".',
    killedBy:
      'Error: [data-claim="public-value"] values / expect(received).toEqual(expected) // deep equality / - Expected: ["Support", "Finance", "Research", "Sales"] / + Received: ["0", "1", "2", "3"].',
  },
  {
    kind: 'claim',
    marker: 'public-count',
    computedBy:
      'src/app.ts render(): how many rows of the public population hold each value. This is the count the frequency attack aligns ciphertext bucket sizes against, so it is the attack premise made visible.',
    mutation: 'src/app.ts render() publicBars: render `count + 1` in both the text and `data-value`, so the auxiliary table no longer totals the sealed rows.',
    baseline:
      'PASS in the same session -- `CI=1 npx playwright test e2e/claims.spec.ts --grep \'public histogram\'` -> "1 passed (5.7s)".',
    killedBy:
      'Error: [data-claim="public-count"] values / expect(received).toEqual(expected) // deep equality / - Expected: ["90", "60", "60", "30"] / + Received: ["91", "61", "61", "31"] -- the auxiliary table stopped totalling the 240 sealed rows.',
  },
  {
    kind: 'claim',
    marker: 'row-id',
    computedBy:
      'src/app.ts render(): the row identifier in BOTH tables. The per-row verdict rests on it -- `row-outcome` compares the attacker guess for row N against the sealed truth of row N, which is only meaningful if the two panels render the same N.',
    mutation: "src/app.ts render(): render the sealed table's id cell as the literal `1` for every row, so the two panels no longer line up.",
    baseline:
      'PASS in the same session -- `CI=1 npx playwright test e2e/claims.spec.ts --grep \'sealed column shows the equality leak\'` -> "1 passed (3.2s)".',
    killedBy:
      'Error: [data-claim="row-id"] values / expect(received).toEqual(expected) // deep equality / - Expected - 17 / + Received + 17 -- the sealed table\'s "1".."18" became eighteen "1"s, while the attacker table still read "1".."18", so the two panels no longer numbered the same rows.',
  },
  {
    kind: 'claim',
    marker: 'sealed-cipher',
    computedBy:
      'src/app.ts ciphertextFor(): the stored ciphertext for the selected column and scheme. Under DTE, equal plaintexts must produce equal ciphertexts -- that IS the leak this lab exists to show -- and under the randomized control every one must differ.',
    mutation: 'src/app.ts render(): render `row.id` instead of `ciphertextFor(row.id)` in the sealed table\'s value cell, so the sealed column shows 18 distinct values and the equality pattern disappears.',
    baseline:
      'PASS in the same session -- `CI=1 npx playwright test e2e/claims.spec.ts --grep \'sealed column shows the equality leak\'` -> "1 passed (2.8s)".',
    killedBy:
      'claims.spec.ts:191 expect(equalityPattern(ciphers)).toEqual(equalityPattern(shownDepartments(rows))) / expect(received).toEqual(expected) // deep equality / - Expected - 14 -> the plaintext equality pattern [0,0,0,1,1,2,2,3,...] / + Received + 14 -> [0,1,2,...,17], eighteen distinct values. The DTE column stopped showing the equality leak the lab exists to show.',
  },
  {
    kind: 'claim',
    marker: 'attack-guess',
    computedBy:
      'src/app.ts render(): the value the attack recovered for each row, straight from the `recovered` map, with `pending` / `ambiguous` for the states that carry no value.',
    mutation: 'src/app.ts render(): render `actual(row)` instead of the recovered guess, so the attacker panel shows sealed truth it has not recovered.',
    baseline:
      'PASS in the same session -- `CI=1 npx playwright test e2e/claims.spec.ts --grep \'per-row verdicts\'` -> "1 passed (2.1s)".',
    killedBy:
      'Error: [data-claim="attack-guess"] #0 value / expect(locator).toHaveAttribute(expected) failed / Expected: "pending" / Received: "Support", on <td data-value="Support" data-claim="attack-guess">Support</td> -- the attacker panel showed sealed truth before any recovery had run.',
  },
]

export const COVERED_VERDICTS = new Set(MARKER_MUTATIONS.filter((entry) => entry.kind === 'verdict').map((entry) => entry.marker))
export const COVERED_CLAIMS = new Set(MARKER_MUTATIONS.filter((entry) => entry.kind === 'claim').map((entry) => entry.marker))
