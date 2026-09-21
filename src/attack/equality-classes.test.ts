import { describe, expect, it } from 'vitest'
import { equalityClasses } from './equality-classes'
import { createControlKey, randomizedEncrypt } from '../ppe/control'
import { dteEncrypt, toHex } from '../ppe/dte'
import { makeTable } from '../db/table'

describe('equality classes', () => {
  it('finds no reusable bucket in a randomized column', async () => {
    const key = await createControlKey()
    const rows = makeTable(24)
    const observations = await Promise.all(
      rows.map(async (row) => ({ id: row.id, ciphertext: await randomizedEncrypt(`department:${row.department}`, key) })),
    )
    const classes = equalityClasses(observations)
    expect(classes.distinct).toBe(24)
    expect(classes.reusable).toBe(0)
    expect(classes.largest).toBe(1)
  })

  it('collapses a deterministic column onto its plaintext support', () => {
    const rows = makeTable(24)
    const observations = rows.map((row) => ({ id: row.id, ciphertext: toHex(dteEncrypt(`department:${row.department}`)) }))
    const classes = equalityClasses(observations)
    expect(classes.distinct).toBe(4)
    expect(classes.reusable).toBe(4)
    expect(classes.largest).toBe(9)
  })
})
