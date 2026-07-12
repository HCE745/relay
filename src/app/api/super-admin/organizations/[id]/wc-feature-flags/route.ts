import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { logSAAction } from "@/lib/sa-audit"
import { ALL_WC_FLAGS, type OrgWCFlags } from "@/lib/workforce-comms"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const org = await prisma.organization.findUnique({
    where:  { id },
    select: { name: true, ...Object.fromEntries(ALL_WC_FLAGS.map(f => [f, true])) },
  })
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json() as Partial<OrgWCFlags>

  const updates: Record<string, boolean> = {}
  const before: Record<string, boolean>  = {}
  const after:  Record<string, boolean>  = {}

  for (const flag of ALL_WC_FLAGS) {
    if (flag in body && typeof body[flag] === "boolean") {
      before[flag]  = (org as Record<string, unknown>)[flag] as boolean
      updates[flag] = body[flag]!
      after[flag]   = body[flag]!
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid flags provided" }, { status: 400 })
  }

  const updated = await prisma.organization.update({
    where:  { id },
    data:   updates,
    select: Object.fromEntries(ALL_WC_FLAGS.map(f => [f, true])) as Record<keyof OrgWCFlags, true>,
  })

  await logSAAction({
    superAdminId:   session.superAdminId,
    superAdminName: session.name,
    action:         "UPDATE_WC_FLAGS",
    orgId:          id,
    orgName:        org.name,
    targetType:     "organization",
    targetId:       id,
    targetName:     org.name,
    before,
    after,
  })

  return NextResponse.json({ flags: updated })
}
