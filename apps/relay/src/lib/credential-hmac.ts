import "server-only"
import { createHmac } from "crypto"

function getHmacKey(): Buffer {
  const key = process.env.CREDENTIAL_HMAC_SECRET
  if (!key) throw new Error("CREDENTIAL_HMAC_SECRET environment variable is required")
  return Buffer.from(key)
}

// Normalize: trim whitespace only. Preserves case, digits, leading zeros,
// and all alphanumeric characters per spec requirement.
export function normalizeCredential(raw: string): string {
  return raw.trim()
}

// Returns a hex HMAC-SHA256 of the normalized value using the server secret.
// Used as the lookup index — the raw value is never stored.
export function computeCredentialIndex(normalized: string): string {
  return createHmac("sha256", getHmacKey()).update(normalized).digest("hex")
}

// Derives a display-safe masked string. Preserves only the last few chars.
export function maskCredential(value: string): string {
  const n = value.length
  if (n <= 3) return "***"
  const tail = Math.min(4, n - 3)
  return "***" + value.slice(n - tail)
}
