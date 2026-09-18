import { describe, expect, it } from 'vitest'
import frequencySource from './frequency.ts?raw'
import sortingSource from './sorting.ts?raw'
import cumulativeSource from './cumulative.ts?raw'
import msdbSource from './msdb.ts?raw'

describe('attacker module boundary', () => {
  it('imports neither key material, plaintext tables, nor scoring truth', () => {
    for (const source of [frequencySource, sortingSource, cumulativeSource, msdbSource]) {
      expect(source).not.toMatch(/from ['"]\.\.\/(ppe|db|score)/)
      expect(source).not.toMatch(/KEY|plaintext|Person|SealedRow/)
    }
  })
})