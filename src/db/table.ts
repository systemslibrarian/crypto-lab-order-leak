import { dteEncrypt, toHex } from '../ppe/dte'
import { createControlKey, randomizedEncrypt } from '../ppe/control'
import { opeEncrypt } from '../ppe/ope-bclo'
import { oreEncrypt, type OreCiphertext } from '../ppe/ore-clww'

export type Person = { id: number; department: string; age: number; salary: number }
export type SealedRow = { id: number; department: string; age: number; salary: OreCiphertext; dte: string; control: string }

const departments = ['Support', 'Support', 'Support', 'Finance', 'Finance', 'Research', 'Research', 'Sales']
const salaryBands = [31, 34, 42, 55, 73, 101, 149, 233]

export function makeTable(size = 240): Person[] {
  return Array.from({ length: size }, (_, index) => ({
    id: index + 1,
    department: departments[index % departments.length],
    age: 20 + (index % 46),
    salary: salaryBands[(index * 5) % salaryBands.length],
  }))
}

export async function sealTable(rows: Person[], oreKey: Uint8Array): Promise<SealedRow[]> {
  const controlKey = await createControlKey()
  return Promise.all(rows.map(async (row) => ({
    id: row.id,
    department: toHex(dteEncrypt(row.department)),
    age: opeEncrypt(row.age),
    salary: oreEncrypt(oreKey, row.salary),
    dte: toHex(dteEncrypt(`${row.department}:${row.age}:${row.salary}`)),
    control: await randomizedEncrypt(row.department, controlKey),
  })))
}