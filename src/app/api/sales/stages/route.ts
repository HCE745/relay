import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const DEFAULT_STAGES = [
  { stageNumber: 0, name: "Initial Outreach",  daysAfterPrevious: 0,  description: "First email sent to a prospect" },
  { stageNumber: 1, name: "First Follow-Up",   daysAfterPrevious: 3,  description: null },
  { stageNumber: 2, name: "Second Follow-Up",  daysAfterPrevious: 7,  description: null },
  { stageNumber: 3, name: "Final Touch",       daysAfterPrevious: 14, description: null },
]

export async function GET() {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const count = await prisma.followUpStage.count()
  if (count === 0) {
    await prisma.followUpStage.createMany({ data: DEFAULT_STAGES })
  }

  const stages = await prisma.followUpStage.findMany({ orderBy: { stageNumber: "asc" } })
  return NextResponse.json({ stages })
}

export async function POST(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { name, daysAfterPrevious, description } = await req.json() as {
    name: string; daysAfterPrevious: number; description?: string
  }

  if (!name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 })

  const maxStage = await prisma.followUpStage.findFirst({ orderBy: { stageNumber: "desc" } })
  const stageNumber = (maxStage?.stageNumber ?? -1) + 1

  const stage = await prisma.followUpStage.create({
    data: {
      stageNumber,
      name: name.trim(),
      daysAfterPrevious: Number(daysAfterPrevious) || 7,
      description: description?.trim() || null,
    },
  })

  return NextResponse.json({ stage })
}
