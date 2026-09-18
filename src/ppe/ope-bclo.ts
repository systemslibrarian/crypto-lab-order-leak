import { hmac } from '@noble/hashes/hmac.js'
import { sha256 } from '@noble/hashes/sha2.js'

const DOMAIN = 256
const RANGE = 65536
const encoder = new TextEncoder()
const OPE_KEY = new Uint8Array(32).fill(0x73)

function randomWord(counter: number): number {
  const bytes = hmac(sha256, OPE_KEY, encoder.encode(`bclo-toy/${counter}`))
  return new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0)
}

// A uniformly sampled subset gives a strictly increasing, lazy-sampling-style toy OPE map.
function buildMap(): Uint16Array {
  const result = new Uint16Array(DOMAIN)
  let selected = DOMAIN
  let position = 0
  let counter = 0
  while (selected > 0) {
    const remaining = RANGE - position
    if (randomWord(counter++) / 0x1_0000_0000 < selected / remaining) {
      result[DOMAIN - selected] = position
      selected--
    }
    position++
  }
  return result
}

const map = buildMap()

export function opeEncrypt(value: number): number {
  if (!Number.isInteger(value) || value < 0 || value >= DOMAIN) {
    throw new RangeError('OPE accepts only integers in the toy 8-bit domain (0-255).')
  }
  return map[value]
}

export function opeCompare(left: number, right: number): number {
  return Math.sign(left - right)
}

export const OPE_DOMAIN_NOTE = 'BCLO toy domain: 8-bit plaintext to 16-bit ciphertext; keyed subset sampling is deterministic and strictly monotone.'