import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

// GET — list all sales reps with their inbound eligibility status
export async function GET() {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const reps = await prisma.salesUser.findMany({
    where: { isDemo: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      employmentStatus: true,
      inboundEligible: true,
      inboundLastAssignedAt: true,
    },
  })

  return NextResponse.json({ reps })
}

// PATCH — update inboundEligible for one or more sales reps
// Body: { updates: Array<{ id: string; inboundEligible: boolean }> }
export async function PATCH(request: NextRequest) {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json() as {
    updates?: Array<{ id: string; inboundEligible: boolean }>
  }

  if (!Array.isArray(body.updates) || body.updates.length === 0) {
    return NextResponse.json({ error: "updates array is required" }, { status: 400 })
  }

  const results: Array<{ id: string; inboundEligible: boolean }> = []

  for (const update of body.updates) {
    if (typeof update.id !== "string" || typeof update.inboundEligible !== "boolean") continue
    const rep = await prisma.salesUser.update({
      where: { id: update.id },
      data: { inboundEligible: update.inboundEligible },
      select: { id: true, inboundEligible: true },
    })
    results.push(rep)
  }

  return NextResponse.json({ updated: results })
}
