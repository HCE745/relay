import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto"

// AES-256-GCM encryption for access codes at rest (Phase 14). The key comes from
// ACCESS_ENCRYPTION_KEY (any string; hashed to 32 bytes). Secrets are stored as
// "v1:<ivB64>:<tagB64>:<ctB64>" and only ever decrypted on an explicit, audited
// reveal. Without a key configured, encryption is unavailable and callers refuse
// to store a secret — we never store a code in plaintext.

function key(): Buffer | null {
  const raw = process.env.ACCESS_ENCRYPTION_KEY
  if (!raw) return null
  // Accept any passphrase; derive a stable 32-byte key.
  return createHash("sha256").update(raw).digest()
}

export function isSecretConfigured(): boolean {
  return key() !== null
}

export function encryptSecret(plaintext: string): string | null {
  const k = key()
  if (!k) return null
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", k, iv)
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`
}

export function decryptSecret(blob: string): string | null {
  const k = key()
  if (!k) return null
  const parts = blob.split(":")
  if (parts.length !== 4 || parts[0] !== "v1") return null
  try {
    const iv = Buffer.from(parts[1], "base64")
    const tag = Buffer.from(parts[2], "base64")
    const ct = Buffer.from(parts[3], "base64")
    const decipher = createDecipheriv("aes-256-gcm", k, iv)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8")
  } catch {
    return null
  }
}
