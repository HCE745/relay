import "server-only"
import { createCipheriv, createDecipheriv, randomBytes } from "crypto"

const ALGORITHM  = "aes-256-gcm"
const KEY_LENGTH = 32
const IV_LENGTH  = 16

function getKey(): Buffer {
  const raw = process.env.IMAP_ENCRYPTION_KEY ?? ""
  const buf = Buffer.alloc(KEY_LENGTH)
  Buffer.from(raw, "utf8").copy(buf)
  return buf
}

export function encryptField(text: string): string {
  const key       = getKey()
  const iv        = randomBytes(IV_LENGTH)
  const cipher    = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()])
  const tag       = cipher.getAuthTag()
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":")
}

export function decryptField(data: string): string {
  const key       = getKey()
  const [ivHex, tagHex, encHex] = data.split(":")
  if (!ivHex || !tagHex || !encHex) throw new Error("Invalid encrypted data format")
  const iv        = Buffer.from(ivHex, "hex")
  const tag       = Buffer.from(tagHex, "hex")
  const encrypted = Buffer.from(encHex, "hex")
  const decipher  = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
}
