import { gcmsiv } from '@noble/ciphers/aes.js'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const DTE_KEY = new Uint8Array(32).fill(0x42)
export const DTE_NONCE = new Uint8Array(12).fill(0x11)

export function dteEncrypt(value: string, key = DTE_KEY): Uint8Array {
  return gcmsiv(key, DTE_NONCE).encrypt(encoder.encode(value))
}

export function dteDecrypt(ciphertext: Uint8Array, key = DTE_KEY): string {
  return decoder.decode(gcmsiv(key, DTE_NONCE).decrypt(ciphertext))
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function dteTagVerifies(ciphertext: Uint8Array): boolean {
  try {
    dteDecrypt(ciphertext)
    return true
  } catch {
    return false
  }
}