import { describe, expect, it } from 'vitest'
import { opeEncrypt, sampleHypergeometric } from './ope-bclo'
import { oreCompare, oreEncrypt, oreMsdb, oreSetup, serializeOre, validateOreCiphertext } from './ore-clww'

const oreKey = new Uint8Array(32).fill(0x91)

describe('property-preserving primitives', () => {
  it('OPE is strictly monotone over its full 8-bit toy domain', () => {
    for (let value = 0; value < 255; value++) expect(opeEncrypt(value)).toBeLessThan(opeEncrypt(value + 1))
  })
  it('CLWW compares every pair in the full 8-bit domain correctly', () => {
    const ciphertexts = Array.from({ length: 256 }, (_, value) => oreEncrypt(oreKey, value))
    for (let left = 0; left < 256; left++) {
      for (let right = 0; right < 256; right++) {
        expect(oreCompare(ciphertexts[left], ciphertexts[right])).toBe(Math.sign(left - right))
      }
    }
  })
  it('CLWW ciphertexts contain eight trits and serialize to two bytes', () => {
    const ciphertext = oreEncrypt(oreKey, 173)
    expect(Object.keys(ciphertext)).toEqual(['components'])
    expect(ciphertext.components).toHaveLength(8)
    expect(ciphertext.components.every((component) => [0, 1, 2].includes(component))).toBe(true)
    expect(serializeOre(ciphertext)).toMatch(/^[0-9a-f]{4}$/)
  })
  it('CLWW leaks exactly the first differing plaintext-bit position', () => {
    for (let left = 0; left < 256; left += 7) {
      for (let right = 0; right < 256; right += 11) {
        const expected = left === right ? null : Math.clz32(left ^ right) - 24
        expect(oreMsdb(oreEncrypt(oreKey, left), oreEncrypt(oreKey, right))).toBe(expected)
      }
    }
  })
  it('CLWW rejects malformed ciphertexts and creates fresh session keys', () => {
    expect(() => validateOreCiphertext({ components: [0, 1, 3] })).toThrow(TypeError)
    const first = oreSetup()
    const second = oreSetup()
    expect(first).toHaveLength(32)
    expect(first).not.toEqual(second)
  })
  it('the exact hypergeometric sampler stays inside its mathematical support', () => {
    expect(sampleHypergeometric(10, 3, 9, 'forced-support')).toBeGreaterThanOrEqual(2)
    expect(sampleHypergeometric(10, 3, 9, 'forced-support')).toBeLessThanOrEqual(3)
  })
  it('rejects values outside the OPE domain', () => expect(() => opeEncrypt(256)).toThrow(RangeError))
})