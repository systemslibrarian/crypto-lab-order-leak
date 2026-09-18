export function sortingRecover<T extends { id: number; ciphertext: number }>(observations: T[], sortedPublicValues: number[]) {
  if (observations.length !== sortedPublicValues.length) throw new Error('Auxiliary table size does not match the sealed column.')
  return new Map([...observations].sort((a, b) => a.ciphertext - b.ciphertext).map((row, index) => [row.id, sortedPublicValues[index]]))
}