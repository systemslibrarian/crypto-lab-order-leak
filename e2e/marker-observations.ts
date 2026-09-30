import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The run-scoped record of which marker assertions ACTUALLY EXECUTED.
 *
 * Brief decision D6: "a mention is still not an assertion, one level down."
 * The Fix 1 rule this lab shipped was a scan of `claims.spec.ts` source text
 * for `expectVerdict(page, '<id>'`, and a scan of source text enforces that a
 * string is present, not that an assertion ran. Three auditors defeated that
 * shape three ways across the fleet -- comment the call out, keep the call but
 * feed it values read off the page in the same test, or satisfy the
 * file-granular match from an unrelated line elsewhere in the file. This lab's
 * own escape was the middle one, and it stayed green at 16 passed while the
 * attacker's auxiliary histogram rendered `["0","1","2","3"]` where it should
 * have read `["Support","Finance","Research","Sales"]`.
 *
 * So the denominator is discovered rather than declared, the same correction
 * the rest of the brief makes: `expect-marker.ts` appends a line here every
 * time one of its helpers finishes asserting a marker, and
 * `verdict-coverage.spec.ts` requires that every recorded mutation's
 * `(killedByTest, kind:marker)` pair appears in what was appended.
 *
 * Playwright runs tests in separate worker PROCESSES, so a module-level `Set`
 * aggregates nothing -- each worker would build its own and throw it away. The
 * sink is therefore a file, appended line-at-a-time. Every line is well under
 * `PIPE_BUF`, and `appendFileSync` opens with `O_APPEND`, so concurrent worker
 * writes interleave by whole lines rather than corrupting each other.
 *
 * It lives under `test-results/`, which is gitignored, and is cleared by
 * `global-setup.ts` at the start of every run so that a stale sink can never
 * answer for a run that did not make the observation. It is created lazily by
 * the first append -- after Playwright has finished any output-directory
 * cleanup of its own -- rather than up front.
 */

export type MarkerKind = 'verdict' | 'claim'

export type Observation = {
  /** the title of the test that was running when the assertion completed. */
  test: string
  kind: MarkerKind
  /** the marker id that was asserted. */
  marker: string
  /** the spec file the test came from, for diagnostics only. */
  file: string
}

const SINK = resolve(fileURLToPath(new URL('../test-results/marker-runtime/observed.jsonl', import.meta.url)))

/** Identity of one executed assertion, as both sides of the check spell it. */
export const pairKey = (test: string, kind: MarkerKind, marker: string) => `${kind}:${marker} asserted by "${test}"`

/** Start of run: no observation from any earlier run may answer for this one. */
export function clearObservations(): void {
  rmSync(dirname(SINK), { recursive: true, force: true })
}

/** Append one executed assertion. Called only after the assertion has PASSED. */
export function recordObservation(observation: Observation): void {
  mkdirSync(dirname(SINK), { recursive: true })
  appendFileSync(SINK, `${JSON.stringify(observation)}\n`, 'utf8')
}

/** Everything this run observed, de-duplicated by pair (retries repeat lines). */
export function observedPairs(): { pairs: Set<string>; tests: Set<string>; lines: number } {
  const pairs = new Set<string>()
  const tests = new Set<string>()
  if (!existsSync(SINK)) return { pairs, tests, lines: 0 }
  const lines = readFileSync(SINK, 'utf8').split('\n').filter(Boolean)
  for (const line of lines) {
    const observation = JSON.parse(line) as Observation
    pairs.add(pairKey(observation.test, observation.kind, observation.marker))
    tests.add(observation.test)
  }
  return { pairs, tests, lines: lines.length }
}

export const OBSERVATION_SINK = SINK
