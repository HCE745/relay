import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const survey = await prisma.customerSurvey.findFirst({
    where: { id, organizationId: session.organizationId },
    include: {
      location:  { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      responses: {
        orderBy: { submittedAt: "desc" },
        take: 200,
      },
      _count: { select: { responses: true } },
    },
  })

  if (!survey) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(survey)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "HR"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.customerSurvey.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json() as Record<string, unknown>
  const data: Record<string, unknown> = {}

  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim()
  if ("description" in body) data.description = typeof body.description === "string" ? body.description.trim() || null : null
  if (Array.isArray(body.questions)) data.questions = body.questions
  if (typeof body.isAnonymous === "boolean") data.isAnonymous = body.isAnonymous
  if (["DRAFT", "ACTIVE", "CLOSED"].includes(String(body.status))) {
    data.status = String(body.status)
    if (body.status === "CLOSED") data.closedAt = new Date()
  }
  if (["QR", "LINK", "BOTH"].includes(String(body.distributionMethod))) data.distributionMethod = String(body.distributionMethod)
  if ("locationId" in body) data.locationId = typeof body.locationId === "string" ? body.locationId || null : null

  const updated = await prisma.customerSurvey.update({ where: { id }, data })
  return NextResponse.json(updated)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await params
  const existing = await prisma.customerSurvey.findFirst({
    where: { id, organizationId: session.organizationId },
  })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  await prisma.customerSurvey.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
