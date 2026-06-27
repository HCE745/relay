/**
 * AES-256-GCM encryption for Plaid access tokens at rest.
 * Key = ENCRYPTION_KEY env var (64-char hex = 32 bytes).
 */
import "server-only"

const ALG = "AES-GCM"
const IV_LEN = 12

function getKey(): Promise<CryptoKey> {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) throw new Error("ENCRYPTION_KEY must be 64 hex chars (32 bytes)")
  const bytes = Buffer.from(hex, "hex")
  return crypto.subtle.importKey("raw", bytes, ALG, false, ["encrypt", "decrypt"])
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN))
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALG, iv },
    key,
    new TextEncoder().encode(plaintext),
  )
  const result = new Uint8Array(IV_LEN + ciphertext.byteLength)
  result.set(iv)
  result.set(new Uint8Array(ciphertext), IV_LEN)
  return Buffer.from(result).toString("base64")
}

export async function decrypt(ciphertextB64: string): Promise<string> {
  const key = await getKey()
  const data = Buffer.from(ciphertextB64, "base64")
  const iv = data.subarray(0, IV_LEN)
  const ciphertext = data.subarray(IV_LEN)
  const plaintext = await crypto.subtle.decrypt({ name: ALG, iv }, key, ciphertext)
  return new TextDecoder().decode(plaintext)
}
