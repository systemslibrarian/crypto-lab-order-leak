import { describe, expect, it } from 'vitest'
import { opeEncrypt } from '../ppe/ope-bclo'
import { oreEncrypt } from '../ppe/ore-clww'
import { encryptedEquality, encryptedRange, encryptedSort } from './query'
import { makeTable, sealTable } from './table'

const key = new Uint8Array(32).fill(0x91)

describe('ciphertext-only matrix queries', () => {
  it('runs equality over DTE and order queries over OPE and ORE on any column', async () => {
    const rows = makeTable(24)
    const sealed = await sealTable(rows, key)
    expect(encryptedEquality(sealed, 'department', 'dte', sealed[0].department.dte)).toHaveLength(9)
    expect(encryptedRange(sealed, 'age', 'ope', opeEncrypt(30), opeEncrypt(40))).toHaveLength(11)
    expect(encryptedSort(sealed, 'salary', 'ore').map((row) => rows[row.id - 1].salary)).toEqual(
      [...rows.map((row) => row.salary)].sort((left, right) => left - right),
    )
    expect(encryptedEquality(sealed, 'salary', 'ore', oreEncrypt(key, 101))).toHaveLength(3)
  })
})