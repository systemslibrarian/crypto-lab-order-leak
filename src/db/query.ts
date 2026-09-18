import { oreCompare, type OreCiphertext } from '../ppe/ore-clww'
import type { DataColumn, SealedRow } from './table'

export type QueryableScheme = 'dte' | 'ope' | 'ore'
type QueryToken = string | number | OreCiphertext

function compareToken(scheme: QueryableScheme, left: QueryToken, right: QueryToken): number {
  if (scheme === 'dte') return String(left).localeCompare(String(right))
  if (scheme === 'ope') return Number(left) - Number(right)
  return oreCompare(left as OreCiphertext, right as OreCiphertext)
}

export function encryptedEquality(rows: SealedRow[], column: DataColumn, scheme: QueryableScheme, target: QueryToken) {
  return rows.filter((row) => compareToken(scheme, row[column][scheme], target) === 0)
}

export function encryptedRange(rows: SealedRow[], column: DataColumn, scheme: Exclude<QueryableScheme, 'dte'>, minimum: QueryToken, maximum: QueryToken) {
  return rows.filter((row) => compareToken(scheme, row[column][scheme], minimum) >= 0 && compareToken(scheme, row[column][scheme], maximum) <= 0)
}

export function encryptedSort(rows: SealedRow[], column: DataColumn, scheme: Exclude<QueryableScheme, 'dte'>) {
  return [...rows].sort((left, right) => compareToken(scheme, left[column][scheme], right[column][scheme]))
}