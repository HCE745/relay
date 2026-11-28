import "server-only"
import { createHmac } from "crypto"

// CREDENTIAL_HMAC_SECRET — purpose and rotation:
//
// This key is the HMAC secret used to derive lookup indices for employee credentials
// (Employee IDs, access codes, badge values, device tokens). The raw credential values
// are never stored; only their HMAC-SHA256 digests are. This means:
//
//   1. An attacker who reads the database cannot recover credential values.
//   2. Lookup is O(1) via exact HMAC match (no bcrypt scan).
//
// ROTATION IMPLICATIONS:
//   Rotating this key invalidates every stored HMAC index immediately. All credentials
//   become unlookable until their indices are recomputed. The re-enrollment strategy is:
//     a. Set the new key in the environment.
//     b. Run a migration script that iterates every EmployeeCredential, EmployeeBadge,
//        RegisteredDevice, and SingleCodeLookup record and rewrites the index fields
//        using the new key (requires temporarily exposing or re-entering the raw values).
//   Because the raw values are not stored, a pure server-side rekey is not possible
//   without a re-enrollment flow or a parallel dual-key lookup window during migration.
//   Document and test this procedure before rotating in production.
//
// MISSING SECRET:
//   The server will throw on the first credential lookup or device registration attempt
//   rather than silently issuing invalid indices. This surfaces misconfiguration early.

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
