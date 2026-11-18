import { NextResponse } from "next/server"
import { getManagerRepView } from "@/lib/manager-rep-auth"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

const EMAIL_SELECT = {
  id:             true,
  direction:      true,
  fromAddress:    true,
  toAddress:      true,
  cc:             true,
  subject:        true,
  bodyHtml:       true,
  bodyText:       true,
  messageId:      true,
  inReplyTo:      true,
  threadId:       true,
  sentAt:         true,
  source:         true,
  isRead:         true,
  contactEmail:   true,
  followUpDate:   true,
  followUpDoneAt: true,
  stageNumber:    true,
  openedAt:       true,
  openCount:      true,
  lastOpenedAt:   true,
  sentiment:      true,
  prospectId:     true,
  demoCall:   { select: { id: true, contactName: true, companyName: true } },
  prospect:   { select: { id: true, companyName: true } },
} as const

export async function GET(
  req: Request,
  { params }: { params: Promise<{ repId: string }> },
) {
  const { repId } = await params
  const view = await getManagerRepView(repId)
  if (!view) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

  const url       = new URL(req.url)
  const direction = url.searchParams.get("direction") as "sent" | "received" | null
  const startDate = url.searchParams.get("startDate")
  const endDate   = url.searchParams.get("endDate")

  // Scope: emails sent by this rep, or received in their CRM mailbox.
  // isDeleted: false excludes soft-deleted emails.
  const baseWhere = {
    isDeleted: false,
    OR: [
      { sentBySalesUserId: repId },
      { mailboxOwnerSalesUserId: repId, direction: "received" as const },
    ],
  }

  const directionFilter = direction ? { direction } : {}
  const dateFilter      = startDate || endDate
    ? { sentAt: { ...(startDate ? { gte: new Date(startDate) } : {}), ...(endDate ? { lte: new Date(endDate) } : {}) } }
    : {}

  const emails = await prisma.crmEmail.findMany({
    where:   { ...baseWhere, ...directionFilter, ...dateFilter },
    orderBy: { sentAt: "desc" },
    take:    500,
    select:  EMAIL_SELECT,
  })

  // Audit: record who accessed whose emails, without logging content.
  console.log(
    `[manager-email-access] manager=${view.session.salesUserId ?? "super-admin"} ` +
    `rep=${repId} count=${emails.length} at=${new Date().toISOString()}`
  )

  return NextResponse.json({ emails })
}
