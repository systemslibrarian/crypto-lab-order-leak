const encoder = new TextEncoder()

export async function createControlKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt'])
}

export async function randomizedEncrypt(value: string, key: CryptoKey): Promise<string> {
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, encoder.encode(value))
  return Array.from([...nonce, ...new Uint8Array(encrypted)], (byte) => byte.toString(16).padStart(2, '0')).join('')
}