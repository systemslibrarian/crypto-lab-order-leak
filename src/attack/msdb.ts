export type OreObservation = { orderCode: number; prefixTags: string[] }

function msdbDepth(left: OreObservation, right: OreObservation): number | null {
  const match = left.prefixTags.findIndex((prefix, index) => prefix !== right.prefixTags[index])
  return match === -1 ? null : match
}

export function recoverOreOrder(observations: { id: number; ciphertext: OreObservation }[]) {
  const ordered = [...observations].sort((left, right) => left.ciphertext.orderCode - right.ciphertext.orderCode)
  return ordered.map((row, index) => ({ id: row.id, rank: index + 1, split: index === 0 ? null : msdbDepth(ordered[index - 1].ciphertext, row.ciphertext) }))
}