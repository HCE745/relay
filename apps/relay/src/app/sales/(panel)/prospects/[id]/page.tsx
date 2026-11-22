import { prisma } from "@/lib/prisma"
import { getSession } from "@/lib/session"
import { redirect, notFound } from "next/navigation"
import { ProspectHub } from "./ProspectHub"

export const dynamic = "force-dynamic"

export default async function ProspectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session?.superAdmin && !session?.salesUserId) redirect("/sales/login")

  const { id } = await params

  const [prospect, salesUsers, existingHandoff] = await Promise.all([
    prisma.prospect.findUnique({
      where: { id },
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        contacts:   { orderBy: [{ isPrimaryContact: "desc" }, { isDecisionMaker: "desc" }, { createdAt: "asc" }] },
        notes:      { orderBy: { createdAt: "desc" }, take: 50 },
        opportunities: {
          include: {
            assignedTo: { select: { id: true, name: true } },
            contact:    { select: { id: true, name: true, title: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        demoCalls: {
          include: {
            assignedTo: { select: { id: true, name: true } },
            organization: {
              select: {
                id: true,
                name: true,
                subscriptionStatus: true,
                plan: true,
                productLine: true,
                createdAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        salesActivities: {
          include: {
            salesUser: { select: { id: true, name: true } },
            contact:   { select: { id: true, name: true } },
          },
          orderBy: { occurredAt: "desc" },
          take: 100,
        },
        tasks: {
          include: {
            assignedTo: { select: { id: true, name: true } },
            contact:    { select: { id: true, name: true } },
          },
          orderBy: [{ completedAt: "asc" }, { priority: "desc" }, { dueAt: "asc" }],
        },
        emails: {
          select: {
            id: true, direction: true, subject: true, bodyText: true, bodyHtml: true,
            sentAt: true, fromAddress: true, toAddress: true,
            isRead: true, openedAt: true, openCount: true, sentiment: true,
            isArchived: true, isDeleted: true,
            contact: { select: { id: true, name: true } },
          },
          where: { isDeleted: false },
          orderBy: { sentAt: "desc" },
          take: 100,
        },
      },
    }),
    prisma.salesUser.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.onboardingHandoff.findFirst({
      where: { prospectId: id, status: { in: ["pending_review", "accepted", "rejected"] } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, status: true, plan: true, estimatedFacilities: true,
        salesNotes: true, primaryContactName: true, primaryContactEmail: true,
        primaryContactPhone: true, opportunityId: true, rejectionReason: true,
        customerOnboardingId: true, createdAt: true,
      },
    }),
  ])

  if (!prospect) notFound()

  // When a super admin uses "View CRM as Rep," session.superAdmin stays true but
  // crmImpersonatedSalesUserId is set.  In that mode the SA acts as a rep:
  // isSuperAdmin and isManager are both false, and currentUserId is the rep's real ID.
  const isImpersonating = !!session.superAdmin && !!session.crmImpersonatedSalesUserId
  const isManager       = !isImpersonating && !!(session.superAdmin || session.salesUserRole === "admin_sales")
  const isSuperAdmin    = !!session.superAdmin && !isImpersonating
  const currentUserId   = session.crmImpersonatedSalesUserId ?? session.salesUserId ?? null

  return (
    <ProspectHub
      company={prospect as never}
      salesUsers={salesUsers}
      currentUserId={currentUserId}
      isManager={isManager}
      isSuperAdmin={isSuperAdmin}
      existingHandoff={existingHandoff as never}
      relayOrganizationId={prospect.relayOrganizationId}
    />
  )
}
