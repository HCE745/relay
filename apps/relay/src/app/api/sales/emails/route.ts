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
  sentiment:      true,
  prospectId:     true,
  demoCall: {
    select: { id: true, contactName: true, companyName: true },
  },
  prospect: {
    select: { id: true, companyName: true },
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
    // Sales user: show emails attributed to their account.
    // - sentBySalesUserId: emails THEY composed/sent
    // - mailboxOwnerSalesUserId + received: emails received in THEIR mailbox
    // The two conditions together give the full per-user inbox.
    where = {
      isDeleted:  false,
      isArchived: false,
      OR: [
        { sentBySalesUserId: session.salesUserId },
        { mailboxOwnerSalesUserId: session.salesUserId, direction: "received" },
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
