import './styles.css'
import { cumulativeRecover } from './attack/cumulative'
import { frequencyRecover } from './attack/frequency'
import { compareOreObservations, recoverOreTree } from './attack/msdb'
import { sortingRecover } from './attack/sorting'
import { encryptedEquality, encryptedRange, encryptedSort, type QueryableScheme } from './db/query'
import { departmentDomain, encodeColumnValue, makeTable, sealTable, type DataColumn, type Person } from './db/table'
import { publicAgeValues, publicDepartmentDistribution, publicSalaryValues, type AuxiliaryPopulation } from './data/public'
import { dteEncrypt, dteTagVerifies, toHex } from './ppe/dte'
import { opeEncrypt } from './ppe/ope-bclo'
import { oreEncrypt, oreSetup, serializeOre, type OreCiphertext } from './ppe/ore-clww'
import { compareRecovery } from './score/compare'

const app = document.querySelector<HTMLElement>('#app')!
const oreKey = oreSetup()
let rows = makeTable(240)
let sealed = await sealTable(rows, oreKey)
let revealed = false
let recovered = new Map<number, string | number | null>()
let column: DataColumn = 'department'
let selectedScheme: QueryableScheme | 'control' = 'dte'
let auxiliaryPopulation: AuxiliaryPopulation = 'matching'
let status = 'Choose a column and scheme, then make the database answer a query without decrypting.'

const selected = () => rows.slice(0, 18)
const actual = (row: Person) => row[column]
const columnName = () => ({ department: 'Department', age: 'Age', salary: 'Salary' }[column])
const schemeName = () => ({ dte: 'Deterministic AES-GCM-SIV', ope: 'BCLO toy OPE', ore: 'Binary CLWW ORE', control: 'AES-GCM randomized control' }[selectedScheme])
const queryBounds = () => column === 'department' ? [1, 2] : column === 'age' ? [30, 40] : [73, 149]
const equalityTarget = () => column === 'department' ? 'Finance' : column === 'age' ? 40 : 101
const lesson = () => ({
  dte: {
    feature: 'Find rows equal to a search value',
    leak: 'Equal values always produce equal ciphertexts',
    attack: 'Count repeated ciphertexts and match those counts to public statistics',
  },
  ope: {
    feature: 'Run ranges and sort encrypted rows',
    leak: 'Ciphertexts appear in the same order as plaintexts',
    attack: column === 'salary'
      ? 'Ranks leak, but sparse gaps stay unknown; the sorting attack is incomplete'
      : 'Match ciphertext ranks to a dense public list and recover each value',
  },
  ore: {
    feature: 'Compare and sort encrypted rows',
    leak: 'Comparisons reveal order and the first differing bit',
    attack: 'Rebuild an order tree, then align its boundaries to public statistics',
  },
  control: {
    feature: 'No equality, range, or sort query',
    leak: 'Repeated values have unrelated ciphertexts',
    attack: 'No stable pattern remains to match; recovery stays at zero',
  },
}[selectedScheme])

function publicValues(): (string | number)[] {
  if (column === 'department') {
    return Object.entries(publicDepartmentDistribution(rows.length, auxiliaryPopulation))
      .flatMap(([value, count]) => Array.from({ length: count }, () => value))
  }
  if (column === 'age') {
    const values = publicAgeValues(rows.length)
    return auxiliaryPopulation === 'mismatch' ? values.filter((value) => value !== 65) : values
  }
  return publicSalaryValues(rows.length, auxiliaryPopulation)
}

function encodedPublicValues(): number[] {
  return publicValues().map((value) => encodeColumnValue(column, value)).sort((left, right) => left - right)
}

function decodeGuess(value: number | null): string | number | null {
  return column === 'department' && value !== null ? departmentDomain[value] : value
}

function query() {
  if (selectedScheme === 'control') {
    status = 'Cannot sort ciphertexts or run equality queries on randomized AES-GCM. Each encryption is intentionally different.'
  } else if (selectedScheme === 'dte') {
    const target = equalityTarget()
    const token = toHex(dteEncrypt(`${column}:${target}`))
    status = `Equality query for ${target} matched ${encryptedEquality(sealed, column, 'dte', token).length} sealed rows; the server compared a client-generated token.`
  } else {
    const [minimum, maximum] = queryBounds()
    const encrypt = selectedScheme === 'ope' ? opeEncrypt : (value: number) => oreEncrypt(oreKey, value)
    const matched = encryptedRange(sealed, column, selectedScheme, encrypt(minimum), encrypt(maximum)).length
    status = `Range query ${minimum}-${maximum} matched ${matched} sealed rows; ORDER BY returned ${encryptedSort(sealed, column, selectedScheme).length} rows without decryption.`
  }
  render()
}

function recover() {
  recovered = new Map()
  try {
    if (selectedScheme === 'dte') {
      const auxiliary = publicValues().reduce<Record<string, number>>((counts, value) => {
        counts[value] = (counts[value] ?? 0) + 1
        return counts
      }, {})
      const guesses = frequencyRecover(sealed.map((row) => ({ id: row.id, ciphertext: row[column].dte })), auxiliary)
      recovered = new Map([...guesses].map(([id, guess]) => [id, column === 'department' || guess === null ? guess : Number(guess)]))
      status = 'Frequency matching aligned deterministic ciphertext buckets to public counts. No key was imported.'
    } else if (selectedScheme === 'ope') {
      const guesses = sortingRecover(sealed.map((row) => ({ id: row.id, ciphertext: row[column].ope })), encodedPublicValues())
      recovered = new Map([...guesses].map(([id, guess]) => [id, decodeGuess(guess)]))
      status = `Sorting attack aligned the ${column === 'age' ? 'dense' : 'ordered'} ciphertext column to public ranks. No key was imported.`
    } else if (selectedScheme === 'ore') {
      const observations = sealed.map((row) => ({ id: row.id, ciphertext: row[column].ore }))
      const tree = recoverOreTree(observations)
      const guesses = cumulativeRecover(observations, encodedPublicValues(), compareOreObservations)
      recovered = new Map([...guesses].map(([id, guess]) => [id, decodeGuess(guess)]))
      status = `Cumulative matching used ${tree.pairs.length.toLocaleString()} pairwise CLWW comparisons; the recovered radix tree begins at MSDB depth ${tree.tree?.kind === 'branch' ? tree.tree.depth : 'none'}. No key was imported.`
    } else {
      status = 'NOTHING RECOVERED: randomized ciphertexts carry no stable equality or order relation.'
    }
  } catch (error) {
    status = `RECOVERY REJECTED: ${error instanceof Error ? error.message : 'Auxiliary support mismatch.'}`
    revealed = false
    render()
    return
  }
  revealed = false
  render()
}

function score() {
  return compareRecovery(rows.map(actual), recovered)
}

function ciphertextFor(rowId: number): string | number {
  const ciphertext = sealed[rowId - 1][column][selectedScheme]
  if (selectedScheme === 'ore') return serializeOre(ciphertext as OreCiphertext)
  const value = String(ciphertext)
  return value.length > 15 ? `${value.slice(0, 15)}...` : value
}

function render() {
  const distribution = publicValues().reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1
    return counts
  }, {})
  const publicBars = Object.entries(distribution).slice(0, 12).map(([name, count]) => `<div class="bar-row"><span>${name}</span><i style="width:${(count / rows.length) * 100}%"></i><b>${count}</b></div>`).join('')
  const scorecard = score()
  const isControl = selectedScheme === 'control'
  const currentLesson = lesson()
  const attackDescription = selectedScheme === 'dte'
    ? 'Frequency matching aligns deterministic buckets to public counts.'
    : selectedScheme === 'ope'
      ? column === 'salary' ? 'The sorting attack is incomplete on this sparse column: order does not reveal the gaps between salary bands.' : 'Sorting aligns the ordered column to dense public values.'
      : selectedScheme === 'ore'
        ? 'Pairwise MSDB leakage reconstructs a radix tree; cumulative matching aligns its boundaries to public statistics.'
        : 'Randomized AES-GCM provides no stable equality or order signal.'

  app.innerHTML = `
    <header class="cl-hero">
      <div class="cl-hero-main"><h1 class="cl-hero-title">Order Leak</h1><p class="cl-hero-sub">Property-preserving encryption · OPE · ORE</p><p class="cl-hero-desc">Sort an encrypted column, run WHERE on it, then hand the same ciphertexts to an attacker with a census table and watch the column return without the key.</p></div>
      <aside class="cl-hero-why" aria-label="Why it matters"><span class="cl-hero-why-label">WHY IT MATTERS</span><p class="cl-hero-why-text">Encryption at rest is not the end of the conversation. Schemes that preserve equality or order for a database also publish the shape an inference attack needs.</p></aside>
    </header>
    <section class="intro"><p><strong>The lesson:</strong> queryable encryption leaves a pattern visible on purpose. The database uses that pattern to answer a query; an attacker can use the same pattern, plus public statistics, to infer the hidden values without the key.</p><p><strong>Try the contrast:</strong> DTE leaks equality, OPE leaks order, ORE leaks order plus bit structure, and randomized AES-GCM leaks neither stable relation.</p></section>
    <section class="steps" aria-label="Lab steps"><span>1. Pick a column</span><span>2. Pick a scheme</span><span>3. Query</span><span>4. Recover and reveal</span></section>
    <section class="controls" aria-label="Experiment controls"><div class="matrix-controls"><div><span class="control-label">1 · DATA TO PROTECT</span><div class="segmented" role="group" aria-label="Database column">
      ${(['department', 'age', 'salary'] as const).map((choice) => `<button class="${column === choice ? 'active' : ''}" data-column="${choice}" aria-pressed="${column === choice}">${choice === 'department' ? 'Department' : choice === 'age' ? 'Age' : 'Salary'}</button>`).join('')}
    </div></div><div><span class="control-label">2 · ENCRYPTION CHOICE</span><div class="segmented" role="group" aria-label="Encryption scheme">
      ${(['dte', 'ope', 'ore', 'control'] as const).map((choice) => `<button class="${selectedScheme === choice ? 'active' : ''}" data-scheme="${choice}" aria-pressed="${selectedScheme === choice}">${choice === 'dte' ? 'Deterministic (DTE)' : choice === 'ope' ? 'Order-preserving (OPE)' : choice === 'ore' ? 'Order-revealing (ORE)' : 'Randomized control'}</button>`).join('')}
    </div></div></div><div class="control-pair"><label>Rows <select id="row-count"><option value="24" ${rows.length === 24 ? 'selected' : ''}>24 (tiny)</option><option value="240" ${rows.length === 240 ? 'selected' : ''}>240</option><option value="500" ${rows.length === 500 ? 'selected' : ''}>500</option><option value="1000" ${rows.length === 1000 ? 'selected' : ''}>1,000</option></select></label><label>Public population <select id="population"><option value="matching" ${auxiliaryPopulation === 'matching' ? 'selected' : ''}>Matching synthetic</option><option value="shifted" ${auxiliaryPopulation === 'shifted' ? 'selected' : ''}>Shifted population</option><option value="mismatch" ${auxiliaryPopulation === 'mismatch' ? 'selected' : ''}>Mismatched support</option></select></label></div></section>
    <section class="leakage-ledger" aria-labelledby="tradeoff-title"><div class="ledger-heading"><span>SELECTED EXPERIMENT</span><h2 id="tradeoff-title">${columnName()} under ${schemeName()}</h2></div><div class="ledger-facts"><div><b>DATABASE GAINS</b><p>${currentLesson.feature}</p></div><div><b>PATTERN LEFT VISIBLE</b><p>${currentLesson.leak}</p></div><div class="${isControl ? 'safe-fact' : 'danger-fact'}"><b>ATTACKER CAN</b><p>${currentLesson.attack}</p></div></div></section>
    ${rows.length < 30 ? '<p class="warning" role="status">SAMPLE WARNING: fewer than 30 rows makes frequency statistics unstable. Treat this result as an illustration, not evidence.</p>' : ''}
    <section class="lab-grid">
      <article class="panel dba"><div class="panel-title"><span>DBA VIEW</span><small>${columnName()} · ${schemeName()} · ${isControl ? 'control' : 'leaky by design'}</small></div><p>The database sees sealed values and evaluates only the selected ciphertext relation.</p><button class="command" id="query">${isControl ? 'Try a query' : 'Run query on ciphertexts'}</button><output class="status neutral" role="status" aria-live="polite">${status}</output>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Sealed database rows"><table><thead><tr><th>ROW</th><th>SEALED VALUE</th><th>PROPERTY</th></tr></thead><tbody>${selected().map((row) => `<tr><td>${row.id}</td><td class="cipher">${ciphertextFor(row.id)}</td><td>${isControl ? 'none' : selectedScheme === 'dte' ? '=' : selectedScheme === 'ore' ? 'order + MSDB' : 'order'}</td></tr>`).join('')}</tbody></table></div></article>
      <article class="panel attacker"><div class="panel-title"><span>ATTACKER VIEW</span><small>ciphertexts + public statistics</small></div><p>There is no key here. ${attackDescription}</p>
      <div class="histogram" role="group" aria-label="Public distribution">${publicBars}</div><button class="command alarm" id="recover">Run recovery</button>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Recovered attacker rows"><table><thead><tr><th>ROW</th><th>RECOVERED</th><th>VERDICT</th></tr></thead><tbody>${selected().map((row) => { const guess = recovered.get(row.id); const verdict = !revealed ? (guess === undefined ? 'WAITING' : guess === null ? '? AMBIGUOUS' : '! RECOVERED') : guess === actual(row) ? '! RECOVERED' : guess == null ? '? AMBIGUOUS' : '! MISMATCH'; return `<tr><td>${row.id}</td><td>${guess === undefined ? '—' : guess === null ? 'ambiguous' : guess}</td><td class="${verdict.includes('RECOVERED') ? 'alarm-text' : verdict.includes('AMBIGUOUS') ? 'amber-text' : ''}">${verdict}</td></tr>` }).join('')}</tbody></table></div>
      <div class="reveal"><button class="command secondary" id="reveal" ${recovered.size || isControl ? '' : 'disabled'}>Reveal sealed truth</button>${revealed ? `<strong class="${isControl ? 'control-ok' : 'alarm-text'}" data-score="${scorecard.matched}/${rows.length}">${isControl ? 'NOTHING RECOVERED' : `${scorecard.matched} MATCHED · ${scorecard.mismatched} MISMATCHED · ${scorecard.unresolved} AMBIGUOUS`}</strong>` : ''}</div></article>
    </section>
    <section class="evidence"><h2>Authenticated, never decrypted, and recovered</h2><p>Every deterministic AES-GCM-SIV department ciphertext has a valid authentication tag: <strong>${sealed.every((row) => dteTagVerifies(Uint8Array.from(row.department.dte.match(/.{1,2}/g)!.map((part) => parseInt(part, 16))))) ? 'TAGS VERIFIED' : 'TAG FAILURE'}</strong>. The query module holds no key, equality still succeeds, and frequency analysis recovers cells from public counts.</p></section>
    <details><summary>Method notes and limits</summary><p>BCLO uses exact hypergeometric splitting over an 8-bit plaintext to 16-bit ciphertext domain. Binary CLWW emits eight HMAC-derived trits; all pairwise comparisons reconstruct a radix tree. NKW cumulative matching aligns its bucket CDF to auxiliary data. The OPE sorting attack is complete for dense ages but incomplete for sparse salaries because order omits the gaps.</p></details>
    <footer class="scripture-footer"><p>So whether you eat or drink or whatever you do, do it all for the glory of God. — 1 Corinthians 10:31</p></footer>`

  app.querySelectorAll<HTMLButtonElement>('[data-column]').forEach((button) => button.addEventListener('click', () => {
    const next = button.dataset.column as DataColumn
    if (next === column) return
    column = next
    recovered = new Map()
    revealed = false
    status = `Selected ${columnName()} under ${schemeName()}. Previous recovery retired.`
    render()
  }))
  app.querySelectorAll<HTMLButtonElement>('[data-scheme]').forEach((button) => button.addEventListener('click', () => {
    const next = button.dataset.scheme as typeof selectedScheme
    if (next === selectedScheme) return
    selectedScheme = next
    recovered = new Map()
    revealed = false
    status = `Selected ${columnName()} under ${schemeName()}. Previous recovery retired.`
    render()
  }))
  app.querySelector<HTMLButtonElement>('#query')!.addEventListener('click', query)
  app.querySelector<HTMLButtonElement>('#recover')!.addEventListener('click', recover)
  app.querySelector<HTMLButtonElement>('#reveal')!.addEventListener('click', () => { revealed = true; render() })
  app.querySelector<HTMLSelectElement>('#row-count')!.addEventListener('change', async (event) => { rows = makeTable(Number((event.target as HTMLSelectElement).value)); sealed = await sealTable(rows, oreKey); recovered = new Map(); revealed = false; status = 'Dataset reshuffled. Previous recovery retired.'; render() })
  app.querySelector<HTMLSelectElement>('#population')!.addEventListener('change', (event) => { auxiliaryPopulation = (event.target as HTMLSelectElement).value as AuxiliaryPopulation; recovered = new Map(); revealed = false; status = 'Auxiliary population changed. Previous recovery retired.'; render() })
}

render()
