import type { CiphertextObservation } from './frequency'

export type EqualityClasses = {
  /** ciphertext -> the row ids that share it. */
  buckets: Map<string, number[]>
  /** how many distinct ciphertexts the column shows. */
  distinct: number
  /** how many buckets hold more than one row, i.e. are usable for a count match. */
  reusable: number
  /** the largest bucket, in rows. */
  largest: number
}

/**
 * Group a sealed column by ciphertext equality.
 *
 * This is the measurement the randomized control has to survive. A frequency
 * attack needs buckets whose sizes can be matched against public counts; if
 * every ciphertext is distinct, every bucket has size one and there is nothing
 * to align. Running it and reading the number is the difference between the
 * page reporting a result and the page asserting one.
 */
export function equalityClasses(observations: CiphertextObservation[]): EqualityClasses {
  const buckets = new Map<string, number[]>()
  observations.forEach(({ id, ciphertext }) => buckets.set(ciphertext, [...(buckets.get(ciphertext) ?? []), id]))
  const sizes = [...buckets.values()].map((ids) => ids.length)
  return {
    buckets,
    distinct: buckets.size,
    reusable: sizes.filter((size) => size > 1).length,
    largest: sizes.length ? Math.max(...sizes) : 0,
  }
}
