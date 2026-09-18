import './styles.css'
import { cumulativeRecover } from './attack/cumulative'
import { frequencyRecover } from './attack/frequency'
import { recoverOreOrder } from './attack/msdb'
import { sortingRecover } from './attack/sorting'
import { encryptedAgeRange, encryptedEquality, encryptedSalaryAtLeast, encryptedSalarySort } from './db/query'
import { makeTable, publicDistribution, sealTable, type Person } from './db/table'
import { dteTagVerifies } from './ppe/dte'

const app = document.querySelector<HTMLElement>('#app')!
let rows = makeTable(240)
let sealed = sealTable(rows)
let revealed = false
let recovered = new Map<number, string | number | null>()
let mode: 'department' | 'age' | 'salary' | 'control' = 'department'
let status = 'Choose a property-preserving column, then make the database answer a query without decrypting.'

const abbreviate = (value: string | number) => String(value).length > 15 ? `${String(value).slice(0, 15)}...` : String(value)
const selected = () => rows.slice(0, 18)
const actual = (row: Person) => mode === 'department' ? row.department : mode === 'age' ? row.age : row.salary
const scheme = () => ({ department: 'Deterministic AES-GCM-SIV', age: 'BCLO toy OPE', salary: 'CLWW-style ORE', control: 'AES-GCM randomized control' }[mode])

function query() {
  if (mode === 'department') status = `Equality query matched ${encryptedEquality(sealed, 'Finance').length} sealed rows; the server compared ciphertexts.`
  if (mode === 'age') status = `Range query 30-40 matched ${encryptedAgeRange(sealed, 30, 40).length} sealed rows; ciphertext order answered it.`
  if (mode === 'salary') status = `ORDER BY and salary >= 120 both work: ${encryptedSalarySort(sealed).length} ordered, ${encryptedSalaryAtLeast(sealed, 120).length} matched.`
  if (mode === 'control') status = 'Cannot sort ciphertexts or run equality queries on randomized AES-GCM. Each encryption is intentionally different.'
  render()
}

function recover() {
  recovered = new Map()
  if (mode === 'department') recovered = frequencyRecover(sealed.map((row) => ({ id: row.id, ciphertext: row.department })), publicDistribution(rows))
  if (mode === 'age') recovered = sortingRecover(sealed.map((row) => ({ id: row.id, ciphertext: row.age })), [...rows].map((row) => row.age).sort((a, b) => a - b))
  if (mode === 'salary') recovered = new Map(recoverOreOrder(sealed.map((row) => ({ id: row.id, ciphertext: row.salary }))).map(({ id, rank }) => [id, [...rows].sort((a, b) => a.salary - b.salary)[rank - 1].salary]))
  if (mode === 'control') status = 'NOTHING RECOVERED: randomized ciphertexts carry no stable equality or order relation.'
  else status = `Recovery ran against ciphertexts and public statistics only. No key was imported by the attacker module.`
  revealed = false
  render()
}

function score() {
  const results = rows.map((row) => recovered.get(row.id))
  const matched = results.filter((value, index) => value === actual(rows[index])).length
  const unresolved = results.filter((value) => value === null || value === undefined).length
  return { matched, unresolved, mismatched: rows.length - matched - unresolved }
}

function render() {
  const publicBars = Object.entries(publicDistribution(rows)).map(([name, count]) => `<div class="bar-row"><span>${name}</span><i style="width:${(count / rows.length) * 100}%"></i><b>${count}</b></div>`).join('')
  const scorecard = score()
  const isControl = mode === 'control'
  app.innerHTML = `
    <header class="cl-hero">
      <div class="cl-hero-main"><h1 class="cl-hero-title">Order Leak</h1><p class="cl-hero-sub">Property-preserving encryption · OPE · ORE</p><p class="cl-hero-desc">Sort an encrypted column, run WHERE on it, then hand the same ciphertexts to an attacker with a census table and watch the column return without the key.</p></div>
      <aside class="cl-hero-why" aria-label="Why it matters"><span class="cl-hero-why-label">WHY IT MATTERS</span><p class="cl-hero-why-text">Encryption at rest is not the end of the conversation. Schemes that preserve equality or order for a database also publish the shape an inference attack needs.</p></aside>
    </header>
    <section class="intro"><p><strong>What is this?</strong> A database can compare encrypted values only when encryption leaves a comparison clue behind. This lab uses real AES-GCM-SIV authentication plus inspectable property-preserving toy constructions to make that clue visible.</p><p><strong>What this is not:</strong> not production crypto, searchable encryption, format-preserving encryption, mutable OPE, Lewi-Wu left/right ORE, or a vendor evaluation.</p></section>
    <section class="steps" aria-label="Lab steps"><span>1. Pick a column</span><span>2. Query ciphertexts</span><span>3. Recover</span><span>4. Reveal truth</span></section>
    <section class="controls" aria-label="Choose a column"><div class="segmented" role="group" aria-label="Encryption scheme">
      ${(['department', 'age', 'salary', 'control'] as const).map((choice) => `<button class="${mode === choice ? 'active' : ''}" data-mode="${choice}" aria-pressed="${mode === choice}">${choice === 'department' ? 'Department / equality' : choice === 'age' ? 'Age / order' : choice === 'salary' ? 'Salary / ORE' : 'Randomized control'}</button>`).join('')}
    </div><label>Rows <select id="row-count"><option value="240" ${rows.length === 240 ? 'selected' : ''}>240</option><option value="500" ${rows.length === 500 ? 'selected' : ''}>500</option><option value="1000" ${rows.length === 1000 ? 'selected' : ''}>1,000</option></select></label></section>
    <section class="lab-grid">
      <article class="panel dba"><div class="panel-title"><span>DBA VIEW</span><small>${scheme()} · leaky by design</small></div><p>The database sees sealed values and never needs the plaintext key to evaluate the selected relation.</p><button class="command" id="query" ${isControl ? '' : ''}>${isControl ? 'Try a query' : 'Run query on ciphertexts'}</button><output class="status neutral" role="status" aria-live="polite">${status}</output>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Sealed database rows"><table><thead><tr><th>ROW</th><th>SEALED VALUE</th><th>PROPERTY</th></tr></thead><tbody>${selected().map((row) => `<tr><td>${row.id}</td><td class="cipher">${abbreviate(mode === 'department' ? sealed[row.id - 1].department : mode === 'age' ? sealed[row.id - 1].age : mode === 'salary' ? sealed[row.id - 1].salary.prefixTags[0] : sealed[row.id - 1].dte)}</td><td>${isControl ? 'none' : mode === 'department' ? '=' : 'order'}</td></tr>`).join('')}</tbody></table></div></article>
      <article class="panel attacker"><div class="panel-title"><span>ATTACKER VIEW</span><small>ciphertexts + public statistics</small></div><p>There is no key here. ${mode === 'department' ? 'Frequency matching aligns encrypted bucket sizes to a public census.' : mode === 'age' ? 'Sorting aligns a dense ordered column to sorted public values.' : mode === 'salary' ? 'Pairwise MSDB leakage reconstructs the ORE comparison tree.' : 'Randomized AES-GCM provides no comparable signal.'}</p>
      <div class="histogram" role="group" aria-label="Public distribution">${publicBars}</div><button class="command alarm" id="recover">Run recovery</button>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Recovered attacker rows"><table><thead><tr><th>ROW</th><th>RECOVERED</th><th>VERDICT</th></tr></thead><tbody>${selected().map((row) => { const guess = recovered.get(row.id); const verdict = !revealed ? (guess === undefined ? 'WAITING' : guess === null ? 'AMBIGUOUS' : 'RECOVERED') : guess === actual(row) ? 'RECOVERED' : guess == null ? 'AMBIGUOUS' : 'MISMATCH'; return `<tr><td>${row.id}</td><td>${guess === undefined ? '—' : guess === null ? 'ambiguous' : guess}</td><td class="${verdict === 'RECOVERED' ? 'alarm-text' : verdict === 'AMBIGUOUS' ? 'amber-text' : ''}">${verdict}</td></tr>` }).join('')}</tbody></table></div>
      <div class="reveal"><button class="command secondary" id="reveal" ${recovered.size || isControl ? '' : 'disabled'}>Reveal sealed truth</button>${revealed ? `<strong class="${isControl ? 'control-ok' : 'alarm-text'}" data-score="${scorecard.matched}/${rows.length}">${isControl ? 'NOTHING RECOVERED' : `${scorecard.matched} MATCHED · ${scorecard.mismatched} MISMATCHED · ${scorecard.unresolved} AMBIGUOUS`}</strong>` : ''}</div></article>
    </section>
    <section class="evidence"><h2>Authenticated, never decrypted, and recovered</h2><p>Every deterministic AES-GCM-SIV ciphertext in this fixture has a valid authentication tag: <strong>${sealed.every((row) => dteTagVerifies(Uint8Array.from(row.dte.match(/.{1,2}/g)!.map((part) => parseInt(part, 16))))) ? 'TAGS VERIFIED' : 'TAG FAILURE'}</strong>. The server holds no key, equality and sort queries still succeed, and the frequency attack recovers the column from public counts. Confidentiality here covers the value, not the equality and order the scheme was built to expose.</p></section>
    <details><summary>Method notes and limits</summary><p>OPE uses a keyed monotone injection over an 8-bit plaintext to 16-bit ciphertext toy domain. ORE exposes HMAC-SHA-256 prefix tags; comparing two ciphertexts reveals their most-significant differing bit. The dense age attack is complete only because its public distribution exactly matches the sealed sample. Try a small table in a production setting and statistics become meaningless; a mismatched auxiliary population degrades recovery.</p></details>
    <footer class="scripture-footer"><p>So whether you eat or drink or whatever you do, do it all for the glory of God. — 1 Corinthians 10:31</p></footer>`
  app.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => button.addEventListener('click', () => { mode = button.dataset.mode as typeof mode; recovered = new Map(); revealed = false; status = `Selected ${scheme()}.`; render() }))
  app.querySelector<HTMLButtonElement>('#query')!.addEventListener('click', query)
  app.querySelector<HTMLButtonElement>('#recover')!.addEventListener('click', recover)
  app.querySelector<HTMLButtonElement>('#reveal')!.addEventListener('click', () => { revealed = true; render() })
  app.querySelector<HTMLSelectElement>('#row-count')!.addEventListener('change', (event) => { rows = makeTable(Number((event.target as HTMLSelectElement).value)); sealed = sealTable(rows); recovered = new Map(); revealed = false; status = 'Dataset reshuffled. Previous recovery retired.'; render() })
}

render()