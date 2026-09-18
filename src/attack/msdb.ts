export type OreObservation = { components: readonly number[] }

function msdbDepth(left: OreObservation, right: OreObservation): number | null {
  const match = left.components.findIndex((component, index) => component !== right.components[index])
  return match === -1 ? null : match
}

function compare(left: OreObservation, right: OreObservation): number {
  const index = msdbDepth(left, right)
  if (index === null) return 0
  return right.components[index] === (left.components[index] + 1) % 3 ? -1 : 1
}

export function recoverOreOrder(observations: { id: number; ciphertext: OreObservation }[]) {
  const ordered = [...observations].sort((left, right) => compare(left.ciphertext, right.ciphertext))
  return ordered.map((row, index) => ({ id: row.id, rank: index + 1, split: index === 0 ? null : msdbDepth(ordered[index - 1].ciphertext, row.ciphertext) }))
}