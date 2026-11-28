import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { normalizeCredential, computeCredentialIndex, maskCredential } from "@/lib/credential-hmac"
import { reserveSingleCodeLookup, clearUserSingleCodeLookups } from "@/lib/single-code-lookup"

export const dynamic = "force-dynamic"

const CODE_CHARS = "23456789ACDEFGHJKLMNPQRTUVWXY"

function generateAccessCode(length = 6): string {
  const bytes = randomBytes(length * 2)
  let code = ""
  for (let i = 0; i < bytes.length && code.length < length; i++) {
    code += CODE_CHARS[bytes[i] % CODE_CHARS.length]
  }
  return code
}

function generateHexCode(bytes = 32): string {
  return randomBytes(bytes).toString("hex")
}

// POST /api/team/bulk-credentials
//
// Generates credentials for employees and returns raw values for one-time display
// and printing. Raw values are never stored; only their HMAC indices and bcrypt hashes.
//
// Body:
//   type: "ACCESS_CODE" | "QR" | "BARCODE"  — credential type to generate
//   replace: boolean                         — if false, skip employees who already have this type
//   userIds?: string[]                       — target specific users (omit = all active employees)
//   locationId?: string                      — filter by location
//   departmentId?: string                    — filter by department
//
// Returns: { results: CredResult[], errors: ErrResult[] }
// where CredResult.rawValue is the plaintext credential (shown once, never stored).
//
// Requires ADMIN role.
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session)                return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json() as {
    type?:         "ACCESS_CODE" | "QR" | "BARCODE"
    replace?:      boolean
    userIds?:      string[]
    locationId?:   string
    departmentId?: string
  }

  const credType   = body.type ?? "ACCESS_CODE"
  const replace    = body.replace ?? true
  const orgId      = session.organizationId

  const whereFilter = {
    organizationId: orgId,
    isActive:       true,
    ...(body.userIds?.length  ? { id:           { in: body.userIds } }     : {}),
    ...(body.locationId       ? { locationId:   body.locationId }           : {}),
    ...(body.departmentId     ? { departmentId: body.departmentId }         : {}),
  }

  const users = await prisma.user.findMany({
    where: whereFilter,
    select: {
      id: true, name: true, employeeId: true,
      employeeCredential: {
        select: { accessCodeIndex: true, accessCodeEnabled: true },
      },
      employeeBadges: {
        where: { isActive: true },
        select: { id: true, badgeType: true },
      },
      location:   { select: { name: true } },
      department: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  })

  const results: {
    userId: string
    name: string
    employeeId: string | null
    location: string | null
    department: string | null
    credentialType: string
    rawValue: string
    masked: string
    isReplacement: boolean
  }[] = []
  const errors: { userId: string; name: string; error: string }[] = []

  for (const user of users) {
    try {
      // Determine if this is replacing an existing credential
      let isReplacement = false
      if (credType === "ACCESS_CODE") {
        isReplacement = !!user.employeeCredential?.accessCodeIndex
        if (isReplacement && !replace) {
          // Skip employees who already have this type
          continue
        }
      } else {
        const badgeType = credType === "QR" ? "RELAY_QR" : "RELAY_BARCODE"
        const existingBadge = user.employeeBadges.find(b => b.badgeType === badgeType)
        isReplacement = !!existingBadge
        if (isReplacement && !replace) continue
      }

      let rawValue = ""

      await prisma.$transaction(async (tx) => {
        for (let attempt = 0; attempt < 3; attempt++) {
          rawValue = credType === "ACCESS_CODE" ? generateAccessCode(6) : generateHexCode(16)

          const normalized = normalizeCredential(rawValue)
          const idx        = computeCredentialIndex(normalized)

          if (credType === "ACCESS_CODE") {
            const existing = user.employeeCredential
            if (existing?.accessCodeIndex) {
              await clearUserSingleCodeLookups(tx, orgId, null, existing.accessCodeIndex)
            }

            // Will throw on collision; retry loop handles it
            await reserveSingleCodeLookup(tx, orgId, rawValue)

            const hashed = await hash(normalized, 12)
            await tx.employeeCredential.upsert({
              where:  { userId: user.id },
              create: {
                userId: user.id, organizationId: orgId,
                accessCodeEnabled: true, accessCodeIndex: idx,
                accessCodeHash: hashed, accessCodeMasked: maskCredential(rawValue),
              },
              update: {
                accessCodeEnabled: true, accessCodeIndex: idx,
                accessCodeHash: hashed, accessCodeMasked: maskCredential(rawValue),
              },
            })
          } else {
            const badgeType = credType === "QR" ? "RELAY_QR" : "RELAY_BARCODE"
            const existingBadge = user.employeeBadges.find(b => b.badgeType === badgeType)

            if (existingBadge) {
              // Revoke the old badge — SingleCodeLookup entry stays; new one created below
              await tx.employeeBadge.update({
                where: { id: existingBadge.id },
                data:  { isActive: false, revokedAt: new Date() },
              })
              // Release old slot
              const oldHash = await tx.employeeBadge.findUnique({
                where: { id: existingBadge.id },
                select: { credentialIndex: true },
              })
              if (oldHash?.credentialIndex) {
                await tx.singleCodeLookup.deleteMany({
                  where: { organizationId: orgId, credentialIndex: oldHash.credentialIndex },
                })
              }
            }

            // Reserve new slot (throws on collision)
            await reserveSingleCodeLookup(tx, orgId, rawValue)

            const hashed = await hash(normalized, 12)
            await tx.employeeBadge.create({
              data: {
                userId: user.id, organizationId: orgId,
                badgeType, credentialIndex: idx,
                credentialHash: hashed, maskedDisplay: maskCredential(rawValue),
                isActive: true,
              },
            })
          }

          break // success
        }
      })

      results.push({
        userId:         user.id,
        name:           user.name,
        employeeId:     user.employeeId ?? null,
        location:       user.location?.name ?? null,
        department:     user.department?.name ?? null,
        credentialType: credType,
        rawValue,
        masked:         maskCredential(rawValue),
        isReplacement,
      })
    } catch {
      errors.push({ userId: user.id, name: user.name, error: "Failed to generate credential" })
    }
  }

  return NextResponse.json({ results, errors, credentialType: credType })
}
