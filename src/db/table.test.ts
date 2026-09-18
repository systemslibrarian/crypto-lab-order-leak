import { describe, expect, it } from 'vitest'
import { makeTable, sealTable } from './table'

const oreKey = new Uint8Array(32).fill(0x91)

describe('sealed table', () => {
  it('uses randomized AES-GCM ciphertexts for the control', async () => {
    const sealed = await sealTable(makeTable(24), oreKey)
    expect(new Set(sealed.map((row) => row.department.control))).toHaveLength(sealed.length)
    expect(sealed[0].department.dte).toBe(sealed[1].department.dte)
    expect(sealed[0].department.ope).toBe(sealed[1].department.ope)
    expect(sealed[0].department.ore).toEqual(sealed[1].department.ore)
    expect(sealed[0].department.control).not.toBe(sealed[1].department.control)
  })

  it('seals every column under every scheme', async () => {
    const [sealed] = await sealTable(makeTable(1), oreKey)
    for (const column of ['department', 'age', 'salary'] as const) {
      expect(sealed[column].dte).toMatch(/^[0-9a-f]+$/)
      expect(sealed[column].ope).toBeTypeOf('number')
      expect(sealed[column].ore.components).toHaveLength(8)
      expect(sealed[column].control).toMatch(/^[0-9a-f]+$/)
    }
  })
})