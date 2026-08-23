import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (session.role !== "ADMIN" && session.role !== "HR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const survey = await prisma.survey.findUnique({
    where: { id },
    select: { id: true, organizationId: true, status: true },
  })

  if (!survey || survey.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }
  if (survey.status !== "ACTIVE") {
    return NextResponse.json({ error: "Only ACTIVE surveys can be closed" }, { status: 400 })
  }

  const updated = await prisma.survey.update({
    where: { id },
    data: { status: "CLOSED", closedAt: new Date() },
    include: { questions: { orderBy: { order: "asc" } }, createdBy: { select: { id: true, name: true } }, _count: { select: { questions: true, responses: true } } },
  })

  return NextResponse.json(updated)
}
