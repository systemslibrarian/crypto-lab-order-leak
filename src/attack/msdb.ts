import type { OreCiphertext } from '../ppe/ore-clww'
import { oreCompare, msdbDepth } from '../ppe/ore-clww'

export function recoverOreOrder(observations: { id: number; ciphertext: OreCiphertext }[]) {
  const ordered = [...observations].sort((left, right) => oreCompare(left.ciphertext, right.ciphertext))
  return ordered.map((row, index) => ({ id: row.id, rank: index + 1, split: index === 0 ? null : msdbDepth(ordered[index - 1].ciphertext, row.ciphertext) }))
}