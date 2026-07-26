import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getSession()
  if (!session?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  // Retroactively set reminders on old sent emails with none set
  await prisma.crmEmail.updateMany({
    where: {
      direction:    "sent",
      sentAt:       { lt: sevenDaysAgo },
      followUpDate: null,
      isDeleted:    false,
    },
    data: { followUpDate: now },
  })

  const emails = await prisma.crmEmail.findMany({
    where: {
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
      demoCallId:   true,
      demoCall: {
        select: { id: true, contactName: true, companyName: true, contactEmail: true },
      },
    },
  })

  return NextResponse.json({ emails })
}
