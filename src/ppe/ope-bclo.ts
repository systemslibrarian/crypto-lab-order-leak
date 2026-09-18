import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'

const DOMAIN = 256
const RANGE = 65536
const encoder = new TextEncoder()
const OPE_KEY = new Uint8Array(32).fill(0x73)

function combinations(total: number, selected: number): bigint {
  const count = Math.min(selected, total - selected)
  if (count < 0) return 0n
  let result = 1n
  for (let index = 1; index <= count; index++) {
    result = (result * BigInt(total - count + index)) / BigInt(index)
  }
  return result
}

function randomBelow(limit: bigint, label: string): bigint {
  if (limit <= 0n) throw new RangeError('Random limit must be positive.')
  const byteLength = Math.ceil(limit.toString(2).length / 8)
  const ceiling = 1n << BigInt(byteLength * 8)
  const cutoff = ceiling - (ceiling % limit)
  for (let attempt = 0; ; attempt++) {
    const bytes: number[] = []
    for (let block = 0; bytes.length < byteLength; block++) {
      bytes.push(...hmac(sha256, OPE_KEY, encoder.encode(`${label}/${attempt}/${block}`)))
    }
    const candidate = bytes.slice(0, byteLength).reduce((value, byte) => (value << 8n) | BigInt(byte), 0n)
    if (candidate < cutoff) return candidate % limit
  }
}

export function sampleHypergeometric(
  population: number,
  successes: number,
  draws: number,
  label: string,
): number {
  const minimum = Math.max(0, draws - (population - successes))
  const maximum = Math.min(draws, successes)
  const weights: bigint[] = []
  let totalWeight = 0n
  for (let selected = minimum; selected <= maximum; selected++) {
    const weight = combinations(successes, selected) * combinations(population - successes, draws - selected)
    weights.push(weight)
    totalWeight += weight
  }
  const target = randomBelow(totalWeight, label)
  let cumulative = 0n
  for (let index = 0; index < weights.length; index++) {
    cumulative += weights[index]
    if (target < cumulative) return minimum + index
  }
  throw new Error('Exact hypergeometric sampler exhausted its support.')
}

function buildMap(): Uint16Array {
  const result = new Uint16Array(DOMAIN)

  function split(domainLow: number, domainHigh: number, rangeLow: number, rangeHigh: number): void {
    const domainSize = domainHigh - domainLow + 1
    const rangeSize = rangeHigh - rangeLow + 1
    if (domainSize === 1) {
      result[domainLow] = rangeLow + Number(randomBelow(BigInt(rangeSize), `leaf/${domainLow}/${rangeLow}/${rangeHigh}`))
      return
    }

    const rangeMiddle = Math.floor((rangeLow + rangeHigh) / 2)
    const lowerRangeSize = rangeMiddle - rangeLow + 1
    const lowerDomainSize = sampleHypergeometric(
      rangeSize,
      lowerRangeSize,
      domainSize,
      `split/${domainLow}/${domainHigh}/${rangeLow}/${rangeHigh}`,
    )
    if (lowerDomainSize > 0) split(domainLow, domainLow + lowerDomainSize - 1, rangeLow, rangeMiddle)
    if (lowerDomainSize < domainSize) split(domainLow + lowerDomainSize, domainHigh, rangeMiddle + 1, rangeHigh)
  }

  split(0, DOMAIN - 1, 0, RANGE - 1)
  return result
}

const map = buildMap()

export function opeEncrypt(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value >= DOMAIN) {
    throw new RangeError('OPE accepts only integers in the toy 8-bit domain (0-255).')
  }
  return map[value]
}

export const OPE_DOMAIN_NOTE = 'BCLO teaching profile: 8-bit plaintext to 16-bit ciphertext with exact hypergeometric recursive range splitting seeded by HMAC-SHA-256.'