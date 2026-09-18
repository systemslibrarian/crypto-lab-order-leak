import type { SealedRow } from './table'
import { dteEncrypt, toHex } from '../ppe/dte'
import { opeEncrypt } from '../ppe/ope-bclo'
import { oreCompare, oreEncrypt } from '../ppe/ore-clww'

export function encryptedEquality(rows: SealedRow[], department: string) {
  const target = toHex(dteEncrypt(department))
  return rows.filter((row) => row.department === target)
}

export function encryptedAgeRange(rows: SealedRow[], min: number, max: number) {
  return rows.filter((row) => row.age >= opeEncrypt(min) && row.age <= opeEncrypt(max))
}

export function encryptedSalarySort(rows: SealedRow[]) {
  return [...rows].sort((left, right) => oreCompare(left.salary, right.salary))
}

export function encryptedSalaryAtLeast(rows: SealedRow[], salary: number) {
  const target = oreEncrypt(salary)
  return rows.filter((row) => oreCompare(row.salary, target) >= 0)
}