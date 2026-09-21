# Order Leak

## What It Is

Order Leak is a browser-only teaching demo of deterministic AES-GCM-SIV, an exact-hypergeometric BCLO teaching profile, and binary CLWW order-revealing encryption over an 8-bit domain. It demonstrates that ciphertext equality and order are useful database features and also inference signals. It is not production crypto: the domains are deliberately small, and the concrete HMAC-SHA-256 PRF encoding is a documented lab profile rather than a standardized wire format.

## Exhibits

1. The DBA view runs equality, range, and sorting queries on sealed values.
2. The attacker view receives only ciphertext observations and separately generated synthetic public data, then performs frequency matching, sorting, NKW cumulative matching, and pairwise MSDB-tree recovery.
3. Reveal scores every recovered cell against separately held truth. The randomized AES-GCM control is put through the same equality query and the same frequency attack as the leaky schemes, and the page reports what they returned: 0 of 240 rows matched, 240 of 240 ciphertexts distinct, largest bucket 1.
4. The authentication fixture verifies every AES-GCM-SIV tag while showing that authentication does not hide equality leakage.
5. Matching and shifted auxiliary populations show how inference quality depends on public-data fit; a 24-row option warns that tiny samples are unstable.

## When to Use It

Use this to learn why encrypted database query features need an explicit leakage budget. Do not use it to select a database product, encrypt real records, or conclude that authenticated encryption alone prevents inference.

## Live Demo

https://systemslibrarian.github.io/crypto-lab-order-leak/

Choose any of the three columns, switch independently among DTE, OPE, ORE, and randomized AES-GCM, run a ciphertext query, recover it from public statistics, and reveal the cell-by-cell score. Every row stores the full three-column by four-scheme matrix; the controls select a real ciphertext, not a simulated view.

## What Can Go Wrong

Frequency ties are labelled ambiguous rather than guessed. Sorting is complete only for a dense column whose auxiliary distribution matches. Values outside the 8-bit OPE teaching domain are rejected. The randomized AES-GCM control uses a fresh 96-bit nonce for every row. It is not exempted from the attacks: the query and the recovery both run against it, and the verdict is computed from the bucket sizes they measure rather than asserted from the scheme name.

## Real-World Usage

Property-preserving encryption was popularized for encrypted database query systems such as [CryptDB](https://doi.org/10.1145/2043556.2043566). Deterministic encryption leaks equality; OPE and ORE leak ordering. The constructions and attacks are grounded in [RFC 8452](https://www.rfc-editor.org/rfc/rfc8452), [Boldyreva et al.](https://doi.org/10.1007/978-3-642-01001-9_13), [Chenette et al.](https://doi.org/10.1007/978-3-662-52993-5_24), [Naveed et al.](https://doi.org/10.1145/2810103.2813651), [Durak et al.](https://doi.org/10.1145/2976749.2978379), and [Grubbs et al.](https://doi.org/10.1109/SP.2017.44).

## How to Run Locally

```bash
npm install
npm run dev
```

## Related Demos

[Crypto Lab](https://crypto-lab.systemslibrarian.dev/) includes related work on searchable encryption and format-preserving encryption. Those are explicit non-goals here: searchable encryption adds token and access-pattern questions, while format-preserving encryption is deterministic but does not preserve order.

## Build & Verify

```bash
npm test
npm run build
npm run test:a11y
```

The suite has 27 unit tests and 18 production-browser claim, verdict-coverage, and accessibility tests. Two known-answer tests reproduce the RFC 8452 AES-128 and AES-256 empty-plaintext vectors. The suite also checks the live leakage explanation, full sealed matrix and ciphertext-only query API, exhaustively checks all 65,536 CLWW comparisons, full-domain OPE monotonicity, exact hypergeometric support, dense-versus-sparse sorting behavior, grouped cumulative matching, pairwise MSDB tree reconstruction, malformed ciphertext rejection, per-session key material for all three schemes, attack-module isolation, randomized-control uniqueness, score arithmetic, retirement behavior, support-mismatch rejection, edge cases, arithmetic text contrast, non-text contrast, reflow, and WCAG 2.1 A/AA across desktop and mobile states.

## Performance

The main demo uses 240-1,000 rows so each attack remains inspectable in a browser. The 24-row edge case is deliberately below the supported statistical range and displays a warning.

---

*One of the browser demos in the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*

## Rendered verdicts

Every outcome the page renders carries a `data-verdict` marker and every rendered
MEASUREMENT carries a `data-claim` one. Both families are held to the same rule: each
marker has a recorded §4.1c mutation in `e2e/verdict-mutations.ts` naming the edit that
forces it false, the passing baseline from the same run, and the assertion that then
failed.

A marker's words and its state are ONE claim. `e2e/expect-marker.ts` is the only way this
lab asserts one: `expectVerdict` checks the text, the `data-result` and the pass/fail
class in a single call, and `expectClaim` checks a measurement's text and its `data-value`
together. The coverage job requires every recorded mutation to be asserted through those
helpers -- a spec that merely mentions a marker id fails the build. The record carries the
mutation that proves this is load-bearing: moving a per-row verdict's state while leaving
its words alone is caught on `data-result` and the paint, with no text assertion failing
at all.

`npm run test:verdicts` derives coverage by walking the rendered page rather than from
any hand-kept list. It fails if the page renders a marker with no recorded mutation, and
separately if a verdict word, verdict styling, or an unmarked number is rendered outside a
marker -- which is what catches a later contributor pasting in a raw banner, or painting a
figure nothing asserts. A third test proves that second check can fail, by adding exactly
such a banner and exactly such a number.

The denominator for all of that is `driveEveryState`, which visits every option of every
control that changes what renders: the column and scheme segments, the four row counts and
the three public populations. That is not decoration -- the `sample-warning` verdict
renders at exactly one row count, and before this walk existed it sat outside the set both
coverage rules enumerate over, unmarked and unrecorded, with every check green.

The job runs as its own required check and `deploy` needs it, so neither a merge nor a
direct push to main can ship past it.

