import { describe, expect, it, vi } from 'vitest'
import { aesGcmSivEncrypt, dteDecrypt, dteEncrypt, dteSessionKey, dteSessionNonce, dteTagVerifies, toHex } from './dte'

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

  it('draws fresh session key material instead of shipping a constant', async () => {
    expect(dteSessionKey()).toHaveLength(32)
    expect(dteSessionNonce()).toHaveLength(12)
    expect(new Set(dteSessionKey()).size).toBeGreaterThan(1)
    expect(new Set(dteSessionNonce()).size).toBeGreaterThan(1)

    vi.resetModules()
    const reloaded = await import('./dte')
    expect([...reloaded.dteSessionKey()]).not.toEqual([...dteSessionKey()])
    expect([...reloaded.dteSessionNonce()]).not.toEqual([...dteSessionNonce()])
  })

  it.each([
    ['AES-128', '01000000000000000000000000000000', 'dc20e2d83f25705bb49e439eca56de25'],
    ['AES-256', '0100000000000000000000000000000000000000000000000000000000000000', '07f5f4169bbf55a8400cd47ea6fd400f'],
  ])('passes the RFC 8452 %s empty-plaintext KAT', (_name, key, expected) => {
    expect(toHex(aesGcmSivEncrypt(fromHex(key), fromHex('030000000000000000000000'), new Uint8Array()))).toBe(expected)
  })
})