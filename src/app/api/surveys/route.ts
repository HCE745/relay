import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@/generated/prisma/client"
import { isProfessional } from "@/lib/pricing"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const isAdminOrHR = session.role === "ADMIN" || session.role === "HR"
  const isManager   = session.role === "MANAGER"

  const surveys = await prisma.survey.findMany({
    where: {
      organizationId: session.organizationId,
      ...(isAdminOrHR || isManager ? {} : { status: "ACTIVE" }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      createdBy:  { select: { id: true, name: true } },
      _count:     { select: { questions: true, responses: true } },
    },
  })

  // For employees: also include whether they've already responded
  if (!isAdminOrHR && !isManager) {
    const responseMap = new Set(
      (await prisma.surveyResponse.findMany({
        where: { surveyId: { in: surveys.map(s => s.id) }, respondentId: session.userId },
        select: { surveyId: true },
      })).map(r => r.surveyId)
    )
    return NextResponse.json(surveys.map(s => ({ ...s, hasResponded: responseMap.has(s.id) })))
  }

  return NextResponse.json(surveys)
}

export async function POST(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (session.role !== "ADMIN" && session.role !== "HR") {
    return NextResponse.json({ error: "Only Admin or HR can create surveys" }, { status: 403 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: session.organizationId },
    select: { plan: true },
  })
  if (!isProfessional(org?.plan ?? "essentials")) {
    return NextResponse.json({ error: "Surveys require a Professional plan" }, { status: 403 })
  }

  const body = await request.json()
  const { title, description, isAnonymous, startsAt, endsAt, questions } = body

  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 })

  const survey = await prisma.survey.create({
    data: {
      organizationId: session.organizationId,
      createdById: session.userId,
      title: title.trim(),
      description: description?.trim() || null,
      isAnonymous: isAnonymous !== false,
      startsAt: startsAt ? new Date(startsAt) : null,
      endsAt: endsAt ? new Date(endsAt) : null,
      questions: questions?.length
        ? {
            create: (questions as Array<{ type: string; text: string; required?: boolean; options?: string[] }>)
              .map((q, i) => ({
                order:    i,
                type:     q.type,
                text:     q.text?.trim(),
                required: q.required !== false,
                options:  q.options ? q.options : Prisma.JsonNull,
              })),
          }
        : undefined,
    },
    include: {
      questions: { orderBy: { order: "asc" } },
      createdBy: { select: { id: true, name: true } },
      _count:    { select: { questions: true, responses: true } },
    },
  })

  return NextResponse.json(survey, { status: 201 })
}
