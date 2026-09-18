import { describe, expect, it } from 'vitest'
import { aesGcmSivEncrypt, dteDecrypt, dteEncrypt, dteTagVerifies, toHex } from './dte'

const fromHex = (hex: string) => Uint8Array.from(hex.match(/.{2}/g)!.map((part) => parseInt(part, 16)))

describe('deterministic AES-GCM-SIV', () => {
  it('round-trips and repeats exactly for a fixed nonce', () => {
    const first = dteEncrypt('Finance')
    expect(dteDecrypt(first)).toBe('Finance')
    expect(toHex(first)).toBe(toHex(dteEncrypt('Finance')))
  })

  it('rejects a modified authentication tag', () => {
    const ciphertext = dteEncrypt('Finance')
    ciphertext[ciphertext.length - 1] ^= 1
    expect(dteTagVerifies(ciphertext)).toBe(false)
  })

  it.each([
    ['AES-128', '01000000000000000000000000000000', 'dc20e2d83f25705bb49e439eca56de25'],
    ['AES-256', '0100000000000000000000000000000000000000000000000000000000000000', '07f5f4169bbf55a8400cd47ea6fd400f'],
  ])('passes the RFC 8452 %s empty-plaintext KAT', (_name, key, expected) => {
    expect(toHex(aesGcmSivEncrypt(fromHex(key), fromHex('030000000000000000000000'), new Uint8Array()))).toBe(expected)
  })
})