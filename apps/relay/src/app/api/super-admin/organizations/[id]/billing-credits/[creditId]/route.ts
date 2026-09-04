import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { activateCredit, cancelCredit, completeCredit } from "@/lib/billing-credits-engine"
import { logSAAction } from "@/lib/sa-audit"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; creditId: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, creditId } = await params
  const org = await prisma.organization.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const credit = await prisma.billingCredit.findFirst({ where: { id: creditId, orgId: id } })
  if (!credit) return NextResponse.json({ error: "Credit not found" }, { status: 404 })

  const body = await req.json() as {
    action?: "activate" | "cancel" | "complete"
    reason?: string
    internalNotes?: string
    description?: string
    durationUntilDate?: string | null
  }

  const auditCtx = { superAdminId: session.superAdminId, superAdminName: session.name, orgName: org.name }

  if (body.action === "activate") {
    const result = await activateCredit(creditId, auditCtx)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  } else if (body.action === "cancel") {
    const result = await cancelCredit(creditId, body.reason ?? "Cancelled by super admin", auditCtx)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  } else if (body.action === "complete") {
    await completeCredit(creditId, auditCtx)
  } else {
    // General field updates
    const updates: Record<string, unknown> = {}
    if (body.description !== undefined) updates.description = body.description
    if (body.internalNotes !== undefined) updates.internalNotes = body.internalNotes ?? null
    if (body.durationUntilDate !== undefined) updates.durationUntilDate = body.durationUntilDate ? new Date(body.durationUntilDate) : null

    if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 })

    await prisma.billingCredit.update({ where: { id: creditId }, data: updates })

    await logSAAction({
      superAdminId:   session.superAdminId,
      superAdminName: session.name,
      action:     "UPDATE_BILLING_CREDIT",
      orgId:      org.id,
      orgName:    org.name,
      targetType: "organization",
      targetId:   creditId,
      targetName: credit.description,
      after:      updates,
    })
  }

  const fresh = await prisma.billingCredit.findUnique({ where: { id: creditId } })
  return NextResponse.json(fresh)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; creditId: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin || !session.superAdminId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id, creditId } = await params
  const org = await prisma.organization.findUnique({ where: { id }, select: { id: true, name: true } })
  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const credit = await prisma.billingCredit.findFirst({ where: { id: creditId, orgId: id } })
  if (!credit) return NextResponse.json({ error: "Credit not found" }, { status: 404 })

  // Cancel from Stripe first if active
  if (credit.status === "active") {
    await cancelCredit(creditId, "Deleted by super admin",
      { superAdminId: session.superAdminId, superAdminName: session.name, orgName: org.name })
  }

  await prisma.billingCredit.delete({ where: { id: creditId } })
  return NextResponse.json({ success: true })
}
