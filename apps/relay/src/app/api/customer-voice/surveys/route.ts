import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "HR", "MANAGER"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const surveys = await prisma.customerSurvey.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      location:  { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      _count:    { select: { responses: true } },
    },
  })

  return NextResponse.json(surveys)
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["ADMIN", "HR"].includes(session.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json() as {
    title?: unknown
    description?: unknown
    questions?: unknown
    isAnonymous?: unknown
    status?: unknown
    distributionMethod?: unknown
    locationId?: unknown
  }

  const title = typeof body.title === "string" ? body.title.trim() : ""
  if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 })

  const survey = await prisma.customerSurvey.create({
    data: {
      organizationId:     session.organizationId,
      locationId:         typeof body.locationId === "string" ? body.locationId || null : null,
      title,
      description:        typeof body.description === "string" ? body.description.trim() || null : null,
      questions:          Array.isArray(body.questions) ? body.questions : [],
      isAnonymous:        body.isAnonymous !== false,
      status:             ["DRAFT", "ACTIVE", "CLOSED"].includes(String(body.status)) ? String(body.status) : "DRAFT",
      distributionMethod: ["QR", "LINK", "BOTH"].includes(String(body.distributionMethod)) ? String(body.distributionMethod) : "LINK",
      createdById:        session.userId,
    },
  })

  return NextResponse.json(survey, { status: 201 })
}
