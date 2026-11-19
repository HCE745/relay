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

  const dateFilter = startDate || endDate
    ? { sentAt: { ...(startDate ? { gte: new Date(startDate) } : {}), ...(endDate ? { lte: new Date(endDate) } : {}) } }
    : {}

  // Step 1: collect threadIds from this rep's outbound CRM emails so we can
  // include replies that arrived via IMAP even if prospect-linking ran later.
  // IMAP sync carries the threadId forward via inReplyTo matching, so a reply
  // to a sent email gets the same threadId as the original outbound message.
  const sentThreadRows = await prisma.crmEmail.findMany({
    where:  { sentBySalesUserId: repId, isDeleted: false },
    select: { threadId: true, id: true },
  })
  const repThreadIds = [
    ...new Set(
      sentThreadRows
        .map(e => e.threadId ?? e.id)
        .filter((v): v is string => v != null),
    ),
  ]

  // Step 2: build the CRM-restricted inbound filter.
  //
  // IMAP sync saves ALL inbound mail and auto-creates a DemoCall ("Lead") for
  // any unknown sender, so demoCallId IS NOT NULL on received emails is NOT a
  // reliable CRM-association signal. Use these explicit indicators instead:
  //   prospectId   — email was linked to a Prospect (Company) record
  //   contactId    — email was linked to a ProspectContact record
  //   source       — "inbound_webhook" means it arrived via reply-tracking
  //   threadId     — same thread as a known outbound CRM email (reply)
  const crmInboundClauses: object[] = [
    { prospectId: { not: null } },
    { contactId:  { not: null } },
    { source:     "inbound_webhook" },
  ]
  if (repThreadIds.length > 0) {
    crmInboundClauses.push({ threadId: { in: repThreadIds } })
  }

  const crmInbound = {
    mailboxOwnerSalesUserId: repId,
    direction:               "received" as const,
    OR:                      crmInboundClauses,
  }

  const baseWhere = {
    isDeleted: false,
    OR: [
      // Outbound: always CRM — rep composed via CRM system
      { sentBySalesUserId: repId },
      // Inbound: only CRM-associated correspondence
      crmInbound,
    ],
  }

  const directionFilter = direction ? { direction } : {}

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
