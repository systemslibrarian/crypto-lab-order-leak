#!/usr/bin/env node
/**
 * Replays every record in e2e/verdict-mutations.ts and JUDGES it against the four
 * rules a kill has to clear. Nothing below is typed by a person: every verdict is
 * produced by the run that earned it.
 *
 *   node scripts/mutation.mjs list
 *   node scripts/mutation.mjs verify           # all twelve
 *   node scripts/mutation.mjs verify 0 3 7     # by index
 *
 * WHAT CHANGED IN THE LEDGER TO MAKE THIS POSSIBLE
 *
 * Every record described its edit as PROSE -- "src/ppe/control.ts
 * randomizedEncrypt(): replace `crypto.getRandomValues(new Uint8Array(12))` with
 * `new Uint8Array(12)`" -- which a person can redo and a script cannot. Each now
 * also carries `edits`: one or more { file, find, replace } steps, applied in order
 * and reversed last-first.
 *
 * It is a LIST rather than a single patch because two records genuinely need more
 * than one edit, and collapsing them would have meant encoding less than the record
 * describes:
 *
 *   [1] replaces the control branch's interpolated aggregate in BOTH query() and
 *       recover(). Doing only one leaves the other half of the claim measured, and
 *       the record is about the pair.
 *   [7] renders the bar INDEX instead of the value name, and the index does not
 *       exist until the map callback takes it -- so the signature changes first and
 *       the template second.
 *
 * The prose stays, because it carries what the edits cannot: which function the edit
 * sits in, and why that edit rather than another. [4] is the clearest case -- it
 * moves a verdict's STATE while leaving its words untouched, and its prose records
 * that this is the exact defect Fix 1 describes, the page going on saying the right
 * sentence while claiming the opposite in every other way a reader can see. No
 * find/replace pair says that.
 *
 * THE FOUR RULES, each enforced rather than assumed:
 *
 *   1. The owning test PASSED UNMUTATED in this same run, checked per record from
 *      `killedByTest`. A baseline green overall can still be green because the one
 *      test that matters never ran.
 *   2. Every edit CHANGED ITS FILE, and every file returns to its original md5.
 *      The whole sequence is checked for every selected record BEFORE any is
 *      applied -- forward and then in reverse, which is the only way to know a
 *      multi-edit record can be undone -- and the md5s are re-checked after each
 *      record. A restore that does not land aborts the run: every verdict after it
 *      would describe the file that stayed mutated rather than its own mutation.
 *   3. The run served the MUTATED CODE, proved two ways because one is not enough:
 *      the built bundle's hash must MOVE, and the failure must not match a shape
 *      meaning the code never ran at all. CI=1 turns off reuseExistingServer and
 *      the preview server is --strictPort on 4201.
 *   4. A patch that DOES NOT COMPILE is DOES NOT BUILD, never a kill. The build runs
 *      explicitly before the gate, so that answer arrives directly rather than as a
 *      webServer timeout.
 *
 * WHY THE GATE RUNS AS A PROJECT, NEVER -g
 *
 * playwright.config.ts gives `verdict-coverage` a `dependencies: ['claims']`, and
 * e2e/verdict-coverage.spec.ts fails the run when a recorded kill's (test title,
 * marker) pair was never executed. So the gate is `--project=verdict-coverage`, and
 * a single-test run cannot exit 0 here: the named test passes and the coverage check
 * fails on the other eleven.
 *
 * When a mutation does kill its owning test, the `claims` project goes red and the
 * dependent `verdict-coverage` project is SKIPPED. That is expected, and it is why
 * the verdict below is read from the OWNING TEST's own result in the JSON report
 * rather than from the suite's exit code.
 *
 * `killedByTest` names a test TITLE and not a file, so the title is looked up across
 * every spec the run reported, and a title matching two specs is refused as an
 * ambiguous record rather than guessed at.
 *
 * ON IMPORTING THE LEDGER. The records are a TypeScript module, so this script
 * imports it directly and relies on Node's type stripping (23.6+, verified on 26.9).
 * Moving them to JSON was the alternative and was not taken: e2e/verdict-coverage.spec.ts
 * imports this module, so the records would have had to be duplicated or that spec
 * rewritten to make a script's life easier. A failed import is reported as a failed
 * import, never as zero records.
 *
 * Results are NOT written back into the ledger. verdict-coverage.spec.ts already
 * fails the run when a recorded kill did not execute, so an archived `observed`
 * string would be a second copy of an enforced answer -- the choice
 * crypto-lab-hidden-bit and crypto-lab-pqxdh-wire both made, and §4.1c calls
 * writing back optional and enforcement the requirement.
 *
 * The `baseline` and `killedBy` fields each record carries ARE typed observations,
 * pasted from the session that first ran them -- and this lab's are unusually good,
 * naming the bundle hash before and after. They are left alone: they are historical
 * evidence, this script now supersedes them as the live answer, and deleting another
 * author's recorded evidence is a maintainer's call rather than a side effect of
 * adding a runner.
 */
import { createHash } from 'node:crypto'
import { execFileSync, execSync, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url)).replace(/\/$/, '')
const GATE = ['--project=verdict-coverage']

let LEDGER
try {
  LEDGER = await import(join(ROOT, 'e2e/verdict-mutations.ts'))
} catch (error) {
  console.error('Could not import e2e/verdict-mutations.ts, so there are no records to judge.')
  console.error(`  ${error.message.split('\n')[0]}`)
  console.error('\nThis script imports the TypeScript ledger directly and needs Node 23.6+ for')
  console.error(`type stripping. This is ${process.version}.`)
  process.exit(2)
}

const RECORDS = LEDGER.MARKER_MUTATIONS.map((record, index) => ({ index, id: String(index), ...record }))

const [, , command, ...only] = process.argv

if (command === 'list') {
  for (const record of RECORDS) {
    console.log(`[${record.id}] ${record.marker}  (${record.kind})`)
    console.log(`  edits     ${record.edits ? record.edits.map((e) => `${e.file}: ${e.find.split('\n')[0].trim().slice(0, 70)}`).join('\n            ') : 'NOT ENCODED'}`)
    console.log(`  killed by ${record.killedByTest}\n`)
  }
  process.exit(0)
}

if (command !== 'verify') {
  console.error('usage: mutation.mjs list | verify [index...]')
  process.exit(1)
}

const selected = only.length === 0 ? RECORDS : RECORDS.filter((record) => only.includes(record.id) || only.includes(record.marker))
if (only.length > 0 && selected.length === 0) {
  console.error(`nothing selected by: ${only.join(', ')}`)
  process.exit(1)
}
const unencoded = selected.filter((record) => !record.edits || record.edits.length === 0)
if (unencoded.length > 0) {
  console.error('Refusing to run: these records have only prose, no `edits`.\n')
  for (const record of unencoded) console.error(`  [${record.id}] ${record.mutation}`)
  console.error('\nA sentence describing an edit cannot be replayed. Encode it as file/find/replace.')
  process.exit(2)
}

const git = (...args) => execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' }).trim()

/* The archive below is taken from HEAD, so uncommitted work would be absent from
   the tree every verdict describes. Commit first. */
const dirty = git('status', '--porcelain', '--untracked-files=no')
if (dirty && !process.env.MUTATION_ALLOW_DIRTY) {
  console.error('Refusing to run: uncommitted changes to tracked files.\n')
  console.error(dirty)
  console.error('\nThe isolated tree is archived from HEAD and would not contain them.')
  console.error('Commit first. MUTATION_ALLOW_DIRTY=1 overrides, knowing that.')
  process.exit(2)
}

const sha = git('rev-parse', 'HEAD').slice(0, 7)
const TREE = mkdtempSync(join(tmpdir(), 'order-leak-mutation-'))
const SCRATCH = mkdtempSync(join(tmpdir(), 'order-leak-reports-'))
execSync(`git -C ${ROOT} archive HEAD | tar -x -C ${TREE}`, { stdio: 'pipe' })
symlinkSync(join(ROOT, 'node_modules'), join(TREE, 'node_modules'))
console.log(`isolated tree: ${TREE}`)
console.log(`archived from: ${sha}`)

const digest = (rel) => createHash('md5').update(readFileSync(join(TREE, rel))).digest('hex').slice(0, 12)

/** Apply one record's edits in order, or reverse them last-first. */
function apply(record, direction) {
  const steps = direction === 'apply' ? record.edits : [...record.edits].reverse()
  for (const step of steps) {
    const path = join(TREE, step.file)
    const source = readFileSync(path, 'utf8')
    const [from, to] = direction === 'apply' ? [step.find, step.replace] : [step.replace, step.find]
    const occurrences = source.split(from).length - 1
    if (occurrences !== 1) {
      throw new Error(`${step.file}: ${direction} [${record.id}] expected exactly one occurrence, found ${occurrences}`)
    }
    const next = source.replace(from, to)
    if (next === source) throw new Error(`${step.file}: ${direction} [${record.id}] produced an identical file`)
    writeFileSync(path, next)
  }
}

/* Rule 2, for every selected record, BEFORE any is applied, read from the TREE the
   edits are applied to rather than from the working copy. The sequence is run
   forward AND back: for a multi-edit record that is the only way to know it can be
   undone, and a record that cannot be undone poisons every verdict after it. */
function preflight() {
  const broken = []
  for (const record of selected) {
    const files = [...new Set(record.edits.map((e) => e.file))]
    const before = new Map(files.map((f) => [f, digest(f)]))
    try {
      apply(record, 'apply')
      apply(record, 'restore')
      for (const [f, md5] of before) {
        if (digest(f) !== md5) broken.push(`[${record.id}] ${record.marker}: ${f} did not return to ${md5} after a dry round trip`)
      }
    } catch (error) {
      broken.push(`[${record.id}] ${record.marker}: ${error.message}`)
      // leave nothing behind for the next record to trip over
      for (const [f, md5] of before) {
        if (digest(f) !== md5) broken.push(`[${record.id}] ${record.marker}: ${f} LEFT MUTATED by the dry run`)
      }
    }
  }
  if (broken.length > 0) {
    console.error('\nRefusing to run: these records cannot make the round trip.\n')
    for (const line of broken) console.error(`  ${line}`)
    rmSync(TREE, { recursive: true, force: true })
    rmSync(SCRATCH, { recursive: true, force: true })
    process.exit(2)
  }
}
preflight()
console.log(`${selected.length} record(s) make the round trip, ${selected.reduce((n, r) => n + r.edits.length, 0)} edits in total\n`)

const DIST = join(TREE, 'dist', 'assets')
function bundleHash() {
  if (!existsSync(DIST)) return null
  const h = createHash('sha256')
  for (const file of readdirSync(DIST).sort()) h.update(file).update(readFileSync(join(DIST, file)))
  return h.digest('hex').slice(0, 12)
}

/** Rule 4. Keeps the output so the reason is reportable. */
function build() {
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: TREE,
    env: { ...process.env, CI: '1' },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return { ok: result.status === 0, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

const ESC = String.fromCharCode(27)
const strip = (text) => text.split(new RegExp(`${ESC}\\[[0-9;]*m`, 'g')).join('')

/* Rule 3's second half: red for one of these means the code never ran, so the red is
   about the harness and not about the verdict. */
const NOT_A_KILL = [
  { pattern: /error TS\d+|Build failed|Transform failed|Could not resolve/i, label: 'build error' },
  { pattern: /webServer.*did not start|Timed out waiting .* from config\.webServer/i, label: 'server never started' },
  { pattern: /net::ERR_CONNECTION_REFUSED/i, label: 'nothing served on the port' },
  { pattern: /is already (?:used|in use)|EADDRINUSE/i, label: 'port already held' },
]
const notAKill = (output) => NOT_A_KILL.find(({ pattern }) => pattern.test(strip(output)))?.label ?? null

function runGate(label) {
  const report = join(SCRATCH, `${label}.json`)
  const result = spawnSync('npx', ['playwright', 'test', ...GATE, '--reporter=json', '--retries=0'], {
    cwd: TREE,
    env: { ...process.env, CI: '1', PLAYWRIGHT_JSON_OUTPUT_NAME: report },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  let parsed
  try {
    parsed = JSON.parse(readFileSync(report, 'utf8'))
  } catch {
    return { specs: null, exitCode: result.status, output }
  }
  const specs = []
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) specs.push(spec)
    for (const child of suite.suites ?? []) walk(child)
  }
  for (const suite of parsed.suites ?? []) walk(suite)
  return { specs, exitCode: result.status, output }
}

/** The record's own test, by TITLE. An ambiguous title is refused, not resolved. */
function outcome(specs, record) {
  const matches = specs?.filter((spec) => spec.title === record.killedByTest) ?? []
  if (matches.length === 0) return { found: false, ok: false, detail: `no test titled "${record.killedByTest}" ran` }
  if (matches.length > 1) {
    return { found: false, ok: false, detail: `"${record.killedByTest}" matched ${matches.length} specs (${matches.map((s) => s.file).join(', ')}); the record is ambiguous` }
  }
  const spec = matches[0]
  const statuses = spec.tests.flatMap((test) => test.results.map((result) => result.status))
  return { found: true, ok: spec.ok === true, detail: statuses.join(', ') }
}

function abort(message) {
  console.error(`\n${message}`)
  rmSync(TREE, { recursive: true, force: true })
  rmSync(SCRATCH, { recursive: true, force: true })
  process.exit(2)
}

console.log('building the baseline in the isolated tree...')
const baselineBuild = build()
if (!baselineBuild.ok) {
  abort(`The baseline does not build in the isolated tree. Nothing below would mean anything.\n\n${strip(baselineBuild.output).split('\n').slice(-20).join('\n')}`)
}
const baselineHash = bundleHash()
console.log(`baseline bundle ${baselineHash}`)

console.log('running the gate unmutated (--project=verdict-coverage, which pulls claims first)...')
const baseline = runGate('baseline')
const notGreen = selected.filter((record) => !outcome(baseline.specs, record).ok)
if (baseline.exitCode !== 0 || notGreen.length > 0) {
  for (const record of notGreen) console.error(`  [${record.id}] ${record.marker}: ${outcome(baseline.specs, record).detail}`)
  abort(`The unmutated gate is not green (exit ${baseline.exitCode}); a kill read against it would prove nothing.\n\n${strip(baseline.output).split('\n').slice(-25).join('\n')}`)
}
console.log(`baseline green, ${baseline.specs.length} specs\n`)

const results = []
for (const [position, record] of selected.entries()) {
  const label = `${String(position + 1).padStart(2)}/${selected.length}`
  const files = [...new Set(record.edits.map((e) => e.file))]
  const before = new Map(files.map((f) => [f, digest(f)]))
  let verdict
  let detail = ''
  let hashes = ''
  try {
    apply(record, 'apply')
    const built = build()
    if (!built.ok) {
      verdict = 'DOES NOT BUILD'
      detail = (strip(built.output).match(/error TS\d+[^\n]*/) ?? [''])[0]
    } else {
      const mutatedHash = bundleHash()
      if (mutatedHash === baselineHash) {
        verdict = 'BUNDLE UNCHANGED'
      } else {
        const mutated = runGate(record.id)
        const shape = notAKill(mutated.output)
        const result = outcome(mutated.specs, record)
        verdict = shape
          ? `NOT A KILL (${shape})`
          : !result.found
            ? `NOT A KILL (${result.detail})`
            : result.ok
              ? 'SURVIVED'
              : 'KILLED'
        detail = result.detail
        hashes = `${baselineHash} -> ${mutatedHash}`
      }
    }
  } finally {
    apply(record, 'restore')
  }
  const rebuilt = build()
  const restoredHash = rebuilt.ok ? bundleHash() : null
  for (const [f, md5] of before) {
    if (digest(f) !== md5) {
      abort(`[${record.id}] ${record.marker}: ${f} did not return to md5 ${md5}. Aborting: every verdict after this one would describe that file rather than its own mutation.`)
    }
  }
  if (rebuilt.ok && restoredHash !== baselineHash) {
    abort(`[${record.id}] ${record.marker}: the bundle did not return to ${baselineHash} after restoring. Aborting for the same reason.`)
  }
  results.push({ record, verdict, detail })
  console.log(`${label}  ${verdict.padEnd(18)} [${record.id}] ${record.marker.padEnd(16)} ${hashes ? `${hashes} -> ${restoredHash}` : detail}`)
}

rmSync(TREE, { recursive: true, force: true })
rmSync(SCRATCH, { recursive: true, force: true })

const killed = results.filter((r) => r.verdict === 'KILLED')
const survived = results.filter((r) => r.verdict === 'SURVIVED')
const broken = results.filter((r) => r.verdict !== 'KILLED' && r.verdict !== 'SURVIVED')
console.log(`\n${killed.length}/${results.length} killed, ${survived.length} survived, ${broken.length} neither`)
for (const { record, detail } of survived) {
  console.log(`  SURVIVED [${record.id}] ${record.marker}: "${record.killedByTest}" stayed green under its own recorded mutation (${detail}). The record is not evidence.`)
}
for (const { record, verdict, detail } of broken) {
  console.log(`  ${verdict} [${record.id}] ${record.marker}${detail ? `: ${detail}` : ''}`)
}
if (broken.length > 0) {
  console.log('\nDOES NOT BUILD is a broken PATCH, not a surviving mutation: fix the patch and re-run.')
  console.log('BUNDLE UNCHANGED means the edit never reached the browser.')
}
process.exit(killed.length === results.length ? 0 : 1)
