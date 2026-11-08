import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import type { InputJsonValue } from "@prisma/client/runtime/client"

const toJson = (v: unknown): InputJsonValue => JSON.parse(JSON.stringify(v ?? null)) as InputJsonValue

// GET /api/onboarding/session — returns or creates an OnboardingSession for the org
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const orgId = session.organizationId

  let onboardingSession = await prisma.onboardingSession.findUnique({
    where: { organizationId: orgId },
  })

  if (!onboardingSession) {
    onboardingSession = await prisma.onboardingSession.create({
      data: { organizationId: orgId },
    })
  }

  return NextResponse.json(onboardingSession)
}

// PATCH /api/onboarding/session — update stage, stageData, skippedStages
export async function PATCH(request: NextRequest) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can update onboarding sessions" }, { status: 403 })
  }

  const orgId = session.organizationId
  const body = await request.json() as {
    currentStage?: number
    stageData?: Record<string, unknown>
    skippedStages?: number[]
    draftOps?: unknown[]
  }

  const updated = await prisma.onboardingSession.upsert({
    where: { organizationId: orgId },
    create: {
      organizationId: orgId,
      currentStage:  body.currentStage  ?? 1,
      stageData:     toJson(body.stageData ?? {}),
      skippedStages: body.skippedStages ?? [],
      draftOps:      toJson(body.draftOps ?? []),
    },
    update: {
      ...(body.currentStage  !== undefined ? { currentStage:  body.currentStage }             : {}),
      ...(body.stageData     !== undefined ? { stageData:     toJson(body.stageData) }         : {}),
      ...(body.skippedStages !== undefined ? { skippedStages: body.skippedStages }             : {}),
      ...(body.draftOps      !== undefined ? { draftOps:      toJson(body.draftOps) }          : {}),
    },
  })

  return NextResponse.json(updated)
}
