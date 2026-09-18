import { describe, expect, it } from 'vitest'
import { oreEncrypt } from '../ppe/ore-clww'
import { recoverOreTree, type OreTreeNode } from './msdb'

const key = new Uint8Array(32).fill(0x37)

function leafIds(node: OreTreeNode | null): number[] {
  if (!node) return []
  return node.kind === 'leaf' ? node.ids : [...leafIds(node.left), ...leafIds(node.right)]
}

describe('pairwise MSDB tree recovery', () => {
  it('reconstructs ordered leaves and binary split depths from every pair', () => {
    const values = [255, 2, 0, 128, 3, 1]
    const result = recoverOreTree(values.map((value, index) => ({ id: index + 1, ciphertext: oreEncrypt(key, value) })))

    expect(result.pairs).toHaveLength(15)
    expect(result.tree).toMatchObject({ kind: 'branch', depth: 0 })
    expect(leafIds(result.tree)).toEqual([3, 6, 2, 5, 4, 1])
    expect(result.tree?.kind === 'branch' && result.tree.left).toMatchObject({ kind: 'branch', depth: 6 })
    expect(result.pairs.find(({ leftId, rightId }) => leftId === 2 && rightId === 5)).toMatchObject({ order: -1, depth: 7 })
  })

  it('groups equal observations into one leaf', () => {
    const result = recoverOreTree([
      { id: 1, ciphertext: oreEncrypt(key, 42) },
      { id: 2, ciphertext: oreEncrypt(key, 42) },
    ])
    expect(result.tree).toEqual({ kind: 'leaf', ids: [1, 2] })
    expect(result.pairs).toEqual([{ leftId: 1, rightId: 2, order: 0, depth: null }])
  })
})