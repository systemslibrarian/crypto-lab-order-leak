import { describe, expect, it } from 'vitest'
import { compareRecovery } from './compare'

describe('recovery scoring', () => {
  it('classifies matched, mismatched, and unresolved cells independently', () => {
    expect(compareRecovery(['a', 'b', 'c', 'd'], new Map([[1, 'a'], [2, 'b'], [3, 'wrong'], [4, null]]))).toEqual({
      matched: 2,
      mismatched: 1,
      unresolved: 1,
      rows: 4,
    })
  })

  it('always partitions the full row count', () => {
    const score = compareRecovery([1, 2, 3, 4], new Map([[1, 1], [2, 9]]))
    expect(score.matched + score.mismatched + score.unresolved).toBe(score.rows)
  })
})