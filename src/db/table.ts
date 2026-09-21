import { dteEncrypt, toHex } from '../ppe/dte'
import { createControlKey, randomizedEncrypt } from '../ppe/control'
import { opeEncrypt } from '../ppe/ope-bclo'
import { oreEncrypt, type OreCiphertext } from '../ppe/ore-clww'

export type Person = { id: number; department: string; age: number; salary: number }
export type DataColumn = 'department' | 'age' | 'salary'
export type SealedCell = { dte: string; ope: number; ore: OreCiphertext; control: string }
export type SealedRow = { id: number; department: SealedCell; age: SealedCell; salary: SealedCell }

const departments = ['Support', 'Support', 'Support', 'Finance', 'Finance', 'Research', 'Research', 'Sales']
const salaryBands = [31, 34, 42, 55, 73, 101, 149, 233]
export const departmentDomain = ['Support', 'Finance', 'Research', 'Sales'] as const

export function encodeColumnValue(column: DataColumn, value: string | number): number {
  if (column !== 'department') return Number(value)
  const code = departmentDomain.indexOf(value as typeof departmentDomain[number])
  if (code === -1) throw new RangeError(`Unknown department: ${value}.`)
  return code
}

export function makeTable(size = 240): Person[] {
  return Array.from({ length: size }, (_, index) => ({
    id: index + 1,
    department: departments[index % departments.length],
    age: 20 + (index % 46),
    salary: salaryBands[(index * 5) % salaryBands.length],
  }))
}

export type SealedTable = { rows: SealedRow[]; controlKey: CryptoKey }

/**
 * Seal the table and hand back the control key with it.
 *
 * The key has to escape. Without it the page cannot encrypt a query token for
 * the randomized column, and the control exhibit degenerates into a literal
 * string claiming the query failed -- which is what it used to be.
 */
export async function sealTableWithKey(rows: Person[], oreKey: Uint8Array): Promise<SealedTable> {
  const controlKey = await createControlKey()
  const sealed = await Promise.all(rows.map(async (row) => {
    const sealCell = async (column: DataColumn, value: string | number): Promise<SealedCell> => {
      const encoded = encodeColumnValue(column, value)
      return {
        dte: toHex(dteEncrypt(`${column}:${value}`)),
        ope: opeEncrypt(encoded),
        ore: oreEncrypt(oreKey, encoded),
        control: await randomizedEncrypt(`${column}:${value}`, controlKey),
      }
    }
    return {
      id: row.id,
      department: await sealCell('department', row.department),
      age: await sealCell('age', row.age),
      salary: await sealCell('salary', row.salary),
    }
  }))
  return { rows: sealed, controlKey }
}

export async function sealTable(rows: Person[], oreKey: Uint8Array): Promise<SealedRow[]> {
  return (await sealTableWithKey(rows, oreKey)).rows
}