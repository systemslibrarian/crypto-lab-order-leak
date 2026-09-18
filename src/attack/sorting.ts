export function sortingRecover<T extends { id: number; ciphertext: number }>(observations: T[], sortedPublicValues: number[]) {
  if (observations.length !== sortedPublicValues.length) throw new Error('Auxiliary table size does not match the sealed column.')
  if (new Set(observations.map(({ ciphertext }) => ciphertext)).size !== new Set(sortedPublicValues).size) throw new Error('Auxiliary support mismatch: the public table has a different numeric support.')
  const support = [...new Set(sortedPublicValues)].sort((left, right) => left - right)
  if (support.some((value, index) => index > 0 && value !== support[index - 1] + 1)) {
    throw new Error(`Sorting attack incomplete: sparse support has ${support.length} observed values across ${support.at(-1)! - support[0] + 1} possible integers.`)
  }
  return new Map([...observations].sort((a, b) => a.ciphertext - b.ciphertext).map((row, index) => [row.id, sortedPublicValues[index]]))
}