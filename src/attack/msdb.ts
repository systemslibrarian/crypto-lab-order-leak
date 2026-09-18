export type OreObservation = { components: readonly number[] }
export type OreTreeNode =
  | { kind: 'leaf'; ids: number[] }
  | { kind: 'branch'; depth: number; left: OreTreeNode; right: OreTreeNode }

export type PairwiseLeakage = {
  leftId: number
  rightId: number
  order: -1 | 0 | 1
  depth: number | null
}

function msdbDepth(left: OreObservation, right: OreObservation): number | null {
  const match = left.components.findIndex((component, index) => component !== right.components[index])
  return match === -1 ? null : match
}

export function compareOreObservations(left: OreObservation, right: OreObservation): -1 | 0 | 1 {
  const index = msdbDepth(left, right)
  if (index === null) return 0
  return right.components[index] === (left.components[index] + 1) % 3 ? -1 : 1
}

function validate(observations: { id: number; ciphertext: OreObservation }[]): void {
  const width = observations[0]?.ciphertext.components.length
  if (!width || observations.some(({ ciphertext }) => ciphertext.components.length !== width || ciphertext.components.some((component) => !Number.isInteger(component) || component < 0 || component > 2))) {
    throw new TypeError('Malformed MSDB observation: expected equal-width trit vectors.')
  }
  if (new Set(observations.map(({ id }) => id)).size !== observations.length) throw new Error('MSDB observations require unique row IDs.')
}

export function recoverOreTree(observations: { id: number; ciphertext: OreObservation }[]) {
  if (observations.length === 0) return { ordered: [], pairs: [], tree: null }
  validate(observations)

  const pairs: PairwiseLeakage[] = []
  const leakageByIds = new Map<string, PairwiseLeakage>()
  for (let left = 0; left < observations.length; left++) {
    for (let right = left + 1; right < observations.length; right++) {
      const leftRow = observations[left]
      const rightRow = observations[right]
      const order = compareOreObservations(leftRow.ciphertext, rightRow.ciphertext)
      const leakage = { leftId: leftRow.id, rightId: rightRow.id, order, depth: msdbDepth(leftRow.ciphertext, rightRow.ciphertext) } satisfies PairwiseLeakage
      pairs.push(leakage)
      leakageByIds.set([leftRow.id, rightRow.id].sort((a, b) => a - b).join(':'), leakage)
    }
  }

  const ordered = [...observations].sort((left, right) => compareOreObservations(left.ciphertext, right.ciphertext))
  const leaves: { ids: number[]; ciphertext: OreObservation }[] = []
  for (const row of ordered) {
    const leaf = leaves.at(-1)
    if (!leaf || compareOreObservations(leaf.ciphertext, row.ciphertext) !== 0) leaves.push({ ids: [row.id], ciphertext: row.ciphertext })
    else leaf.ids.push(row.id)
  }

  const depthBetween = (leftId: number, rightId: number): number | null => leakageByIds.get([leftId, rightId].sort((a, b) => a - b).join(':'))?.depth ?? null
  const build = (start: number, end: number): OreTreeNode => {
    if (end - start === 1) return { kind: 'leaf', ids: leaves[start].ids }
    let depth = Number.POSITIVE_INFINITY
    for (let left = start; left < end; left++) {
      for (let right = left + 1; right < end; right++) {
        depth = Math.min(depth, depthBetween(leaves[left].ids[0], leaves[right].ids[0]) ?? Number.POSITIVE_INFINITY)
      }
    }
    const splitOffset = Array.from({ length: end - start - 1 }, (_, index) => index + start + 1)
      .find((split) => depthBetween(leaves[split - 1].ids[0], leaves[split].ids[0]) === depth)
    if (!Number.isFinite(depth) || splitOffset === undefined) throw new Error('Pairwise MSDB leakage did not form a binary order tree.')
    return { kind: 'branch', depth, left: build(start, splitOffset), right: build(splitOffset, end) }
  }

  return { ordered, pairs, tree: build(0, leaves.length) }
}

export function recoverOreOrder(observations: { id: number; ciphertext: OreObservation }[]) {
  const { ordered } = recoverOreTree(observations)
  return ordered.map((row, index) => ({ id: row.id, rank: index + 1, split: index === 0 ? null : msdbDepth(ordered[index - 1].ciphertext, row.ciphertext) }))
}