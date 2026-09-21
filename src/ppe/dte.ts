import { gcmsiv } from '@noble/ciphers/aes.js'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

// Per-session key material, drawn at load and held only in memory (template
// §0.6). This file previously shipped `new Uint8Array(32).fill(0x42)` and
// `.fill(0x11)` as module constants, which persisted both the key and the
// nonce in the deployed bundle — and was inconsistent with ore-clww.ts and
// control.ts, which already draw theirs per session.
//
// The nonce stays fixed for the lifetime of the session on purpose. AES-GCM-SIV
// is nonce-misuse resistant, so reusing one nonce across the whole column is
// safe in the SIV sense and is exactly what makes the column deterministic —
// the equality leak this lab exists to show. Fresh key material per session
// changes the ciphertext bytes a visitor sees; it does not change the leak.
const DTE_KEY = crypto.getRandomValues(new Uint8Array(32))
const DTE_NONCE = crypto.getRandomValues(new Uint8Array(12))

export function dteSessionKey(): Uint8Array {
  return Uint8Array.from(DTE_KEY)
}

export function dteSessionNonce(): Uint8Array {
  return Uint8Array.from(DTE_NONCE)
}

export function aesGcmSivEncrypt(key: Uint8Array, nonce: Uint8Array, plaintext: Uint8Array): Uint8Array {
  return gcmsiv(key, nonce).encrypt(plaintext)
}

export function dteEncrypt(value: string, key = DTE_KEY): Uint8Array {
  return aesGcmSivEncrypt(key, DTE_NONCE, encoder.encode(value))
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