import './styles.css'
import { frequencyRecover } from './attack/frequency'
import { recoverOreOrder } from './attack/msdb'
import { sortingRecover } from './attack/sorting'
import { encryptedAgeRange, encryptedEquality, encryptedSalaryAtLeast, encryptedSalarySort } from './db/query'
import { makeTable, sealTable, type Person } from './db/table'
import { publicAgeValues, publicDepartmentDistribution, publicSalaryValues } from './data/public'
import { dteEncrypt, dteTagVerifies, toHex } from './ppe/dte'
import { opeEncrypt } from './ppe/ope-bclo'
import { oreEncrypt, oreSetup, serializeOre } from './ppe/ore-clww'
import { compareRecovery } from './score/compare'

const app = document.querySelector<HTMLElement>('#app')!
const oreKey = oreSetup()
let rows = makeTable(240)
let sealed = await sealTable(rows, oreKey)
let revealed = false
let recovered = new Map<number, string | number | null>()
let mode: 'department' | 'age' | 'salary' | 'control' = 'department'
let auxiliaryShifted = false
let status = 'Choose a property-preserving column, then make the database answer a query without decrypting.'

const abbreviate = (value: string | number) => String(value).length > 15 ? `${String(value).slice(0, 15)}...` : String(value)
const selected = () => rows.slice(0, 18)
const actual = (row: Person) => mode === 'department' ? row.department : mode === 'age' ? row.age : row.salary
const scheme = () => ({ department: 'Deterministic AES-GCM-SIV', age: 'BCLO toy OPE', salary: 'Binary CLWW ORE', control: 'AES-GCM randomized control' }[mode])

function query() {
  if (mode === 'department') status = `Equality query matched ${encryptedEquality(sealed, toHex(dteEncrypt('Finance'))).length} sealed rows; the server compared a client-generated token.`
  if (mode === 'age') status = `Range query 30-40 matched ${encryptedAgeRange(sealed, opeEncrypt(30), opeEncrypt(40)).length} sealed rows; ciphertext order answered it.`
  if (mode === 'salary') status = `ORDER BY and salary >= 120 both work: ${encryptedSalarySort(sealed).length} ordered, ${encryptedSalaryAtLeast(sealed, oreEncrypt(oreKey, 120)).length} matched.`
  if (mode === 'control') status = 'Cannot sort ciphertexts or run equality queries on randomized AES-GCM. Each encryption is intentionally different.'
  render()
}

function recover() {
  recovered = new Map()
  if (mode === 'department') recovered = frequencyRecover(sealed.map((row) => ({ id: row.id, ciphertext: row.department })), publicDepartmentDistribution(rows.length, auxiliaryShifted))
  if (mode === 'age') recovered = sortingRecover(sealed.map((row) => ({ id: row.id, ciphertext: row.age })), publicAgeValues(rows.length))
  if (mode === 'salary') recovered = new Map(recoverOreOrder(sealed.map((row) => ({ id: row.id, ciphertext: row.salary }))).map(({ id, rank }) => [id, publicSalaryValues(rows.length)[rank - 1]]))
  if (mode === 'control') status = 'NOTHING RECOVERED: randomized ciphertexts carry no stable equality or order relation.'
  else status = `Recovery ran against ciphertexts and ${auxiliaryShifted ? 'a shifted' : 'the matching synthetic'} public population only. No key was imported by the attacker module.`
  revealed = false
  render()
}

function score() {
  return compareRecovery(rows.map(actual), recovered)
}

function render() {
  const publicBars = Object.entries(publicDepartmentDistribution(rows.length, auxiliaryShifted)).map(([name, count]) => `<div class="bar-row"><span>${name}</span><i style="width:${(count / rows.length) * 100}%"></i><b>${count}</b></div>`).join('')
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
    </div><div class="control-pair"><label>Rows <select id="row-count"><option value="24" ${rows.length === 24 ? 'selected' : ''}>24 (tiny)</option><option value="240" ${rows.length === 240 ? 'selected' : ''}>240</option><option value="500" ${rows.length === 500 ? 'selected' : ''}>500</option><option value="1000" ${rows.length === 1000 ? 'selected' : ''}>1,000</option></select></label><label>Public population <select id="population"><option value="matching" ${!auxiliaryShifted ? 'selected' : ''}>Matching synthetic</option><option value="shifted" ${auxiliaryShifted ? 'selected' : ''}>Shifted population</option></select></label></div></section>
    ${rows.length < 30 ? '<p class="warning" role="status">SAMPLE WARNING: fewer than 30 rows makes frequency statistics unstable. Treat this result as an illustration, not evidence.</p>' : ''}
    <section class="lab-grid">
      <article class="panel dba"><div class="panel-title"><span>DBA VIEW</span><small>${scheme()} · leaky by design</small></div><p>The database sees sealed values and never needs the plaintext key to evaluate the selected relation.</p><button class="command" id="query" ${isControl ? '' : ''}>${isControl ? 'Try a query' : 'Run query on ciphertexts'}</button><output class="status neutral" role="status" aria-live="polite">${status}</output>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Sealed database rows"><table><thead><tr><th>ROW</th><th>SEALED VALUE</th><th>PROPERTY</th></tr></thead><tbody>${selected().map((row) => `<tr><td>${row.id}</td><td class="cipher">${abbreviate(mode === 'department' ? sealed[row.id - 1].department : mode === 'age' ? sealed[row.id - 1].age : mode === 'salary' ? serializeOre(sealed[row.id - 1].salary) : sealed[row.id - 1].control)}</td><td>${isControl ? 'none' : mode === 'department' ? '=' : 'order'}</td></tr>`).join('')}</tbody></table></div></article>
      <article class="panel attacker"><div class="panel-title"><span>ATTACKER VIEW</span><small>ciphertexts + public statistics</small></div><p>There is no key here. ${mode === 'department' ? 'Frequency matching aligns encrypted bucket sizes to a public census.' : mode === 'age' ? 'Sorting aligns a dense ordered column to sorted public values.' : mode === 'salary' ? 'Pairwise MSDB leakage reconstructs the ORE comparison tree.' : 'Randomized AES-GCM provides no comparable signal.'}</p>
      <div class="histogram" role="group" aria-label="Public distribution">${publicBars}</div><button class="command alarm" id="recover">Run recovery</button>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Recovered attacker rows"><table><thead><tr><th>ROW</th><th>RECOVERED</th><th>VERDICT</th></tr></thead><tbody>${selected().map((row) => { const guess = recovered.get(row.id); const verdict = !revealed ? (guess === undefined ? 'WAITING' : guess === null ? '? AMBIGUOUS' : '! RECOVERED') : guess === actual(row) ? '! RECOVERED' : guess == null ? '? AMBIGUOUS' : '! MISMATCH'; return `<tr><td>${row.id}</td><td>${guess === undefined ? '—' : guess === null ? 'ambiguous' : guess}</td><td class="${verdict.includes('RECOVERED') ? 'alarm-text' : verdict.includes('AMBIGUOUS') ? 'amber-text' : ''}">${verdict}</td></tr>` }).join('')}</tbody></table></div>
      <div class="reveal"><button class="command secondary" id="reveal" ${recovered.size || isControl ? '' : 'disabled'}>Reveal sealed truth</button>${revealed ? `<strong class="${isControl ? 'control-ok' : 'alarm-text'}" data-score="${scorecard.matched}/${rows.length}">${isControl ? 'NOTHING RECOVERED' : `${scorecard.matched} MATCHED · ${scorecard.mismatched} MISMATCHED · ${scorecard.unresolved} AMBIGUOUS`}</strong>` : ''}</div></article>
    </section>
    <section class="evidence"><h2>Authenticated, never decrypted, and recovered</h2><p>Every deterministic AES-GCM-SIV department ciphertext in this fixture has a valid authentication tag: <strong>${sealed.every((row) => dteTagVerifies(Uint8Array.from(row.department.match(/.{1,2}/g)!.map((part) => parseInt(part, 16))))) ? 'TAGS VERIFIED' : 'TAG FAILURE'}</strong>. The query module holds no key, an equality query still succeeds, and the frequency attack recovers cells from public counts. Confidentiality here covers the value, not the equality the scheme was configured to expose.</p></section>
    <details><summary>Method notes and limits</summary><p>The BCLO teaching profile uses exact hypergeometric recursive splitting over an 8-bit plaintext to 16-bit ciphertext domain. Binary CLWW emits eight HMAC-SHA-256-derived trits in Z_3; comparison reveals order and the first differing plaintext-bit position without a scalar order code. The concrete PRF input encoding is this lab's 8-bit profile, not a standardized wire format. Tiny samples are unstable, and a shifted auxiliary population degrades recovery.</p></details>
    <footer class="scripture-footer"><p>So whether you eat or drink or whatever you do, do it all for the glory of God. — 1 Corinthians 10:31</p></footer>`
  app.querySelectorAll<HTMLButtonElement>('[data-mode]').forEach((button) => button.addEventListener('click', () => {
    const nextMode = button.dataset.mode as typeof mode
    if (nextMode === mode) return
    mode = nextMode
    recovered = new Map()
    revealed = false
    status = `Selected ${scheme()}. Previous recovery retired.`
    render()
  }))
  app.querySelector<HTMLButtonElement>('#query')!.addEventListener('click', query)
  app.querySelector<HTMLButtonElement>('#recover')!.addEventListener('click', recover)
  app.querySelector<HTMLButtonElement>('#reveal')!.addEventListener('click', () => { revealed = true; render() })
  app.querySelector<HTMLSelectElement>('#row-count')!.addEventListener('change', async (event) => { rows = makeTable(Number((event.target as HTMLSelectElement).value)); sealed = await sealTable(rows, oreKey); recovered = new Map(); revealed = false; status = 'Dataset reshuffled. Previous recovery retired.'; render() })
  app.querySelector<HTMLSelectElement>('#population')!.addEventListener('change', (event) => { auxiliaryShifted = (event.target as HTMLSelectElement).value === 'shifted'; recovered = new Map(); revealed = false; status = 'Auxiliary population changed. Previous recovery retired.'; render() })
}

render()