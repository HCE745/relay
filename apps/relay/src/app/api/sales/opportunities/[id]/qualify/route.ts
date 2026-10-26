export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const body = await req.json() as {
    hasMeasurableProblem: string  // "yes" | "no" | "unknown"
    hasBudget:            string
    hasDecisionMaker:     string
    hasTimeline:          string
    fitsUseCase:          string
    disqualifiedReason?:  string
  }

  const answers = [
    body.hasMeasurableProblem,
    body.hasBudget,
    body.hasDecisionMaker,
    body.hasTimeline,
    body.fitsUseCase,
  ]

  const yesCount = answers.filter(a => a === "yes").length
  const score = yesCount * 20

  let status: string
  if (score <= 20)      status = "UNQUALIFIED"
  else if (score <= 40) status = "MARKETING_QUALIFIED"
  else if (score <= 60) status = "MARKETING_QUALIFIED"
  else if (score <= 80) status = "SALES_QUALIFIED"
  else                  status = "SALES_QUALIFIED"

  if (body.disqualifiedReason) status = "DISQUALIFIED"

  const updated = await prisma.crmOpportunity.update({
    where: { id },
    data: {
      qualificationScore:  score,
      qualificationStatus: status,
      qualifiedAt:         new Date(),
      disqualifiedReason:  body.disqualifiedReason ?? null,
    },
  })

  return NextResponse.json(updated)
}
