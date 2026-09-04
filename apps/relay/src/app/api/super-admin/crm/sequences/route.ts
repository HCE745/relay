import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"
import { seedDefaultSequences } from "@/lib/crm-sequences"

export const dynamic = "force-dynamic"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

export async function GET() {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Seed defaults on first load
  await seedDefaultSequences()

  const sequences = await prisma.crmSequence.findMany({
    include:  { steps: { orderBy: { stepNumber: "asc" } } },
    orderBy:  { createdAt: "asc" },
  })

  return NextResponse.json({ sequences })
}

export async function POST(req: NextRequest) {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json() as {
    name:           string
    description?:   string
    isActive?:      boolean
    isDefault?:     boolean
    stopOnReply?:   boolean
    stopOnCustomer?:boolean
    steps?: {
      stepNumber:        number
      delayBusinessDays: number
      subjectBehavior:   string
      newSubject?:       string
      messageTemplate?:  string
      aiInstructions?:   string
      requireApproval?:  boolean
      autoSendAllowed?:  boolean
    }[]
  }

  if (!body.name) return NextResponse.json({ error: "name required" }, { status: 400 })

  const sequence = await prisma.crmSequence.create({
    data: {
      name:           body.name,
      description:    body.description ?? null,
      isActive:       body.isActive    ?? true,
      isDefault:      body.isDefault   ?? false,
      isSystem:       false,
      stopOnReply:    body.stopOnReply    ?? true,
      stopOnCustomer: body.stopOnCustomer ?? true,
    },
  })

  if (body.steps?.length) {
    await prisma.crmSequenceStep.createMany({
      data: body.steps.map(s => ({ ...s, sequenceId: sequence.id })),
    })
  }

  const full = await prisma.crmSequence.findUnique({
    where:   { id: sequence.id },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  })

  return NextResponse.json({ sequence: full }, { status: 201 })
}
