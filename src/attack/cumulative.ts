type Observation<C> = { id: number; ciphertext: C }

export function cumulativeRecover<C>(
  observations: Observation<C>[],
  publicValues: number[],
  compareCiphertexts: (left: C, right: C) => number,
): Map<number, number | null> {
  if (observations.length === 0 || publicValues.length === 0) return new Map()

  const ordered = [...observations].sort((left, right) => compareCiphertexts(left.ciphertext, right.ciphertext))
  const buckets: Observation<C>[][] = []
  for (const row of ordered) {
    const bucket = buckets.at(-1)
    if (!bucket || compareCiphertexts(bucket[0].ciphertext, row.ciphertext) !== 0) buckets.push([row])
    else bucket.push(row)
  }

  const publicCounts = new Map<number, number>()
  for (const value of publicValues) publicCounts.set(value, (publicCounts.get(value) ?? 0) + 1)
  const publicBuckets = [...publicCounts].sort(([left], [right]) => left - right)
  if (buckets.length !== publicBuckets.length) {
    throw new Error(`Auxiliary support mismatch: sealed column has ${buckets.length} distinct values but public data has ${publicBuckets.length}.`)
  }

  let observedTotal = 0
  const observedCdf = buckets.map((bucket) => (observedTotal += bucket.length) / observations.length)
  let publicTotal = 0
  const publicCdf = publicBuckets.map(([, count]) => (publicTotal += count) / publicValues.length)

  const recovered = new Map<number, number | null>()
  buckets.forEach((bucket, bucketIndex) => {
    const distances = publicCdf.map((boundary) => Math.abs(boundary - observedCdf[bucketIndex]))
    const minimum = Math.min(...distances)
    const candidates = distances.flatMap((distance, index) => distance === minimum ? [publicBuckets[index][0]] : [])
    const guess = candidates.length === 1 ? candidates[0] : null
    for (const row of bucket) recovered.set(row.id, guess)
  })
  return recovered
}