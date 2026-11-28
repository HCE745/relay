import "server-only"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { normalizeCredential, computeCredentialIndex, maskCredential } from "@/lib/credential-hmac"

export interface StagedCredentialInput {
  credentialType: "EMPLOYEE_ID" | "ACCESS_CODE" | "BADGE"
  rawValue: string
  label?: string
  // For EMPLOYEE_ID: preserve the raw value so it can be set on User.employeeId at acceptance
  preserveRaw?: boolean
}

// Reserve credentials in SingleCodeLookup and create StagedCredential records.
// If any collision is detected, throws with message containing "collision".
// All operations run inside a passed transaction.
export async function stageCredentialsForInvitation(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  params: {
    organizationId: string
    invitationId: string
    expiresAt: Date
    credentials: StagedCredentialInput[]
  }
) {
  const { organizationId, invitationId, expiresAt, credentials } = params

  for (const cred of credentials) {
    const normalized = normalizeCredential(cred.rawValue)
    const credentialIndex = computeCredentialIndex(normalized)

    // Check for collision in both SingleCodeLookup and existing StagedCredentials
    const [existing, staged] = await Promise.all([
      tx.singleCodeLookup.findUnique({
        where: { organizationId_credentialIndex: { organizationId, credentialIndex } },
      }),
      tx.stagedCredential.findFirst({
        where: { organizationId, credentialIndex },
      }),
    ])

    if (existing || staged) {
      throw new Error(`collision:${cred.credentialType}:${maskCredential(normalized)}`)
    }

    const credentialHash = await hash(normalized, 12)

    // Reserve the slot in SingleCodeLookup
    await tx.singleCodeLookup.create({
      data: { organizationId, credentialIndex },
    })

    await tx.stagedCredential.create({
      data: {
        organizationId,
        invitationId,
        credentialType: cred.credentialType,
        credentialIndex,
        credentialHash,
        maskedDisplay: maskCredential(normalized),
        label: cred.label ?? null,
        // Preserve raw value for EMPLOYEE_ID (plaintext on User anyway); never for secrets
        rawValue: cred.credentialType === "EMPLOYEE_ID" ? normalized : null,
        expiresAt,
      },
    })
  }
}

// Apply staged credentials to a newly created user (called on invitation acceptance).
// Deletes staged records after promoting them. The SingleCodeLookup entries stay.
export async function applyStagedCredentials(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  params: {
    organizationId: string
    invitationId: string
    userId: string
  }
) {
  const { organizationId, invitationId, userId } = params

  const staged = await tx.stagedCredential.findMany({
    where: { invitationId, organizationId },
  })

  if (staged.length === 0) return

  for (const sc of staged) {
    if (sc.credentialType === "BADGE") {
      await tx.employeeBadge.create({
        data: {
          userId,
          organizationId,
          badgeType: "THIRD_PARTY",
          credentialIndex: sc.credentialIndex,
          credentialHash: sc.credentialHash,
          maskedDisplay: sc.maskedDisplay,
          isActive: true,
        },
      })
    } else if (sc.credentialType === "EMPLOYEE_ID") {
      // Set the actual employee ID on the User record
      if (sc.rawValue) {
        await tx.user.update({
          where: { id: userId },
          data: { employeeId: sc.rawValue },
        })
      }
      await tx.employeeCredential.upsert({
        where: { userId },
        create: {
          userId,
          organizationId,
          employeeIdEnabled: true,
          employeeIdIndex: sc.credentialIndex,
        },
        update: {
          employeeIdEnabled: true,
          employeeIdIndex: sc.credentialIndex,
        },
      })
    } else {
      // ACCESS_CODE
      await tx.employeeCredential.upsert({
        where: { userId },
        create: {
          userId,
          organizationId,
          accessCodeEnabled: true,
          accessCodeIndex: sc.credentialIndex,
          accessCodeHash: sc.credentialHash,
          accessCodeMasked: sc.maskedDisplay,
        },
        update: {
          accessCodeEnabled: true,
          accessCodeIndex: sc.credentialIndex,
          accessCodeHash: sc.credentialHash,
          accessCodeMasked: sc.maskedDisplay,
        },
      })
    }
  }

  // Clean up staged records (SingleCodeLookup entries remain)
  await tx.stagedCredential.deleteMany({
    where: { invitationId, organizationId },
  })
}

// Release staged credentials for a cancelled or expired invitation.
// Removes both the StagedCredential records and their SingleCodeLookup reservations.
export async function releaseStagedCredentials(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  params: {
    organizationId: string
    invitationId: string
  }
) {
  const { organizationId, invitationId } = params

  const staged = await tx.stagedCredential.findMany({
    where: { invitationId, organizationId },
  })

  if (staged.length === 0) return

  const indices = staged.map(s => s.credentialIndex)

  // Release reserved SingleCodeLookup slots
  await tx.singleCodeLookup.deleteMany({
    where: {
      organizationId,
      credentialIndex: { in: indices },
    },
  })

  await tx.stagedCredential.deleteMany({
    where: { invitationId, organizationId },
  })
}

// Cleanup job: release staged credentials for all expired invitations.
// Safe to call periodically (e.g. in a background cron or at invite-send time).
export async function cleanupExpiredStagedCredentials() {
  const expired = await prisma.stagedCredential.findMany({
    where: { expiresAt: { lt: new Date() } },
    select: { organizationId: true, invitationId: true, credentialIndex: true },
  })

  if (expired.length === 0) return

  // Group by invitation for batch cleanup
  const byInvitation = new Map<string, { organizationId: string; indices: string[] }>()
  for (const e of expired) {
    const key = e.invitationId
    if (!byInvitation.has(key)) {
      byInvitation.set(key, { organizationId: e.organizationId, indices: [] })
    }
    byInvitation.get(key)!.indices.push(e.credentialIndex)
  }

  for (const [invitationId, { organizationId, indices }] of byInvitation) {
    await prisma.$transaction([
      prisma.singleCodeLookup.deleteMany({
        where: { organizationId, credentialIndex: { in: indices } },
      }),
      prisma.stagedCredential.deleteMany({
        where: { invitationId, organizationId },
      }),
    ])
  }
}
