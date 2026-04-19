const enc = new TextEncoder()
const dec = new TextDecoder()

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 8192
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

async function aesKeyFromMaster(masterSecret: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(masterSecret))
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

export async function encryptStripeUserSecret(masterSecret: string, plain: string): Promise<string> {
  const key = await aesKeyFromMaster(masterSecret)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, enc.encode(plain))
  const ct = new Uint8Array(cipher)
  const packed = new Uint8Array(iv.length + ct.length)
  packed.set(iv)
  packed.set(ct, iv.length)
  return uint8ToBase64(packed)
}

export async function decryptStripeUserSecret(masterSecret: string, packedB64: string): Promise<string> {
  const raw = base64ToUint8(packedB64.trim())
  if (raw.length < 13) throw new Error('Invalid ciphertext')
  const iv = raw.slice(0, 12)
  const ct = raw.slice(12)
  const key = await aesKeyFromMaster(masterSecret)
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, tagLength: 128 }, key, ct)
  return dec.decode(plain)
}
