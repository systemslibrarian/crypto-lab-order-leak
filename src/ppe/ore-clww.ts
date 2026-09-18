import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'

const encoder = new TextEncoder()
const ORE_KEY = new Uint8Array(32).fill(0x91)

export type OreCiphertext = { value: number; prefixTags: string[] }

function tag(prefix: string): string {
  return Array.from(hmac(sha256, ORE_KEY, encoder.encode(prefix)).slice(0, 4), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function oreEncrypt(value: number): OreCiphertext {
  if (!Number.isInteger(value) || value < 0 || value > 65535) throw new RangeError('ORE accepts 16-bit integers.')
  const bits = value.toString(2).padStart(16, '0')
  return { value, prefixTags: Array.from({ length: 16 }, (_, index) => tag(bits.slice(0, index + 1))) }
}

export function oreCompare(left: OreCiphertext, right: OreCiphertext): number {
  return Math.sign(left.value - right.value)
}

export function msdbDepth(left: OreCiphertext, right: OreCiphertext): number | null {
  const match = left.prefixTags.findIndex((prefix, index) => prefix !== right.prefixTags[index])
  return match === -1 ? null : match
}