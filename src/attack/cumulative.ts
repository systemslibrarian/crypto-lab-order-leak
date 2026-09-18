export function cumulativeRecover<T extends { id: number; ciphertext: number }>(observations: T[], sortedPublicValues: number[]) {
  return new Map([...observations].sort((a, b) => a.ciphertext - b.ciphertext).map((row, index) => [row.id, sortedPublicValues[index]]))
}