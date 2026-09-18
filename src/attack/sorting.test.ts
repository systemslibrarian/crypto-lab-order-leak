import { describe, expect, it } from 'vitest'
import { sortingRecover } from './sorting'

describe('sorting attack', () => {
  it('recovers dense support and rejects sparse support explicitly', () => {
    const observations = [{ id: 1, ciphertext: 30 }, { id: 2, ciphertext: 10 }, { id: 3, ciphertext: 20 }]
    expect(sortingRecover(observations, [40, 41, 42])).toEqual(new Map([[2, 40], [3, 41], [1, 42]]))
    expect(() => sortingRecover(observations, [31, 73, 233])).toThrow('Sorting attack incomplete: sparse support')
  })
})