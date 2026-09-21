/**
 * The §4.1c mutation record for every rendered verdict in this lab.
 *
 * A verdict is real only when it has been forced false and something went red.
 * This file is that evidence, and `verdict-coverage.spec.ts` fails if the page
 * renders a `data-verdict` marker that does not appear here -- so coverage is
 * derived from the rendered DOM rather than from anybody's enumeration of it.
 *
 * `killedBy` names the assertion that failed. It must be the verdict's OWN
 * assertion: a build error, a blank page, a timeout, or the whole suite going
 * red does not count as a kill.
 */
export type VerdictMutation = {
  /** the `data-verdict` value this covers. */
  marker: string
  /** what the marker shows, and where it is computed. */
  computedBy: string
  /** the edit that forces the verdict false. */
  mutation: string
  /** the unmutated baseline, recorded from the same run. */
  baseline: string
  /** the assertion that failed, verbatim. */
  killedBy: string
}

export const VERDICT_MUTATIONS: VerdictMutation[] = [
  {
    marker: 'run-status',
    computedBy:
      'src/app.ts query()/recover(): every branch interpolates a value measured from the sealed column -- matched rows, distinct ciphertexts, bucket sizes, pairwise CLWW comparisons -- or reports the thrown auxiliary-support error. The randomized-control branch runs the same equality query and the same frequency attack as the leaky schemes instead of returning a literal.',
    mutation:
      'src/ppe/control.ts randomizedEncrypt(): replace `crypto.getRandomValues(new Uint8Array(12))` with `new Uint8Array(12)`, so the randomized control reuses one nonce and becomes deterministic.',
    baseline:
      'PASS in the same run -- `CI=1 npx playwright test e2e/claims.spec.ts --grep \'randomized control survives\'` -> "1 passed (3.4s)".',
    killedBy:
      'claims.spec.ts:51 expect(locator).toContainText("matched 0 of 240 sealed rows") failed. Received: "Equality query for Finance matched 60 of 240 sealed rows ... and 4 of 240 stored ciphertexts are distinct". The page reported the leak instead of asserting safety.',
  },
  {
    marker: 'recovery-score',
    computedBy:
      'src/app.ts render(): compareRecovery() scores the recovered map against the plaintext column; both the wording and data-score branch on scorecard.matched/mismatched/unresolved. It no longer branches on which scheme is selected.',
    mutation:
      'src/attack/sorting.ts sortingRecover(): drop the `.sort((a, b) => a.ciphertext - b.ciphertext)` so ciphertext ranks are no longer aligned to public ranks.',
    baseline:
      'PASS in the same run -- `CI=1 npx playwright test e2e/claims.spec.ts --grep \'OPE sorting recovers\'` -> "1 passed (3.8s)".',
    killedBy:
      'claims.spec.ts:12 expect(counts).toEqual([240, 0, 0]) failed. Received [6, 234, 0] -- the rendered scorecard read "6 MATCHED · 234 MISMATCHED · 0 AMBIGUOUS".',
  },
  {
    marker: 'row-outcome',
    computedBy:
      'src/app.ts render(): per row, compares the attacker guess against the sealed truth once revealed, emitting ! RECOVERED, ! MISMATCH, ? AMBIGUOUS, or WAITING before a recovery has run.',
    mutation:
      "src/app.ts render(): collapse the revealed comparison `guess === actual(row) ? '! RECOVERED' : guess == null ? '? AMBIGUOUS' : '! MISMATCH'` to the literal `'! RECOVERED'`.",
    baseline:
      'PASS in the same run -- `CI=1 npx playwright test e2e/claims.spec.ts --grep \'per-row verdicts\'` -> "1 passed (4.9s)".',
    killedBy:
      'claims.spec.ts:146 expect(await rowVerdicts.allTextContents()).toEqual(Array(18).fill("? AMBIGUOUS")) failed -- 18 rows of the randomized control rendered "! RECOVERED" while recovery-score still read 0/240.',
  },
  {
    marker: 'dte-tags',
    computedBy:
      'src/app.ts render(): sealed.every(row => dteTagVerifies(...)) AES-GCM-SIV-decrypts every department ciphertext and reports TAGS VERIFIED or TAG FAILURE.',
    mutation: 'src/ppe/dte.ts dteTagVerifies(): return false on the success path so no tag verifies.',
    baseline:
      'PASS in the same run -- `CI=1 npx playwright test e2e/claims.spec.ts --grep \'authenticated\'` -> "1 passed (8.4s)".',
    killedBy:
      'claims.spec.ts:68 expect(page.getByText("TAGS VERIFIED")).toBeVisible() failed -- "element(s) not found"; the page rendered TAG FAILURE.',
  },
]

export const COVERED_MARKERS = new Set(VERDICT_MUTATIONS.map((entry) => entry.marker))
