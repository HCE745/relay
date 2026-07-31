import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Seed default stages if none exist
  const stageCount = await prisma.followUpStage.count()
  if (stageCount === 0) {
    await prisma.followUpStage.createMany({
      data: [
        { stageNumber: 0, name: "Initial Outreach",  daysAfterPrevious: 0,  description: "First email sent to a prospect" },
        { stageNumber: 1, name: "First Follow-Up",   daysAfterPrevious: 3,  description: null },
        { stageNumber: 2, name: "Second Follow-Up",  daysAfterPrevious: 7,  description: null },
        { stageNumber: 3, name: "Final Touch",       daysAfterPrevious: 14, description: null },
      ],
    })
  }

  const stages = await prisma.followUpStage.findMany({ orderBy: { stageNumber: "asc" } })
  const stageMap = Object.fromEntries(stages.map(s => [s.stageNumber, s.name]))
  const maxStageNum = stages.length > 0 ? stages[stages.length - 1].stageNumber : 3

  const emails = await prisma.crmEmail.findMany({
    where: {
      direction:      "sent",
      followUpDate:   { not: null },
      followUpDoneAt: null,
      isDeleted:      false,
    },
    orderBy: { followUpDate: "asc" },
    select: {
      id:           true,
      contactEmail: true,
      subject:      true,
      sentAt:       true,
      followUpDate: true,
      stageNumber:  true,
      demoCallId:   true,
      demoCall: {
        select: { id: true, contactName: true, companyName: true, contactEmail: true },
      },
    },
  })

  const enriched = emails.map(e => {
    const sn             = e.stageNumber ?? 0
    const dueStageNum    = sn + 1
    const sequenceComplete = dueStageNum > maxStageNum
    return {
      ...e,
      stageNumber:     sn,
      stageName:       stageMap[sn]    ?? `Stage ${sn}`,
      dueStageNumber:  dueStageNum,
      dueStageName:    sequenceComplete ? "Sequence Complete" : (stageMap[dueStageNum] ?? `Stage ${dueStageNum}`),
      sequenceComplete,
    }
  })

  return NextResponse.json({ emails: enriched, stages })
}
