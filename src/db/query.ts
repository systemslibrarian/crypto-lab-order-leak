import type { SealedRow } from './table'
import { oreCompare, type OreCiphertext } from '../ppe/ore-clww'

export function encryptedEquality(rows: SealedRow[], target: string) {
  return rows.filter((row) => row.department === target)
}

export function encryptedAgeRange(rows: SealedRow[], encryptedMin: number, encryptedMax: number) {
  return rows.filter((row) => row.age >= encryptedMin && row.age <= encryptedMax)
}

export function encryptedSalarySort(rows: SealedRow[]) {
  return [...rows].sort((left, right) => oreCompare(left.salary, right.salary))
}

export function encryptedSalaryAtLeast(rows: SealedRow[], target: OreCiphertext) {
  return rows.filter((row) => oreCompare(row.salary, target) >= 0)
}