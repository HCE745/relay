import "server-only"
import type { PrismaClient } from "@/generated/prisma/client"
import { computeCredentialIndex, normalizeCredential } from "@/lib/credential-hmac"

// Atomic helpers for setting single-code credentials.
//
// Employee ID and custom access codes both use a single-code lookup (HMAC index).
// If an org already has a credential with that HMAC index — even under a different
// method — the @@unique([organizationId, credentialIndex]) constraint on
// SingleCodeLookup will reject the insert, surfacing a collision error.
//
// All callers must use a Prisma transaction so that the lookup entry and the
// EmployeeCredential record are updated atomically.

type TransactionalPrisma = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">

// Reserves a credential index in the unified lookup table.
// Throws P2002 (unique constraint) if the index is already in use by another entry.
export async function reserveSingleCodeLookup(
  tx: TransactionalPrisma,
  organizationId: string,
  rawValue: string,
): Promise<{ credentialIndex: string }> {
  const credentialIndex = computeCredentialIndex(normalizeCredential(rawValue))

  await tx.singleCodeLookup.create({
    data: { organizationId, credentialIndex },
  })

  return { credentialIndex }
}

// Releases the lookup entry for a specific HMAC index (e.g. when a credential is
// cleared or reassigned). No-ops silently if the entry does not exist.
export async function releaseSingleCodeLookup(
  tx: TransactionalPrisma,
  organizationId: string,
  credentialIndex: string,
): Promise<void> {
  await tx.singleCodeLookup.deleteMany({
    where: { organizationId, credentialIndex },
  })
}

// Removes all single-code lookup entries for a user's current credentials.
// Call this inside a transaction before setting new credential values so the
// old indices are freed before the new ones are reserved.
export async function clearUserSingleCodeLookups(
  tx: TransactionalPrisma,
  organizationId: string,
  currentEmployeeIdIndex: string | null,
  currentAccessCodeIndex: string | null,
): Promise<void> {
  const toDelete: string[] = []
  if (currentEmployeeIdIndex) toDelete.push(currentEmployeeIdIndex)
  if (currentAccessCodeIndex) toDelete.push(currentAccessCodeIndex)

  if (toDelete.length > 0) {
    await tx.singleCodeLookup.deleteMany({
      where: {
        organizationId,
        credentialIndex: { in: toDelete },
      },
    })
  }
}
