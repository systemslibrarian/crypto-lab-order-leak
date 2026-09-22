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
 * `killedByTest` names the test it failed in, and that is enforced rather than
 * documented. Every entry must be asserted through `expectVerdict` /
 * `expectClaim` (see `expect-marker.ts`), which check a marker's text and its
 * state in ONE call -- and brief decision **D6** makes that a runtime rule:
 * those helpers record the `(test title, marker)` pair they actually EXECUTE,
 * and `verdict-coverage.spec.ts` fails on any record whose pair nobody
 * executed. The scan it replaces matched the helper's name in `claims.spec.ts`
 * source, which a commented-out call satisfies, a call in an unrelated test
 * satisfies, and a call fed the page's own answer satisfies while asserting
 * nothing.
 *
 * `sealed-cipher` is the record that shows why the last of those mattered
 * here. Its kill used to land on a bare `expect(equalityPattern(...))` beside
 * the helper call, while the helper call itself was being handed the
 * ciphertexts it was supposed to judge. The equality pattern is now asserted
 * INSIDE `expectEveryClaim`, so the kill and the helper are one assertion.
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
  /**
   * The TITLE of the test whose assertion failed. This is half of the pair the
   * runtime coverage check looks for: `expect-marker.ts` records
   * `(test title, marker)` for every assertion that actually executes, and a
   * record naming a pair nobody executed fails the build (brief D6). Naming the
   * file was not enough -- the rule it replaces was file-granular, so the
   * killing assertion could be rewritten while an unrelated helper call
   * elsewhere in the file went on satisfying it.
   */
  killedByTest: string
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
    killedByTest: 'the randomized control survives a query and a recovery that both really run',
    baseline:
      'PASS in the same isolated run -- `CI=1 npx playwright test --project=claims --grep \'randomized control survives\'` -> "1 passed (2.0s)". Bundle index-B-RBde4a.js before, index-D8b9JSOX.js after, so the mutation reached the artifact under test.',
    killedBy:
      'Error: [data-verdict="run-status"] text / expect(locator).toHaveText(expected) failed / Expected pattern: /^Equality query for Finance matched 0 of 240 sealed rows\\..*240 of 240 stored ciphertexts are distinct/ / Received string: "Equality query for Finance matched 60 of 240 sealed rows, and only 4 of 240 stored ciphertexts are distinct. This column is NOT behaving as a randomized control: equal values are producing equal ciphertexts." -- and the marker\'s state moved with its words: the resolved element carried data-result="control-broken".',
  },
  {
    kind: 'verdict',
    marker: 'run-status',
    computedBy:
      'src/app.ts query()/recover(), the randomized-control branches: `classes.distinct`, `sealed.length`, `observations.length` and `classes.largest` are all measured from the sealed column at the row count the page is running. This second record exists because measuring them and printing the numbers they happen to produce at the default are observationally identical until the page is run at a second row count (brief Fix 4).',
    mutation:
      "src/app.ts: replace the control branch's interpolated aggregates with the literals 240 rows produces -- `240 of 240 stored ciphertexts are distinct` in query(), and `grouped 240 rows into 240 ciphertext buckets, largest 1` in recover().",
    killedByTest: 'the randomized control survives a query and a recovery that both really run',
    baseline:
      'PASS in the same isolated run -- `CI=1 npx playwright test --project=claims --grep \'randomized control survives\'` -> "1 passed" unmutated. Bundle index-B-RBde4a.js -> index-Bz0ZN69x.js, so the literals reached the artifact under test.',
    killedBy:
      'Error: [data-verdict="run-status"] text / expect(locator).toHaveText(expected) failed / Expected pattern: /^Equality query for Finance matched 0 of 1000 sealed rows\\..*1000 of 1000 stored ciphertexts are distinct/ / Received string: "Equality query for Finance matched 0 of 1000 sealed rows. Re-encrypting the same value produced a ciphertext no stored row equals, and 240 of 240 stored ciphertexts are distinct, so there is no equality or order relation to index on." -- 1000 and 240 in one sentence. PROVEN BY DIFFERENTIAL, same bundle index-Bz0ZN69x.js both ways: with the oracle restricted to the default row count, as it was before this change, the identical mutation exits 0 with "1 passed (1.8s)" and the page ships that sentence.',
  },
  {
    kind: 'verdict',
    marker: 'recovery-score',
    computedBy:
      'src/app.ts render(): compareRecovery() scores the recovered map against the plaintext column; the wording, the `data-result` state, the pass/fail paint and `data-score` all branch on scorecard.matched/mismatched/unresolved in one expression. It does not branch on which scheme is selected.',
    mutation:
      'src/attack/sorting.ts sortingRecover(): drop the `.sort((a, b) => a.ciphertext - b.ciphertext)` so ciphertext ranks are no longer aligned to public ranks.',
    killedByTest: 'OPE sorting recovers dense age but fails explicitly on sparse salary',
    baseline:
      'PASS in the same isolated run -- `CI=1 npx playwright test --project=claims --grep \'OPE sorting recovers\'` -> "1 passed (1.8s)". Bundle index-B-RBde4a.js -> index-CSP3fI60.js.',
    killedBy:
      'Error: [data-verdict="recovery-score"] text / expect(locator).toHaveText(expected) failed / Expected: "240 MATCHED · 0 MISMATCHED · 0 AMBIGUOUS" / Received: "6 MATCHED · 234 MISMATCHED · 0 AMBIGUOUS", on <strong class="alarm-text" data-score="6/240" data-result="recovered" data-verdict="recovery-score">.',
  },
  {
    kind: 'verdict',
    marker: 'row-outcome',
    computedBy:
      'src/app.ts render() rowOutcome(): per row, compares the attacker guess against the sealed truth once revealed, emitting ! RECOVERED, ! MISMATCH, ? AMBIGUOUS, or WAITING before a recovery has run -- each with its `data-result` and its paint chosen in the same branch.',
    mutation:
      'src/app.ts rowOutcome(): replace the whole revealed AMBIGUOUS/MISMATCH return with the literal `{ text: \'! RECOVERED\', result: \'recovered\', className: \'alarm-text\' }`, so every revealed row claims recovery.',
    killedByTest: 'per-row verdicts follow the guess against the sealed truth',
    baseline:
      'PASS in the same isolated run -- `CI=1 npx playwright test --project=claims --grep \'per-row verdicts\'` -> "1 passed (3.1s)". Bundle index-B-RBde4a.js -> index-DphMHaIY.js.',
    killedBy:
      'Error: [data-verdict="row-outcome"] text / expect(received).toEqual(expected) // deep equality / - Expected - 18 -> eighteen "? AMBIGUOUS" / + Received + 18 -> eighteen "! RECOVERED", at expect-marker.ts (expectEveryVerdict). The randomized control\'s rows claimed recovery while recovery-score still read 0/240.',
  },
  {
    kind: 'verdict',
    marker: 'row-outcome',
    computedBy:
      'src/app.ts render() rowOutcome(): the same branch that picks the words also picks `data-result` and the paint. This second record exists to prove the Fix 1 helper is load-bearing rather than decorative.',
    mutation:
      'src/app.ts rowOutcome(): move the revealed AMBIGUOUS branch\'s STATE ONLY -- `{ text: \'? AMBIGUOUS\', result: \'recovered\', className: \'alarm-text\' }` -- leaving the rendered words untouched. This is the exact defect Fix 1 describes: the page goes on saying the right sentence while claiming the opposite in every other way a reader can see.',
    killedByTest: 'per-row verdicts follow the guess against the sealed truth',
    baseline:
      'PASS in the same isolated run -- `CI=1 npx playwright test --project=claims --grep \'per-row verdicts\'` -> "1 passed (6.2s)". Bundle index-B-RBde4a.js -> index-DOpzqSSE.js.',
    killedBy:
      'Error: [data-verdict="row-outcome"] state / expect(received).toEqual(expected) // deep equality / - Expected - 18 -> eighteen "ambiguous" / + Received + 18 -> eighteen "recovered". NOTE: no text assertion failed in this run -- the words still read "? AMBIGUOUS" for all eighteen rows, so the text-only oracle this harness used before Fix 1 would have recorded the page as correct.',
  },
  {
    kind: 'verdict',
    marker: 'dte-tags',
    computedBy:
      'src/app.ts render(): sealed.every(row => dteTagVerifies(...)) AES-GCM-SIV-decrypts every department ciphertext and reports TAGS VERIFIED / pass or TAG FAILURE / fail.',
    mutation: 'src/ppe/dte.ts dteTagVerifies(): return false on the success path so no tag verifies.',
    killedByTest: 'authenticated deterministic ciphertexts can still be recovered',
    baseline:
      'PASS in the same isolated run -- `CI=1 npx playwright test --project=claims --grep \'authenticated deterministic\'` -> "1 passed (4.5s)". Bundle index-B-RBde4a.js -> index-CwBbQ5G_.js.',
    killedBy:
      'Error: [data-verdict="dte-tags"] text / expect(locator).toHaveText(expected) failed / Expected: "TAGS VERIFIED" / Received: "TAG FAILURE", on <strong data-result="fail" data-verdict="dte-tags">TAG FAILURE</strong>.',
  },
  {
    kind: 'verdict',
    marker: 'sample-warning',
    computedBy:
      'src/app.ts render(): rendered only while `rows.length < 30`, and it names the row count it is judging. Found by brief Fix 6 -- it renders at exactly one option of the row-count select, which `driveEveryState` never visited, so it sat outside the denominator both coverage rules enumerate over.',
    mutation:
      'src/app.ts render(): change the guard `rows.length < 30` to `rows.length < 0`, so a 24-row sample is never flagged as unstable.',
    killedByTest: 'tiny datasets warn, the warning names the sample it judges, and hidden content stays unpainted',
    baseline:
      'PASS in the same isolated run -- `CI=1 npx playwright test --project=claims --grep \'tiny datasets warn\'` -> "1 passed (3.5s)". Bundle index-B-RBde4a.js -> index-C8ubSA_r.js.',
    killedBy:
      'Error: [data-verdict="sample-warning"] text / expect(locator).toHaveText(expected) failed / Expected: "SAMPLE WARNING: 24 rows is fewer than the 30 that make frequency statistics stable. Treat this result as an illustration, not evidence." / Error: element(s) not found -- a 24-row sample rendered no warning at all.',
  },
  {
    kind: 'claim',
    marker: 'public-value',
    computedBy:
      'src/app.ts render(): the auxiliary histogram\'s bar labels, keyed from publicValues() -- the attacker\'s public table, not the sealed column.',
    mutation: 'src/app.ts render() publicBars: render the bar index instead of the value name, in both the text and `data-value`.',
    killedByTest: 'the public histogram is the attacker\'s auxiliary table and it totals the sealed rows',
    baseline:
      'PASS in the same isolated run -- `CI=1 npx playwright test --project=claims --grep \'public histogram\'` -> "1 passed (3.0s)". Bundle index-B-RBde4a.js -> index-CkBEJS1U.js.',
    killedBy:
      'Error: [data-claim="public-value"] values / expect(received).toEqual(expected) // deep equality / - Expected: ["Support", "Finance", "Research", "Sales"] / + Received: ["0", "1", "2", "3"]. This is the exact page the Fix 1 escape shipped green: with the helper fed `values: await claimValues(page, \'public-value\')` the same mutation passed at 16 passed, which is why the tautology is now refused and the assertion is recorded at runtime.',
  },
  {
    kind: 'claim',
    marker: 'public-count',
    computedBy:
      'src/app.ts render(): how many rows of the public population hold each value. This is the count the frequency attack aligns ciphertext bucket sizes against, so it is the attack premise made visible.',
    mutation:
      'src/app.ts render() publicBars: render `count + 1` in both the text and `data-value`, so the auxiliary table no longer totals the sealed rows.',
    killedByTest: 'the public histogram is the attacker\'s auxiliary table and it totals the sealed rows',
    baseline:
      'PASS in the same isolated run -- `CI=1 npx playwright test --project=claims --grep \'public histogram\'` -> "1 passed (3.1s)". Bundle index-B-RBde4a.js -> index-DzlUNCes.js.',
    killedBy:
      'Error: [data-claim="public-count"] values / expect(received).toEqual(expected) // deep equality / - Expected: ["90", "60", "60", "30"] / + Received: ["91", "61", "61", "31"] -- the auxiliary table stopped totalling the 240 sealed rows, which `expectEveryClaim`\'s `sumsTo` also asserts in the same call.',
  },
  {
    kind: 'claim',
    marker: 'row-id',
    computedBy:
      'src/app.ts render(): the row identifier in BOTH tables. The per-row verdict rests on it -- `row-outcome` compares the attacker guess for row N against the sealed truth of row N, which is only meaningful if the two panels render the same N.',
    mutation:
      'src/app.ts render(): render the sealed table\'s id cell as the literal `1` for every row, so the two panels no longer line up.',
    killedByTest: 'the sealed column shows the equality leak under DTE and the two panels stay aligned',
    baseline:
      'PASS in the same isolated run -- `CI=1 npx playwright test --project=claims --grep \'sealed column shows the equality leak\'` -> "1 passed (2.9s)". Bundle index-B-RBde4a.js -> index-BRS5RzNN.js.',
    killedBy:
      'Error: [data-claim="row-id"] values / expect(received).toEqual(expected) // deep equality / - Expected - 17 / + Received + 17 -- the sealed table\'s "1".."18" became eighteen "1"s, while the attacker table still read "1".."18", so the two panels no longer numbered the same rows.',
  },
  {
    kind: 'claim',
    marker: 'sealed-cipher',
    computedBy:
      'src/app.ts ciphertextFor(): the stored ciphertext for the selected column and scheme. Under DTE, equal plaintexts must produce equal ciphertexts -- that IS the leak this lab exists to show -- and under the randomized control every one must differ.',
    mutation:
      'src/app.ts render(): render `row.id` instead of `ciphertextFor(row.id)` in the sealed table\'s value cell, so the sealed column shows 18 distinct values and the equality pattern disappears.',
    killedByTest: 'the sealed column shows the equality leak under DTE and the two panels stay aligned',
    baseline:
      'PASS in the same isolated run -- `CI=1 npx playwright test --project=claims --grep \'sealed column shows the equality leak\'` -> "1 passed (1.8s)". Bundle index-B-RBde4a.js -> index-D4yeKXnv.js.',
    killedBy:
      'Error: [data-claim="sealed-cipher"] equality pattern / expect(received).toEqual(expected) // deep equality / - Expected - 14 -> the plaintext equality pattern [0,0,0,1,1,2,2,3,0,0,0,1,1,2,2,3,0,0] / + Received + 14 -> [0,1,2,...,17], eighteen distinct values. The DTE column stopped showing the equality leak the lab exists to show. This kill lands INSIDE expectEveryClaim: until D6 it landed on a bare `expect(equalityPattern(...))` beside a helper call that had been handed the ciphertexts it was meant to judge.',
  },
  {
    kind: 'claim',
    marker: 'attack-guess',
    computedBy:
      'src/app.ts render(): the value the attack recovered for each row, straight from the `recovered` map, with `pending` / `ambiguous` for the states that carry no value.',
    mutation:
      'src/app.ts render(): render `actual(row)` instead of the recovered guess, so the attacker panel shows sealed truth it has not recovered.',
    killedByTest: 'per-row verdicts follow the guess against the sealed truth',
    baseline:
      'PASS in the same isolated run -- `CI=1 npx playwright test --project=claims --grep \'per-row verdicts\'` -> "1 passed (5.4s)". Bundle index-B-RBde4a.js -> index-BhV7ScXV.js.',
    killedBy:
      'Error: [data-claim="attack-guess"] #0 value / expect(locator).toHaveAttribute(expected) failed / Expected: "pending" / Received: "Support", on <td data-value="Support" data-claim="attack-guess">Support</td> -- the attacker panel showed sealed truth before any recovery had run.',
  },
]

export const COVERED_VERDICTS = new Set(MARKER_MUTATIONS.filter((entry) => entry.kind === 'verdict').map((entry) => entry.marker))
export const COVERED_CLAIMS = new Set(MARKER_MUTATIONS.filter((entry) => entry.kind === 'claim').map((entry) => entry.marker))
