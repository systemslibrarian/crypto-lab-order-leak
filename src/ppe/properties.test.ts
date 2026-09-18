import { describe, expect, it } from 'vitest'
import { opeEncrypt } from './ope-bclo'
import { oreCompare, oreEncrypt } from './ore-clww'

describe('property-preserving primitives', () => {
  it('OPE is strictly monotone over its full 8-bit toy domain', () => {
    for (let value = 0; value < 255; value++) expect(opeEncrypt(value)).toBeLessThan(opeEncrypt(value + 1))
  })
  it('ORE compares random pairs correctly', () => {
    for (let value = 0; value < 256; value++) expect(oreCompare(oreEncrypt(value), oreEncrypt(255 - value))).toBe(Math.sign(value - (255 - value)))
  })
  it('rejects values outside the OPE domain', () => expect(() => opeEncrypt(256)).toThrow(RangeError))
})