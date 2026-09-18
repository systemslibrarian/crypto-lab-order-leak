const encoder = new TextEncoder()

export async function randomizedEncrypt(value: string): Promise<string> {
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, encoder.encode(value))
  return Array.from(new Uint8Array(encrypted), (byte) => byte.toString(16).padStart(2, '0')).join('')
}