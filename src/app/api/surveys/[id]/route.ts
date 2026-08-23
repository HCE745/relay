import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const survey = await prisma.survey.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" } },
      createdBy: { select: { id: true, name: true } },
      _count:    { select: { questions: true, responses: true } },
    },
  })

  if (!survey || survey.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const isAdminOrHR = session.role === "ADMIN" || session.role === "HR"
  const isManager   = session.role === "MANAGER"

  // Employees can only see ACTIVE surveys
  if (!isAdminOrHR && !isManager && survey.status !== "ACTIVE") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Check if the current user has already responded
  const existingResponse = session.userId
    ? await prisma.surveyResponse.findFirst({
        where: { surveyId: id, respondentId: session.userId },
        select: { id: true },
      })
    : null

  return NextResponse.json({ ...survey, hasResponded: !!existingResponse })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (session.role !== "ADMIN" && session.role !== "HR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params
  const survey = await prisma.survey.findUnique({ where: { id }, select: { id: true, organizationId: true, status: true } })
  if (!survey || survey.organizationId !== session.organizationId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  if (survey.status !== "DRAFT") {
    return NextResponse.json({ error: "Only DRAFT surveys can be edited" }, { status: 400 })
  }

  const body = await request.json()
  const { title, description, isAnonymous, startsAt, endsAt, questions } = body

  const updated = await prisma.survey.update({
    where: { id },
    data: {
      title:       title?.trim()       ?? undefined,
      description: description?.trim() ?? undefined,
      isAnonymous: typeof isAnonymous === "boolean" ? isAnonymous : undefined,
      startsAt:    startsAt !== undefined ? (startsAt ? new Date(startsAt) : null) : undefined,
      endsAt:      endsAt   !== undefined ? (endsAt   ? new Date(endsAt)   : null) : undefined,
      ...(questions !== undefined ? {
        questions: {
          deleteMany: {},
          create: (questions as Array<{ type: string; text: string; required?: boolean; options?: string[] }>)
            .map((q, i) => ({
              order:    i,
              type:     q.type,
              text:     q.text?.trim(),
              required: q.required !== false,
              options:  q.options ? q.options : Prisma.JsonNull,
            })),
        },
      } : {}),
    },
    include: {
      questions: { orderBy: { order: "asc" } },
      createdBy: { select: { id: true, name: true } },
      _count:    { select: { questions: true, responses: true } },
    },
  })

  return NextResponse.json(updated)
}
