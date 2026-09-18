import { describe, expect, it } from 'vitest'
import { cumulativeRecover } from './cumulative'

const compare = (left: number, right: number) => left - right

describe('cumulative attack', () => {
  it('matches repeated ciphertext buckets by empirical cumulative frequency', () => {
    const observations = [
      { id: 1, ciphertext: 90 },
      { id: 2, ciphertext: 10 },
      { id: 3, ciphertext: 50 },
      { id: 4, ciphertext: 10 },
      { id: 5, ciphertext: 90 },
      { id: 6, ciphertext: 10 },
    ]
    expect(cumulativeRecover(observations, [31, 31, 31, 73, 101, 101], compare)).toEqual(new Map([
      [2, 31], [4, 31], [6, 31], [3, 73], [1, 101], [5, 101],
    ]))
  })

  it('leaves an equal-distance cumulative match unresolved', () => {
    const recovered = cumulativeRecover([
      { id: 1, ciphertext: 10 },
      { id: 2, ciphertext: 10 },
      { id: 3, ciphertext: 20 },
      { id: 4, ciphertext: 30 },
    ], [1, 2, 2, 3], compare)
    expect(recovered.get(1)).toBeNull()
  })

  it('rejects auxiliary support mismatches by name', () => {
    expect(() => cumulativeRecover([
      { id: 1, ciphertext: 10 },
      { id: 2, ciphertext: 20 },
    ], [1, 1], compare)).toThrow('Auxiliary support mismatch')
  })
})