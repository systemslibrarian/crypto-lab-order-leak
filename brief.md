# Order Leak — build brief for `crypto-lab-order-leak`

Save this file as `brief.md` at the root of `crypto-lab-order-leak`. The binding spec is the copy of `_MASTER-TEMPLATE.md` in this repo (status 2026-08-02); this brief supplies only the demo-specific facts. Where the two touch, the template wins; where the template and the catalog `CLAUDE.md` touch, `CLAUDE.md` wins. If `audits/kickoff.md` is also present in this repo, it may be used instead of the prompt below — it reads `./brief.md` itself.

## Kickoff prompt — paste this, with the template in the repo

```text
Build a new Crypto Lab browser demo (Vite + TypeScript, static site, no backend).

Read _MASTER-TEMPLATE.md (copied into this repo — check audits/ and the repo root) in
full and treat it as the BINDING spec. Build to every standard in it, in this order:

  1. §1 Build — real crypto only (WebCrypto or a named, justified library; hand-roll
     the inspectable teaching parts; NEVER simulate or fake math). Runnable tests that
     actually pass, including spec KATs (state the count). Mount content at id="app";
     define --accent on :root.
  2. §3 Look — add the standard top bar (copy the header from any existing lab and
     adapt it) and the standardized hero (short-name <h1> + spec subtitle + "Why it
     matters" box beside it; title size capped at clamp(1.6rem,3.8vw,2.7rem)); theme
     contract; scripture footer; head/favicon. Do NOT invent a new header design and do
     NOT add a theme toggle — match the fleet's cl-topbar.
  3. §2 Teach — SHOW the one headline mechanism (animate/step it, never assert it in
     prose or raw hex); add a plain-language "what is this / why it matters" intro and a
     break-it-yourself interaction against the real crypto; no decorative/idle animation;
     pitch to a college newcomer while rewarding an expert (progressive disclosure).
  4. §4 Accessibility — wire the WCAG 2.1 AA gate and author to its checklist.
     `npm run build` then `npm run test:a11y` MUST pass with zero violations.
  5. §5 README (the standard sections) and §6 Deploy (Actions-based Pages, a11y-gated).
  6. §6.1 + §6.2 Dependency automation — REQUIRED, not optional. Ship
     .github/dependabot.yml with the grouped config, add the dependabot-auto-merge job
     to whichever workflow runs the gate on pull_request, and have that job dispatch the
     deploy after it merges. Also: the workflow must trigger on pull_request as well as
     push, the deploy job must be gated to `github.event_name != 'pull_request'`, the concurrency
     group must include ${{ github.ref }}, and the deploy workflow must accept
     workflow_dispatch. Omitting any of these is how a lab starts opening one pull request
     per dependency with no CI signal on any of them.

Hard rules: do NOT dumb down the crypto to make a visual simpler; honest scoping in-page
and in the README ("not production", what's real vs simulated, what it does NOT prove).
Do NOT weaken a gate to get a green run — no skipped tests, no lowered coverage threshold,
no disabled lint rule, no re-recorded a11y baseline, no continue-on-error. If a bump or a
change cannot pass honestly, leave it failing and say so.
When done, report a one-line summary with the test count, and confirm all four of
grouping / auto-merge / PR gate / workflow_dispatch are present.

The rest of ./brief.md — the §1 sections, hero copy, claims suite, negative claim,
pre-build verification and citations below the DEMO BRIEF — is part of this brief.
Read it in full before building; run its pre-build checks first and report them.

DEMO BRIEF:
NEW DEMO BRIEF
- Repo name:         crypto-lab-order-leak
- Short name (H1):   Order Leak
- Subtitle:          Property-preserving encryption · deterministic · OPE · ORE
- One-liner:         Encrypts a database column three ways that keep it queryable — deterministic AES-GCM-SIV, Boldyreva–Chenette–Lee–O'Neill order-preserving encryption and Chenette–Lewi–Weis–Wu order-revealing encryption — then runs the published inference attacks that read the column back from ciphertexts and public statistics with no key.
- Concept to teach:  A database that can answer WHERE x = ? or ORDER BY x on ciphertexts has already published the answer's shape. Equality and order, plus a public distribution, recover the column; the key is never touched.
- Primitives/spec:   AES-GCM-SIV (RFC 8452) with a fixed nonce as the deterministic AEAD; BCLO OPE (EUROCRYPT 2009) hand-rolled with an exact hypergeometric sampler over a toy domain (8-bit plaintext → 16-bit ciphertext, state the sizes); CLWW ORE (FSE 2016) hand-rolled with HMAC-SHA-256 as the PRF; attacks from Naveed–Kamara–Wright CCS 2015 (frequency analysis, sorting attack, cumulative attack) and the most-significant-differing-bit leakage attacks of Durak–DuBuisson–Cash CCS 2016 / Grubbs et al. IEEE S&P 2017 (tree recovery from pairwise MSDB). Auxiliary data: bundled public-domain frequency tables with source and licence stated in data/README, or a labelled synthetic distribution if none fits.
- Accent (--accent): #A06CD5
- Favicon emoji:     📊
- In scope:          A table of 200–2,000 rows with three columns of different shape: a low-cardinality categorical (department), a dense bounded numeric (age), a sparse numeric (salary or postcode). Each column encrypted under each scheme. A DBA panel where equality, range and sort queries run on ciphertexts and succeed. An attacker panel that sees only ciphertexts and the public distribution, with "Recover" running: frequency analysis (sorted-frequency matching, with optional l_p-optimization via the Hungarian method) against DTE; the sorting attack against OPE on the dense column and the cumulative attack on the sparse one; MSDB tree recovery against ORE. Compute-both-sides: recovered column versus sealed truth, cell by cell, with a match rate. A randomized control column (AES-GCM, random nonce) on which queries are impossible and recovery is zero.
- Non-goals:         Searchable symmetric encryption (cross-link Search Vault); format-preserving encryption (cross-link Format Ward — deterministic, same leakage class); mutable / stateful OPE; ideal-leakage ORE (Lewi–Wu left/right); evaluating any vendor product; emulating a database engine beyond those three query types.
```

## Rules this brief follows — keep them while building

This brief asserts no counts about the catalog. Every "the catalog has / lacks X" sentence is written as a grep to run, because the author could not run it. Run each pre-build check and report the result before writing code. If a grep shows the headline mechanism is already taught by a live card, stop and report; do not build a duplicate.

In addition to this lab's own sections below:

1. Port: `grep -rhoE "localhost:[0-9]+" ../crypto-lab-*/playwright.config.ts | sort -u`, pick an unused port in 4600–4700, commit it (template §4.1). Never the Vite default 4173.
2. Accessibility gate: copy `e2e/gate.ts`, `contrast.ts`, `nontext.ts`, `nontext-baseline.ts`, `a11y.spec.ts` from `crypto-lab-schnorr-forge` and rewrite every lab-specific passage (§4.1). Do not copy the gate from any other lab.
3. Claims suite in `e2e/claims.spec.ts` (§4.1b), mutation discipline (§4.1c), and the negative claim with its evidence fixture (§4.1d). The twin-verdict wording in this brief is a shape, not a string to hard-code.
4. README per §5; deploy per §6 with `.github/dependabot.yml`, the auto-merge job, the deploy dispatch, `timeout-minutes` on the job, `LICENSE`, `.gitignore`.
5. After the lab is live: the catalog card, then the five checkers run from the catalog repo (`readme-sync`, `corpus-sync`, `concept-sync`, `theme-sync`, `fleet-sync`). That step is done in `crypto-lab/`, not here; do not edit shared catalog files from this repo.
6. Category placement below is a proposal. Check the live chip list and section list before adding a chip; if a proposed chip does not exist, report the resulting chip-bar split rather than creating it silently. If the catalog keeps a concept-coverage document, the new concept boundary is added there in the same commit as the card.
7. Each non-goal in the SCOPE list gets its one-line "what this isn't" note in the UI (§1).
8. No emoji anywhere in content; the favicon data-URI is the only sanctioned use.
9. Every hard citation below was checked against its primary source on 2026-09-10 except where marked "verify" — resolve those before the README cites them. Do not cite anything the README cannot link.

**Accent.** This lab's `--accent` is ``#A06CD5``, assigned centrally for the seven-lab batch of 2026-09-10. The other six batch accents are reserved — do not use them:

| Lab | Repo | `--accent` |
|---|---|---|
| Hidden Bit | crypto-lab-hidden-bit | ``#E4572E`` |
| Privacy Pass | crypto-lab-privacy-pass | ``#F2C14E`` |
| Split Point | crypto-lab-split-point | ``#4CC9F0`` |
| Proof Tally | crypto-lab-proof-tally | ``#7BE495`` |
| PQXDH Wire | crypto-lab-pqxdh-wire | ``#FF7EB6`` |
| Fold Gate | crypto-lab-fold-gate | ``#5E7CE2`` |

If `theme-sync` reports an adjacent-card collision after the card is placed, change this lab's accent, never the neighbour's, and record the change in the batch document.

## Hero

- Title: `Order Leak`
- Subtitle: `Property-preserving encryption · OPE · ORE`
- Description: Sort an encrypted column, run WHERE on it, then hand the same ciphertexts to an attacker with a census table and watch the column come back cell by cell without the key.
- Why it matters: "The database is encrypted" is sold as if it ended the conversation. The schemes that keep a column sortable are exactly the ones that make it recoverable, and this failure has shipped in products more than once.

## §1 sections

**SCOPE** — as in the brief.

**SECURITY / CORRECTNESS INVARIANTS**
1. Every ciphertext is real: DTE tags verify (RFC 8452 vectors pass; state count); OPE is a genuine order-preserving injection (test: monotone over the full toy domain); ORE compares correctly on random pairs (test).
2. The attacker module imports neither key nor plaintext; module boundary plus a test on its inputs. Scoring against truth happens only in `src/score/`.
3. BCLO uses an exact hypergeometric sampler for the toy domain sizes, seeded by HMAC as in the paper's lazy sampling; the method is named on the page.
4. The property-preserving schemes are the subject, not a "vulnerable mode": label them "leaky by design (property-preserving)"; the AES-GCM column is the labelled control.
5. Fail-closed: plaintext outside the OPE domain is rejected; an auxiliary table whose support does not match the column is rejected with the mismatch named.

**ARCHITECTURE** — `src/ppe/{dte,ope-bclo,ore-clww}.ts`, `src/db/{table,query}.ts`, `src/attack/{frequency,sorting,cumulative,msdb}.ts`, `src/score/compare.ts`, `src/ui/`.

**UI** — Central metaphor: the same table twice. Left, the DBA's view: ciphertexts with query buttons that still work. Right, the attacker's view: the same ciphertexts beside a histogram of the public distribution and a "Recover" button. Recovered cells fill in; "Reveal" unseals the truth and marks each cell matched, mismatched or unresolved. Steps: pick scheme → run a query (works) → Recover → Reveal → match rate. Toggle the randomized control.

**VISUAL SEMANTICS** — A correctly recovered cell is ALARM (red, icon, "RECOVERED"), never green. A query succeeding on ciphertext is neutral. The control column's query panel is neutral "cannot sort ciphertexts" and its recovery is the only green on the page: "NOTHING RECOVERED". Ties render as unresolved (amber, icon, "AMBIGUOUS"). Icon + text + colour; verify in grayscale.

**EDGE CASES** — dense versus sparse (the sorting attack is only complete on a dense column; the page must say so and show it failing on the sparse one); frequency ties (unresolved, not guessed); OPE domain edges; auxiliary table drawn from a different population (recovery degrades — show the degradation rather than hide it); tiny tables (< 30 rows: warn that the statistics are meaningless).

**EXTENSION SEAMS** — mutable OPE; Lewi–Wu ORE with left/right ciphertexts; a bridge to Search Vault's access-pattern leakage.

## Claims suite and negative claim

`e2e/claims.spec.ts`: parse recovered and true columns and recompute the match rate; assert matched + mismatched + unresolved = rows; parse a sample of (plaintext, OPE ciphertext) pairs from the OPE panel and assert order is preserved; assert the dense-column sorting attack reports 100% when the page labels the column dense; assert the control column reports zero; retirement when the table is reshuffled; no-op guard; `[hidden]` probe.

**Negative claim (§4.1d):** "Every ciphertext in this column is authenticated and the server never holds the key — and the attacker still recovers the column. Confidentiality here covers the value, not the equality and order the scheme was built to expose." **Fixture:** DTE column; every tag verifies (green), the server-side panel shows no key, equality and sort queries succeed, the frequency attack recovers the column above the page's stated threshold → "AUTHENTICATED, NEVER DECRYPTED — AND RECOVERED". Delete the text, or break a tag inside the fixture, and the test fails.

## Pre-build verification

- Grep card copy for `order-preserving`, `OPE`, `ORE`, `deterministic encryption`, `frequency analysis`. Dead Sea Cipher and Vigenère Break do classical frequency analysis: the intro should say this is the same attack on a modern cipher, and link them.
- Nonce Guard implements AES-GCM-SIV: reuse the construction and the RFC 8452 vectors, not the code path. Confirm which library provides GCM-SIV if not hand-rolling.
- For the real-world section, cite only vendor documentation that itself warns that deterministic encryption leaks equality; verify each such page exists before citing. Popa–Redfield–Zeldovich–Balakrishnan, "CryptDB", SOSP 2011 is the academic origin of the pattern.
- Proposed section: Privacy & Advanced (or Cryptanalysis). Proposed chip: ATTACKS. Verify.

## Citations (checked)

Boldyreva, Chenette, Lee, O'Neill, "Order-Preserving Symmetric Encryption", EUROCRYPT 2009. Chenette, Lewi, Weis, Wu, "Practical Order-Revealing Encryption with Limited Leakage", FSE 2016. Naveed, Kamara, Wright, "Inference Attacks on Property-Preserving Encrypted Databases", ACM CCS 2015. Durak, DuBuisson, Cash, "What Else is Revealed by Order-Revealing Encryption?", ACM CCS 2016. Grubbs, Sekniqi, Bindschaedler, Naveed, Ristenpart, "Leakage-Abuse Attacks against Order-Revealing Encryption", IEEE S&P 2017. Lewi & Wu, "Order-Revealing Encryption: New Constructions, Applications, and Lower Bounds", ACM CCS 2016 (non-goal reference). RFC 8452.

---

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
