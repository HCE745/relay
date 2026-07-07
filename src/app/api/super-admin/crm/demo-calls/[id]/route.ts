import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  const call = await prisma.demoCall.findUnique({
    where:   { id },
    include: { organization: { select: { id: true, name: true } } },
  })
  if (!call) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ call })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params

  const body = await req.json() as Record<string, unknown>

  const updates: Record<string, unknown> = {}
  const allowed = [
    "contactName","contactEmail","contactPhone","companyName","industry",
    "employeeCount","locationCount","leadSource","scheduledAt","callStatus",
    "callNotes","painPoints","followUpDate","followUpCompleted","outcome","organizationId",
  ]
  for (const k of allowed) {
    if (k in body) {
      if ((k === "scheduledAt" || k === "followUpDate") && body[k]) {
        updates[k] = new Date(body[k] as string)
      } else if ((k === "scheduledAt" || k === "followUpDate") && body[k] === null) {
        updates[k] = null
      } else {
        updates[k] = body[k]
      }
    }
  }

  const call = await prisma.demoCall.update({ where: { id }, data: updates })

  // Activity log when outcome is set
  if ("outcome" in body && body.outcome && call.organizationId) {
    await prisma.crmActivity.create({
      data: {
        organizationId:  call.organizationId,
        eventType:       "demo_completed",
        description:     `Demo call outcome: ${body.outcome as string}`,
        createdBySAName: session.name,
      },
    })
    // Auto-update lifecycle to Demo Completed if Demo Scheduled
    const org = await prisma.organization.findUnique({
      where: { id: call.organizationId }, select: { lifecycleStatus: true },
    })
    if (org && org.lifecycleStatus === "Demo Scheduled") {
      await prisma.organization.update({
        where: { id: call.organizationId },
        data:  { lifecycleStatus: "Demo Completed" },
      })
    }
  }

  return NextResponse.json({ call })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const { id } = await params
  await prisma.demoCall.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
