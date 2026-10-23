import { describe, expect, it } from 'vitest'
import { publicAgeValues } from './public'

describe('public age populations', () => {
  it('matches the sealed age cycle by default', () => {
    const values = publicAgeValues(240)
    expect(values).toHaveLength(240)
    expect(values[0]).toBe(20)
    expect(values.at(-1)).toBe(65)
  })

  it('shifts probability mass without changing the dense support', () => {
    const matching = publicAgeValues(240)
    const shifted = publicAgeValues(240, 'shifted')
    expect(shifted).toHaveLength(matching.length)
    expect(new Set(shifted)).toEqual(new Set(matching))
    expect(shifted).not.toEqual(matching)
    expect(shifted.filter((age) => age === 65).length).toBeGreaterThan(matching.filter((age) => age === 65).length)
  })

  it('makes the mismatched population fail by support rather than by a label', () => {
    const mismatch = publicAgeValues(240, 'mismatch')
    expect(mismatch).not.toContain(65)
    expect(mismatch).toHaveLength(235)
  })
})
