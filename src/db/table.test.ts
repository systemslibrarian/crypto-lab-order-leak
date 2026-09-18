import { describe, expect, it } from 'vitest'
import { makeTable, sealTable } from './table'

const oreKey = new Uint8Array(32).fill(0x91)

describe('sealed table', () => {
  it('uses randomized AES-GCM ciphertexts for the control', async () => {
    const sealed = await sealTable(makeTable(24), oreKey)
    expect(new Set(sealed.map((row) => row.control))).toHaveLength(sealed.length)
    expect(sealed[0].department).toBe(sealed[1].department)
    expect(sealed[0].control).not.toBe(sealed[1].control)
  })
})