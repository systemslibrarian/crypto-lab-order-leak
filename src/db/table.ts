import { dteEncrypt, toHex } from '../ppe/dte'
import { opeEncrypt } from '../ppe/ope-bclo'
import { oreEncrypt, type OreCiphertext } from '../ppe/ore-clww'

export type Person = { id: number; department: string; age: number; salary: number }
export type SealedRow = { id: number; department: string; age: number; salary: OreCiphertext; dte: string }

const departments = ['Support', 'Support', 'Support', 'Finance', 'Finance', 'Research', 'Research', 'Sales']

export function makeTable(size = 240): Person[] {
  return Array.from({ length: size }, (_, index) => ({
    id: index + 1,
    department: departments[index % departments.length],
    age: 20 + (index % 46),
    salary: 30 + ((index * 37) % 210),
  }))
}

export function sealTable(rows: Person[]): SealedRow[] {
  return rows.map((row) => ({
    id: row.id,
    department: toHex(dteEncrypt(row.department)),
    age: opeEncrypt(row.age),
    salary: oreEncrypt(row.salary),
    dte: toHex(dteEncrypt(`${row.department}:${row.age}:${row.salary}`)),
  }))
}

export function publicDistribution(rows: Person[]) {
  return rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.department] = (counts[row.department] ?? 0) + 1
    return counts
  }, {})
}