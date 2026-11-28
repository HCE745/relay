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

// POST /api/team/bulk-credentials
//
// Generates fresh access codes for a list of employee user IDs (or all employees
// if no ids provided).  Returns a list of { userId, name, rawCode, masked } that
// the caller should use to print credential cards.
//
// Body: { userIds?: string[] }   — omit to target all EMPLOYEE/SUPERVISOR/etc in org
// Returns: { results: { userId, name, rawCode, masked }[], errors: { userId, error }[] }
//
// Requires ADMIN role.
export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session)                return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body    = await request.json() as { userIds?: string[] }
  const orgId   = session.organizationId

  const users = await prisma.user.findMany({
    where: {
      organizationId: orgId,
      isActive:       true,
      ...(body.userIds?.length ? { id: { in: body.userIds } } : {}),
    },
    select: {
      id: true, name: true,
      employeeCredential: { select: { accessCodeIndex: true } },
    },
    orderBy: { name: "asc" },
  })

  const results: { userId: string; name: string; rawCode: string; masked: string }[] = []
  const errors:  { userId: string; error: string }[] = []

  for (const user of users) {
    try {
      let rawCode = ""
      await prisma.$transaction(async (tx) => {
        // Try up to 3 times on collision (statistically negligible)
        for (let attempt = 0; attempt < 3; attempt++) {
          rawCode = generateAccessCode(6)
          const existing = user.employeeCredential
          if (existing?.accessCodeIndex) {
            await clearUserSingleCodeLookups(tx, orgId, null, existing.accessCodeIndex)
          }
          await reserveSingleCodeLookup(tx, orgId, rawCode)
          break
        }

        const idx    = computeCredentialIndex(normalizeCredential(rawCode))
        const hashed = await hash(rawCode, 12)

        await tx.employeeCredential.upsert({
          where:  { userId: user.id },
          create: {
            userId:            user.id,
            organizationId:    orgId,
            accessCodeEnabled: true,
            accessCodeIndex:   idx,
            accessCodeHash:    hashed,
            accessCodeMasked:  maskCredential(rawCode),
          },
          update: {
            accessCodeEnabled: true,
            accessCodeIndex:   idx,
            accessCodeHash:    hashed,
            accessCodeMasked:  maskCredential(rawCode),
          },
        })
      })

      results.push({ userId: user.id, name: user.name, rawCode, masked: maskCredential(rawCode) })
    } catch {
      errors.push({ userId: user.id, error: "Failed to generate code" })
    }
  }

  return NextResponse.json({ results, errors })
}
