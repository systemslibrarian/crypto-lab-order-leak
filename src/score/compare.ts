export type Score = { matched: number; mismatched: number; unresolved: number; rows: number }

export function compareRecovery<T>(truth: T[], recovered: Map<number, T | null>): Score {
  let matched = 0
  let unresolved = 0
  truth.forEach((value, index) => {
    const guess = recovered.get(index + 1)
    if (guess === undefined || guess === null) unresolved++
    else if (guess === value) matched++
  })
  return { matched, unresolved, mismatched: truth.length - matched - unresolved, rows: truth.length }
}