// Pure credential state logic (Phase 13). DB-free so the expiry/compliance rules
// are unit-testable. A credential satisfies a requirement only while it is
// present, not revoked, and not past its expiry date.

export type CredentialStateValue = "ACTIVE" | "EXPIRING" | "EXPIRED" | "REVOKED"

export function credentialState(
  cred: { status: string; expiryDate: Date | null },
  leadDays: number,
  now: Date = new Date(),
): CredentialStateValue {
  if (cred.status === "REVOKED") return "REVOKED"
  if (cred.expiryDate) {
    if (cred.expiryDate.getTime() < now.getTime()) return "EXPIRED"
    const lead = new Date(now.getTime() + leadDays * 86_400_000)
    if (cred.expiryDate.getTime() <= lead.getTime()) return "EXPIRING"
  }
  return "ACTIVE"
}

/** A credential currently counts toward a requirement (present, not revoked/expired). */
export function satisfiesRequirement(cred: { status: string; expiryDate: Date | null }, now: Date = new Date()): boolean {
  const s = credentialState(cred, 0, now)
  return s === "ACTIVE" || s === "EXPIRING"
}

export const CREDENTIAL_TYPE_LABELS: Record<string, string> = {
  BACKGROUND_CHECK: "Background check",
  INSURANCE: "Insurance",
  I9: "I-9",
  BONDING: "Bonding",
  CERTIFICATION: "Certification",
  LICENSE: "License",
  TRAINING: "Training",
}
