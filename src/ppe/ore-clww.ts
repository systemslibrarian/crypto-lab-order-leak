import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'

const encoder = new TextEncoder()
const ORE_KEY = new Uint8Array(32).fill(0x91)

export type OreCiphertext = { orderCode: number; prefixTags: string[] }

function tag(prefix: string): string {
  return Array.from(hmac(sha256, ORE_KEY, encoder.encode(prefix)).slice(0, 4), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function oreEncrypt(value: number): OreCiphertext {
  if (!Number.isInteger(value) || value < 0 || value > 255) throw new RangeError('ORE teaching profile accepts 8-bit integers.')
  const orderCode = (value << 8) | (hmac(sha256, ORE_KEY, encoder.encode(`leaf/${value}`))[0])
  const bits = orderCode.toString(2).padStart(16, '0')
  return { orderCode, prefixTags: Array.from({ length: 16 }, (_, index) => tag(bits.slice(0, index + 1))) }
}

export function oreCompare(left: OreCiphertext, right: OreCiphertext): number {
  return Math.sign(left.orderCode - right.orderCode)
}

export function msdbDepth(left: OreCiphertext, right: OreCiphertext): number | null {
  const match = left.prefixTags.findIndex((prefix, index) => prefix !== right.prefixTags[index])
  return match === -1 ? null : match
}