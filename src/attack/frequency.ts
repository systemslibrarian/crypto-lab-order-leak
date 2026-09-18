export type CiphertextObservation = { id: number; ciphertext: string }

export function frequencyRecover(observations: CiphertextObservation[], auxiliary: Record<string, number>) {
  const groups = new Map<string, number[]>()
  observations.forEach(({ id, ciphertext }) => groups.set(ciphertext, [...(groups.get(ciphertext) ?? []), id]))
  const cipherGroups = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)
  const publicGroups = Object.entries(auxiliary).sort((a, b) => b[1] - a[1])
  if (cipherGroups.length !== publicGroups.length) throw new Error('Auxiliary support mismatch: the public table has different categories.')
  const output = new Map<number, string | null>()
  cipherGroups.forEach(([ciphertext, ids], index) => {
    const tied = cipherGroups.filter((group) => group[1].length === ids.length).length > 1 || publicGroups.filter((group) => group[1] === publicGroups[index][1]).length > 1
    ids.forEach((id) => output.set(id, tied ? null : publicGroups[index][0]))
  })
  return output
}