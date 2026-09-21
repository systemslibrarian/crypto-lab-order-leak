import { oreCompare, type OreCiphertext } from '../ppe/ore-clww'
import type { DataColumn, SealedRow } from './table'

export type QueryableScheme = 'dte' | 'ope' | 'ore'
/**
 * Every scheme a sealed cell carries, including the randomized control.
 *
 * The control is listed here on purpose. It cannot answer a range or a sort,
 * but it CAN be handed to the same equality query as DTE -- and must be, or the
 * page's claim that randomized encryption defeats the query is an assertion
 * about a branch that was never taken rather than a measurement.
 */
export type SealScheme = QueryableScheme | 'control'
type QueryToken = string | number | OreCiphertext

function compareToken(scheme: SealScheme, left: QueryToken, right: QueryToken): number {
  if (scheme === 'dte' || scheme === 'control') return String(left).localeCompare(String(right))
  if (scheme === 'ope') return Number(left) - Number(right)
  return oreCompare(left as OreCiphertext, right as OreCiphertext)
}

export function encryptedEquality(rows: SealedRow[], column: DataColumn, scheme: SealScheme, target: QueryToken) {
  return rows.filter((row) => compareToken(scheme, row[column][scheme], target) === 0)
}

export function encryptedRange(rows: SealedRow[], column: DataColumn, scheme: Exclude<QueryableScheme, 'dte'>, minimum: QueryToken, maximum: QueryToken) {
  return rows.filter((row) => compareToken(scheme, row[column][scheme], minimum) >= 0 && compareToken(scheme, row[column][scheme], maximum) <= 0)
}

export function encryptedSort(rows: SealedRow[], column: DataColumn, scheme: Exclude<QueryableScheme, 'dte'>) {
  return [...rows].sort((left, right) => compareToken(scheme, left[column][scheme], right[column][scheme]))
}
