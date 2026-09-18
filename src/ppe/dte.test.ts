import { describe, expect, it } from 'vitest'
import { dteDecrypt, dteEncrypt, dteTagVerifies, toHex } from './dte'

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
})