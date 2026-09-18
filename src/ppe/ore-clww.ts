import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'

const WIDTH = 8
const MODULUS = 3
const encoder = new TextEncoder()

export type OreCiphertext = { components: readonly number[] }

export function oreSetup(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}

function prfMod3(key: Uint8Array, index: number, prefix: string): number {
  const prefixBytes = Array.from({ length: WIDTH - 1 }, (_, bit) => Number(prefix[bit] ?? '0'))
  const input = Uint8Array.from([...encoder.encode('CLWW'), 1, index, ...prefixBytes])
  const range = 1n << 256n
  const limit = range - (range % 3n)
  for (let counter = 0; ; counter++) {
    const digest = hmac(sha256, key, Uint8Array.from([...input, counter >>> 24, counter >>> 16, counter >>> 8, counter]))
    const candidate = digest.reduce((value, byte) => (value << 8n) | BigInt(byte), 0n)
    if (candidate < limit) return Number(candidate % 3n)
  }
}

export function oreEncrypt(key: Uint8Array, value: number): OreCiphertext {
  if (key.length !== 32) throw new RangeError('CLWW requires a 32-byte PRF key.')
  if (!Number.isInteger(value) || value < 0 || value > 255) throw new RangeError('CLWW accepts only 8-bit integers (0-255).')
  const bits = value.toString(2).padStart(WIDTH, '0')
  return {
    components: Array.from({ length: WIDTH }, (_, index) => (
      prfMod3(key, index + 1, bits.slice(0, index)) + Number(bits[index])
    ) % MODULUS),
  }
}

export function validateOreCiphertext(ciphertext: OreCiphertext): void {
  if (ciphertext.components.length !== WIDTH || ciphertext.components.some((component) => !Number.isInteger(component) || component < 0 || component >= MODULUS)) {
    throw new TypeError('Malformed CLWW ciphertext: expected exactly eight trits in Z_3.')
  }
}

export function oreMsdb(left: OreCiphertext, right: OreCiphertext): number | null {
  validateOreCiphertext(left)
  validateOreCiphertext(right)
  const index = left.components.findIndex((component, position) => component !== right.components[position])
  return index === -1 ? null : index
}

export function oreCompare(left: OreCiphertext, right: OreCiphertext): -1 | 0 | 1 {
  const index = oreMsdb(left, right)
  if (index === null) return 0
  return right.components[index] === (left.components[index] + 1) % MODULUS ? -1 : 1
}

export function serializeOre(ciphertext: OreCiphertext): string {
  validateOreCiphertext(ciphertext)
  const packed = ciphertext.components.reduce((value, component) => value * MODULUS + component, 0)
  return packed.toString(16).padStart(4, '0')
}