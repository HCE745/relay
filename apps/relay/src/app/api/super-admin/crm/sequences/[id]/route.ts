import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

async function requireSA() {
  const s = await getSession()
  return s?.superAdmin ? s : null
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const existing = await prisma.crmSequence.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const body = await req.json() as Record<string, unknown>

  // Handle steps separately
  const { steps, ...seqFields } = body as {
    steps?: {
      id?:               string
      stepNumber:        number
      delayBusinessDays: number
      subjectBehavior:   string
      newSubject?:       string
      messageTemplate?:  string
      aiInstructions?:   string
      requireApproval?:  boolean
      autoSendAllowed?:  boolean
    }[]
    [key: string]: unknown
  }

  const sequence = await prisma.crmSequence.update({
    where: { id },
    data:  seqFields as never,
  })

  if (steps) {
    // Full replace of steps
    await prisma.crmSequenceStep.deleteMany({ where: { sequenceId: id } })
    if (steps.length > 0) {
      await prisma.crmSequenceStep.createMany({
        data: steps.map(s => {
          const { id: _ignored, ...rest } = s
          void _ignored
          return { ...rest, sequenceId: id }
        }),
      })
    }
  }

  const full = await prisma.crmSequence.findUnique({
    where:   { id },
    include: { steps: { orderBy: { stepNumber: "asc" } } },
  })

  return NextResponse.json({ sequence: full })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!await requireSA()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { id } = await params

  const existing = await prisma.crmSequence.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (existing.isSystem) return NextResponse.json({ error: "Cannot delete system sequences" }, { status: 403 })

  await prisma.crmSequence.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
