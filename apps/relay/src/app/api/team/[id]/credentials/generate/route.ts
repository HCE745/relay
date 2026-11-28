import "server-only"
import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { hash } from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { normalizeCredential, computeCredentialIndex, maskCredential } from "@/lib/credential-hmac"
import { reserveSingleCodeLookup, clearUserSingleCodeLookups } from "@/lib/single-code-lookup"

export const dynamic = "force-dynamic"

type RouteCtx = { params: Promise<{ id: string }> }

// Character set for access codes: uppercase alphanumeric, excluding visually ambiguous chars
// (B/8, I/1, O/0) to aid manual entry.
const CODE_CHARS = "23456789ACDEFGHJKLMNPQRTUVWXY"

function generateAccessCode(length = 6): string {
  const bytes = randomBytes(length * 2)
  let code = ""
  for (let i = 0; i < bytes.length && code.length < length; i++) {
    const idx = bytes[i] % CODE_CHARS.length
    code += CODE_CHARS[idx]
  }
  return code
}

function generateRelayCredential(): string {
  // 16 hex bytes = 32 chars — compact, scannable by both QR and barcode
  return randomBytes(16).toString("hex").toUpperCase()
}

// POST /api/team/[id]/credentials/generate
//
// Generates a new credential and stores it. The raw value is returned ONCE
// in this response — it cannot be retrieved again.
//
// Body: { type: "ACCESS_CODE" | "RELAY_QR" | "RELAY_BARCODE" }
// Returns: { rawValue: string, masked: string }
//
// ACCESS_CODE: generates a 6-char alphanumeric code, sets as the employee's
//   access code (replacing any previous), enables accessCodeEnabled.
//
// RELAY_QR | RELAY_BARCODE: generates a 32-char hex token, adds a new active
//   EmployeeBadge record of the specified type. The raw value is what gets
//   encoded in the QR or barcode.
export async function POST(request: NextRequest, { params }: RouteCtx) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "HR"].includes(session.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params

  const user = await prisma.user.findFirst({
    where:  { id, organizationId: session.organizationId },
    select: {
      id: true, role: true,
      employeeCredential: {
        select: { id: true, accessCodeIndex: true },
      },
    },
  })

  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await request.json() as { type?: string }
  const type = body.type

  if (type === "ACCESS_CODE") {
    // Generate a new access code and replace any existing one
    const rawCode    = generateAccessCode(6)
    const orgId      = session.organizationId

    try {
      await prisma.$transaction(async (tx) => {
        const existing = user.employeeCredential
        // Release old access code lookup entry
        if (existing?.accessCodeIndex) {
          await clearUserSingleCodeLookups(tx, orgId, null, existing.accessCodeIndex)
        }
        // Reserve new lookup entry
        await reserveSingleCodeLookup(tx, orgId, rawCode)

        const idx    = computeCredentialIndex(normalizeCredential(rawCode))
        const hashed = await hash(rawCode, 12)

        await tx.employeeCredential.upsert({
          where:  { userId: id },
          create: {
            userId:            id,
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
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Unique constraint failed")) {
        return NextResponse.json({ error: "Generated code collision — please retry" }, { status: 409 })
      }
      throw err
    }

    return NextResponse.json({ rawValue: rawCode, masked: maskCredential(rawCode) })
  }

  if (type === "RELAY_QR" || type === "RELAY_BARCODE") {
    const rawValue    = generateRelayCredential()
    const normalized  = normalizeCredential(rawValue)
    const credIndex   = computeCredentialIndex(normalized)
    const credHash    = await hash(rawValue, 12)
    const orgId       = session.organizationId

    try {
      await prisma.employeeBadge.create({
        data: {
          userId:          id,
          organizationId:  orgId,
          badgeType:       type,            // "RELAY_QR" or "RELAY_BARCODE"
          credentialIndex: credIndex,
          credentialHash:  credHash,
          maskedDisplay:   maskCredential(rawValue),
        },
      })
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes("Unique constraint failed")) {
        return NextResponse.json({ error: "Credential collision — please retry" }, { status: 409 })
      }
      throw err
    }

    return NextResponse.json({ rawValue, masked: maskCredential(rawValue) })
  }

  return NextResponse.json({ error: "type must be ACCESS_CODE, RELAY_QR, or RELAY_BARCODE" }, { status: 400 })
}
