export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { prisma } from "@/lib/prisma"

const EMAIL_SELECT = {
  id:             true,
  direction:      true,
  fromAddress:    true,
  toAddress:      true,
  subject:        true,
  bodyHtml:       true,
  bodyText:       true,
  messageId:      true,
  inReplyTo:      true,
  threadId:       true,
  sentAt:         true,
  source:         true,
  isRead:         true,
  isArchived:     true,
  contactEmail:   true,
  followUpDate:   true,
  followUpDoneAt: true,
  stageNumber:    true,
  openedAt:       true,
  openCount:      true,
  lastOpenedAt:   true,
  demoCall: {
    select: { id: true, contactName: true, companyName: true },
  },
} as const

// GET /api/sales/emails?all=true
// Returns emails for the current sales user (by sentBySalesUserId).
// SuperAdmins get all emails the same as the super-admin endpoint.
export async function GET(req: NextRequest) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const all = searchParams.get("all") === "true"

  if (!all) return NextResponse.json({ error: "all=true required" }, { status: 400 })

  let where: Record<string, unknown> = { isDeleted: false, isArchived: false }

  if (!session.superAdmin && session.salesUserId) {
    // Sales user: show emails they sent, plus received replies to their contact emails
    const sentEmails = await prisma.crmEmail.findMany({
      where: { sentBySalesUserId: session.salesUserId },
      select: { contactEmail: true },
    })
    const contactEmails = [...new Set(sentEmails.map(e => e.contactEmail))]

    where = {
      isDeleted:  false,
      isArchived: false,
      OR: [
        { sentBySalesUserId: session.salesUserId },
        { contactEmail: { in: contactEmails }, direction: "received" },
      ],
    }
  }

  const emails = await prisma.crmEmail.findMany({
    where,
    orderBy: { sentAt: "desc" },
    take: 500,
    select: EMAIL_SELECT,
  })

  return NextResponse.json({ emails })
}
