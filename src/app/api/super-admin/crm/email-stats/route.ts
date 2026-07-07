import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export async function GET() {
  if (!(await getSession())?.superAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const now       = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  const ago14      = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const [sentToday, receivedToday, followUpsDue, noEmailCount] = await Promise.all([
    prisma.crmEmail.count({ where: { direction: "sent",     sentAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.crmEmail.count({ where: { direction: "received", sentAt: { gte: todayStart, lt: todayEnd } } }),
    prisma.crmEmail.count({ where: { followUpDate: { lte: now }, followUpDoneAt: null } }),
    // Demo calls with no emails at all in 14+ days
    prisma.demoCall.count({
      where: {
        updatedAt:  { lt: ago14 },
        callStatus: { notIn: ["Cancelled"] },
        crmEmails:  { none: {} },
      },
    }),
  ])

  return NextResponse.json({ sentToday, receivedToday, followUpsDue, noEmailCount })
}
